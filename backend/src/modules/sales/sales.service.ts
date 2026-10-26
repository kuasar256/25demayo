import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import {
  CashMovementType, PaymentMethod, DeliveryStatus, LocationType, MovementType, PaymentType, ProductionPriority, ProductionStatus, Role, SaleStatus,
} from '../../common/enums';
import { PaginatedResult, Pagination, paginatedResult } from '../../common/pagination';
import { assertSaleAccess } from '../../common/record-access';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private notifications: NotificationsService,
  ) {}

  private nextCode() {
    return 'VTA-' + Date.now().toString(36).toUpperCase();
  }

  async list(
    user: any,
    locationId?: number,
    sellerId?: number,
    filters: {
      search?: string;
      status?: SaleStatus;
      deliveryStatus?: string;
      hasPendingBalance?: boolean;
      pagination?: Pagination;
    } = {},
  ): Promise<any[] | PaginatedResult<any>> {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.deliveryStatus) where.deliveryStatus = filters.deliveryStatus;
    if (filters.hasPendingBalance) where.pendingBalance = { gt: 0 };
    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { code: { contains: search } },
        { client: { fullName: { contains: search } } },
        { client: { ci: { contains: search } } },
        { seller: { fullName: { contains: search } } },
      ];
    }
    if (user.role === Role.VENDEDOR) where.sellerId = user.id; // vendedor: solo las suyas
    if (user.role === Role.ENCARGADO_SUCURSAL) {
      where.locationType = LocationType.SUCURSAL;
      where.locationId = user.branchId;
    }
    if (locationId && (user.role === Role.ADMIN_GENERAL || user.role === Role.ADMIN)) {
      where.locationId = locationId;
    }
    if (sellerId && (user.role === Role.ADMIN_GENERAL || user.role === Role.ADMIN)) {
      where.sellerId = sellerId;
    }
    const query = {
      where,
      include: {
        client: true,
        seller: { select: { fullName: true } },
        branch: true,
        items: { include: { variant: { include: { product: true } } } },
      },
      orderBy: { id: 'desc' },
    } as const;
    if (!filters.pagination) {
      return this.prisma.sale.findMany({ ...query, take: 300 });
    }

    const [items, total] = await Promise.all([
      this.prisma.sale.findMany({
        ...query,
        skip: filters.pagination.skip,
        take: filters.pagination.pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return paginatedResult(items, total, filters.pagination);
  }

  async detail(id: number, user: any) {
    const s = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        client: true,
        seller: { select: { fullName: true } },
        canceledBy: { select: { fullName: true } },
        branch: true,
        items: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!s) throw new NotFoundException('Venta no encontrada.');
    if (user.role === Role.VENDEDOR && s.sellerId !== user.id) {
      throw new ForbiddenException('Solo puede ver sus propias ventas.');
    }
    if (
      user.role === Role.ENCARGADO_SUCURSAL &&
      (s.locationType !== LocationType.SUCURSAL || s.locationId !== user.branchId)
    ) {
      throw new ForbiddenException('Solo puede ver ventas de su sucursal.');
    }
    return s;
  }

  /**
   * Registro de venta:
   * - Cliente identificado por CI (autocompletar si existe, crear si no).
   * - Verificación de stock antes de vender (transacción atómica).
   * - Precios siempre tomados del servidor (nunca del cliente).
   * - Descuento automático de inventario + movimiento + auditoría.
   */
  async create(dto: any, user: any) {
    // Asegurar que locationId sea número
    dto.locationId = +dto.locationId;
    dto.clientCi = String(dto.clientCi ?? '').trim();
    dto.clientName = String(dto.clientName ?? '').trim();
    dto.clientPhone = String(dto.clientPhone ?? '').trim() || undefined;
    if (!dto.clientCi || !dto.clientName) {
      throw new BadRequestException('El CI y el nombre completo del cliente son obligatorios.');
    }

    // Alcance por rol
    if (user.role === Role.VENDEDOR) {
      if (dto.locationType !== LocationType.SUCURSAL || dto.locationId !== user.branchId) {
        throw new ForbiddenException('Un vendedor solo vende en su sucursal asignada.');
      }
    }
    if (user.role === Role.ENCARGADO_SUCURSAL) {
      if (dto.locationType !== LocationType.SUCURSAL || dto.locationId !== user.branchId) {
        throw new ForbiddenException('Un encargado de sucursal solo vende en su sucursal.');
      }
    }
    // ADMIN_GENERAL, ADMIN, ENCARGADO_FABRICA: pueden vender desde cualquier ubicación (fábrica incluida)

    const sale = await this.prisma.$transaction(async (tx) => {
      // 1. Cliente por CI
      let client = await tx.client.findUnique({ where: { ci: dto.clientCi } });
      if (!client) {
        client = await tx.client.create({
          data: { ci: dto.clientCi, fullName: dto.clientName, phone: dto.clientPhone },
        });
      }

      // 2. Verificar stock y calcular total con precios del servidor
      let total = 0;
      const pricedItems: any[] = [];
      for (const item of dto.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true },
        });
        if (!variant || !variant.isActive || !variant.product.isActive) {
          throw new BadRequestException('Producto no disponible.');
        }
        if (variant.price !== item.expectedUnitPrice) {
          throw new ConflictException(
            `El precio de ${variant.sku} cambió. Actualiza el carrito y revisa el nuevo total.`,
          );
        }
        await this.inventory.decrement(
          tx, item.variantId, dto.locationType, dto.locationId, item.quantity,
        );
        total += variant.price * item.quantity;

        // Calcular expiración de garantía según los años configurados en la variante
        const warrantyYears = variant.warrantyYears || 1;
        const warrantyExpiresAt = new Date();
        warrantyExpiresAt.setFullYear(warrantyExpiresAt.getFullYear() + warrantyYears);

        pricedItems.push({
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: variant.price,
          unitCost: variant.costPrice || 0,
          warrantySeal: item.warrantySeal ? String(item.warrantySeal).trim() : null,
          warrantyExpiresAt,
        });
      }

      // 2.5 Vincular a turno de caja activo si existe
      const activeShift = await tx.cashShift.findFirst({
        where: {
          status: 'ABIERTA',
          OR: [
            { openedById: user.id },
            ...(user.branchId ? [{ branchId: user.branchId }] : []),
          ],
        },
        orderBy: { openedAt: 'desc' },
      });

      const paymentType = dto.paymentType === 'ANTICIPO' ? 'ANTICIPO' : 'CONTADO';
      const amountPaid = dto.amountPaid == null ? (paymentType === 'ANTICIPO' ? 0 : total) : Number(dto.amountPaid);
      if (!Number.isFinite(amountPaid) || amountPaid < 0 || (paymentType === 'CONTADO' && amountPaid < total)) {
        throw new BadRequestException('El importe recibido no cubre la venta al contado o es inválido.');
      }
      if (dto.paymentMethod && !Object.values(PaymentMethod).includes(dto.paymentMethod)) throw new BadRequestException('Método de pago inválido.');
      const pendingBalance = paymentType === 'ANTICIPO' ? Math.max(0, total - amountPaid) : 0;
      const deliveryStatus = dto.deliveryStatus || (paymentType === 'ANTICIPO' ? DeliveryStatus.PENDIENTE_ENTREGA : DeliveryStatus.ENTREGADO);
      const deliveryDate = dto.deliveryDate ? new Date(dto.deliveryDate) : null;

      // 3. Crear venta e ítems
      const created = await tx.sale.create({
        data: {
          code: this.nextCode(),
          locationType: dto.locationType,
          locationId: dto.locationId,
          clientId: client.id,
          sellerId: user.id,
          total,
          paymentMethod: dto.paymentMethod || 'EFECTIVO',
          amountPaid,
          changeAmount: dto.paymentMethod && dto.paymentMethod !== 'EFECTIVO' ? 0 : Math.max(0, amountPaid - total),
          notes: dto.notes ? String(dto.notes).trim() : null,
          paymentType,
          pendingBalance,
          deliveryStatus,
          deliveryDate,
          cashShiftId: activeShift ? activeShift.id : null,
          items: { create: pricedItems },
        },
        include: { items: true, client: true, seller: { select: { fullName: true } } },
      });

      await tx.salePayment.create({ data: { saleId: created.id, cashShiftId: activeShift?.id ?? null, userId: user.id,
        kind: 'INITIAL', paymentMethod: dto.paymentMethod || 'EFECTIVO', amount: Math.min(total, amountPaid) } });

      // Si se solicita orden de fabricación automática para pedidos de clientes
      if (dto.createProductionOrder && pricedItems.length > 0) {
        const prodCount = await tx.productionOrder.count();
        const year = new Date().getFullYear();
        for (let i = 0; i < pricedItems.length; i++) {
          const item = pricedItems[i];
          const prodCode = `OF-${year}-${String(prodCount + 1 + i).padStart(4, '0')}`;
          await tx.productionOrder.create({
            data: {
              code: prodCode,
              variantId: item.variantId,
              quantity: item.quantity,
              branchId: dto.locationType === LocationType.SUCURSAL ? dto.locationId : user.branchId,
              requestedById: user.id,
              status: ProductionStatus.PENDIENTE,
              priority: dto.priority || ProductionPriority.NORMAL,
              customNotes: dto.customNotes || `Pedido para cliente ${client.fullName} (Venta ${created.code})`,
              saleId: created.id,
              targetDate: deliveryDate,
            },
          });
        }
      }

      // 4. Movimientos de inventario
      for (const item of pricedItems) {
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            locationType: dto.locationType,
            locationId: dto.locationId,
            type: MovementType.VENTA,
            quantity: -item.quantity,
            userId: user.id,
            referenceType: 'SALE',
            referenceId: created.id,
            reason: `Venta ${created.code}`,
          },
        });
      }
      return created;
    });

    for (const item of sale.items) {
      await this.inventory.checkAlert(item.variantId, dto.locationType, dto.locationId);
    }
    return sale;
  }

  /**
   * Anulación con reglas por rol (doc 5.7):
   * - Vendedor: solo ventas propias y recientes (mismo día).
   * - Encargado de sucursal: ventas de su sucursal.
   * - Administradores: cualquier venta.
   * - Motivo obligatorio. Restituye stock y queda en auditoría.
   */
  async cancel(id: number, reason: string, user: any) {
     const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
     if (!normalizedReason) throw new BadRequestException('El motivo de anulación es obligatorio.');

    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada.');
    if (sale.status === SaleStatus.ANULADA) {
      throw new BadRequestException('La venta ya está anulada.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (user.role) {
      case Role.VENDEDOR:
        if (sale.sellerId !== user.id) {
          throw new ForbiddenException('Un vendedor solo anula sus propias ventas.');
        }
        if (sale.createdAt < today) {
          throw new ForbiddenException('Un vendedor solo anula ventas del mismo día.');
        }
        break;
      case Role.ENCARGADO_SUCURSAL:
        if (sale.locationType !== LocationType.SUCURSAL || sale.locationId !== user.branchId) {
          throw new ForbiddenException('Solo puede anular ventas de su sucursal.');
        }
        break;
      case Role.ADMIN:
      case Role.ADMIN_GENERAL:
        break; // cualquier venta
      default:
        throw new ForbiddenException('Rol no autorizado para anular ventas.');
    }

    const canceled = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.sale.updateMany({
        where: { id, status: SaleStatus.ACTIVA },
        data: {
          status: SaleStatus.ANULADA,
          canceledById: user.id,
          cancelReason: normalizedReason,
          canceledAt: new Date(),
        },
      });
      if (claim.count === 0) {
        throw new BadRequestException('La venta ya fue anulada o cambió de estado.');
      }

      for (const item of sale.items) {
        await this.inventory.increment(
          tx, item.variantId, sale.locationType, sale.locationId, item.quantity,
        );
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            locationType: sale.locationType,
            locationId: sale.locationId,
            type: MovementType.ANULACION_VENTA,
            quantity: item.quantity,
            userId: user.id,
            referenceType: 'SALE',
            referenceId: sale.id,
            reason: `Anulación venta ${sale.code}: ${normalizedReason}`,
          },
        });
      }
      return tx.sale.findUniqueOrThrow({
        where: { id },
        include: { items: true, client: true },
      });
    });

    await this.notifications.notifySaleCanceled(canceled, user);
    return canceled;
  }

  /**
   * Ranking de vendedores.
   * - Vendedor: solo ve ranking general sin detalle ajeno (solo nombres + totales).
   * - Encargado de sucursal: ranking de su sucursal.
   */
  async ranking(user: any, from?: string, to?: string) {
    const where: any = { status: SaleStatus.ACTIVA };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(new Date(to).setHours(23, 59, 59));
    }
    if (user.role === Role.ENCARGADO_SUCURSAL) {
      where.locationType = LocationType.SUCURSAL;
      where.locationId = user.branchId;
    }

    const grouped = await this.prisma.sale.groupBy({
      by: ['sellerId'],
      where,
      _count: { id: true },
      _sum: { total: true },
    });

    const sellers = await this.prisma.user.findMany({
      where: { id: { in: grouped.map((g) => g.sellerId) } },
      select: { id: true, fullName: true, role: true },
    });

    return grouped
      .map((g) => ({
        seller: sellers.find((s) => s.id === g.sellerId),
        salesCount: g._count.id,
        total: g._sum.total ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Consulta de Garantía Post-Venta por CI del cliente, código de venta o sello
   */
  async checkWarranty(query: string) {
    const q = query?.trim();
    if (!q) throw new BadRequestException('Debes ingresar un CI, código de venta o sello.');

    const sales = await this.prisma.sale.findMany({
      where: {
        status: SaleStatus.ACTIVA,
        OR: [
          { client: { ci: { contains: q } } },
          { client: { fullName: { contains: q } } },
          { code: { contains: q } },
          { items: { some: { warrantySeal: { contains: q } } } },
        ],
      },
      include: {
        client: true,
        branch: true,
        seller: { select: { fullName: true } },
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const now = new Date();

    return sales.map((s) => ({
      ...s,
      items: s.items.map((it) => {
        const isExpired = it.warrantyExpiresAt ? it.warrantyExpiresAt < now : true;
        return {
          ...it,
          isWarrantyValid: !isExpired,
          warrantyStatus: isExpired ? 'VENCIDA' : 'VIGENTE',
        };
      }),
    }));
  }

  /**
   * Cobro de saldo pendiente de una venta con anticipo
   */
  async payBalance(
    id: number,
    dto: { amount: number; paymentMethod?: string; notes?: string; markDelivered?: boolean },
    user: any,
  ) {
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('El monto a pagar debe ser mayor a 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { client: true, items: { include: { variant: true } } },
      });
      if (!sale) throw new NotFoundException('Venta no encontrada.');
      if (sale.status !== SaleStatus.ACTIVA) throw new BadRequestException('Esta venta no está activa.');
      assertSaleAccess(sale, user);
      if (sale.pendingBalance <= 0) throw new BadRequestException('Esta venta no tiene saldo pendiente por cobrar.');

      const paidNow = Math.min(dto.amount, sale.pendingBalance);
      const newPendingBalance = Math.max(0, sale.pendingBalance - paidNow);
      const newAmountPaid = (sale.amountPaid || 0) + paidNow;
      const newDeliveryStatus = dto.markDelivered === true
        ? DeliveryStatus.ENTREGADO
        : sale.deliveryStatus;

      // Registrar movimiento de entrada en el turno de caja abierto
      const activeShift = await tx.cashShift.findFirst({
        where: {
          status: 'ABIERTA',
          OR: [
            { openedById: user.id },
            ...(user.branchId ? [{ branchId: user.branchId }] : []),
          ],
        },
        orderBy: { openedAt: 'desc' },
      });

      if (dto.paymentMethod && !Object.values(PaymentMethod).includes(dto.paymentMethod as any)) throw new BadRequestException('Método de pago inválido.');
      await tx.salePayment.create({ data: {
        saleId: sale.id, cashShiftId: activeShift?.id ?? null, userId: user.id,
        kind: 'BALANCE', paymentMethod: dto.paymentMethod || 'EFECTIVO', amount: paidNow,
      } });

      return tx.sale.update({
        where: { id },
        data: {
          amountPaid: newAmountPaid,
          pendingBalance: newPendingBalance,
          deliveryStatus: newDeliveryStatus,
          deliveryDate: newDeliveryStatus === DeliveryStatus.ENTREGADO ? new Date() : sale.deliveryDate,
          notes: dto.notes ? `${sale.notes || ''} | Pago saldo: Bs ${paidNow} (${dto.notes})`.trim() : sale.notes,
        },
        include: { client: true, items: { include: { variant: true } }, seller: { select: { fullName: true } } },
      });
    });
  }

  /**
   * Marcar entrega de productos al cliente
   */
  async markDelivered(id: number, user: any) {
    const sale = await this.prisma.sale.findUnique({ where: { id } });
    if (!sale) throw new NotFoundException('Venta no encontrada.');
    assertSaleAccess(sale, user);
    if (sale.status !== SaleStatus.ACTIVA) throw new BadRequestException('Solo se entregan ventas activas.');
    return this.prisma.sale.update({
      where: { id },
      data: {
        deliveryStatus: DeliveryStatus.ENTREGADO,
        deliveryDate: new Date(),
      },
    });
  }
}

