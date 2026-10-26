import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import {
  LocationType, MovementType, Role, TransferDestinationType, TransferStatus,
} from '../../common/enums';
import { PaginatedResult, Pagination, paginatedResult } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TransfersService {
  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private notifications: NotificationsService,
  ) {}

  private nextCode() {
    return 'TRF-' + Date.now().toString(36).toUpperCase();
  }

  private assertBranchAccess(user: any, destinationBranchId: number | null) {
    if ([Role.ENCARGADO_SUCURSAL, Role.VENDEDOR].includes(user.role) && (
      !user.branchId || destinationBranchId !== user.branchId
    )) {
      throw new ForbiddenException('Solo puede acceder a transferencias destinadas a su sucursal.');
    }
  }

  async list(
    user: any,
    status?: string,
    search?: string,
    pagination?: Pagination,
  ): Promise<any[] | PaginatedResult<any>> {
    const where: any = {};
    if (status) where.status = status;
    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      where.OR = [
        { code: { contains: normalizedSearch } },
        { sourceWarehouse: { name: { contains: normalizedSearch } } },
        { destinationBranch: { name: { contains: normalizedSearch } } },
        { thirdParty: { name: { contains: normalizedSearch } } },
      ];
    }
    if ([Role.ENCARGADO_SUCURSAL, Role.VENDEDOR].includes(user.role)) {
      if (!user.branchId) throw new ForbiddenException('El usuario debe tener una sucursal asignada.');
      where.destinationBranchId = user.branchId;
    }
    const query = {
      where,
      include: {
        sourceWarehouse: true,
        destinationBranch: true,
        thirdParty: true,
        createdBy: { select: { fullName: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
      orderBy: { id: 'desc' },
    } as const;
    if (!pagination) return this.prisma.transfer.findMany(query);

    const [items, total] = await Promise.all([
      this.prisma.transfer.findMany({
        ...query,
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.transfer.count({ where }),
    ]);
    return paginatedResult(items, total, pagination);
  }

  async detail(id: number, user: any) {
    const t = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        sourceWarehouse: true,
        destinationBranch: true,
        thirdParty: true,
        createdBy: { select: { fullName: true } },
        receivedBy: { select: { fullName: true } },
        items: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!t) throw new NotFoundException('Transferencia no encontrada.');
    this.assertBranchAccess(user, t.destinationBranchId);
    return t;
  }

  /**
   * Crear transferencia: descuenta stock de la bodega origen.
   * - SUCURSAL: queda PENDIENTE (requiere envío, recepción confirmada y cierre).
   * - TERCERO: se registra la salida y se cierra de inmediato.
   */
  async create(dto: any, user: any) {
    const isThirdParty = dto.destinationType === TransferDestinationType.TERCERO;
    if (isThirdParty) {
      if (!dto.thirdPartyId || dto.destinationBranchId != null) {
        throw new BadRequestException('Debe indicar únicamente el tercero/distribuidor destino.');
      }
    } else if (!dto.destinationBranchId || dto.thirdPartyId != null) {
      throw new BadRequestException('Debe indicar únicamente la sucursal destino.');
    }
    if (new Set(dto.items.map((item: any) => item.variantId)).size !== dto.items.length) {
      throw new BadRequestException('No repita variantes en una transferencia; consolide sus cantidades.');
    }

    const initialStatus = isThirdParty ? TransferStatus.CERRADA : TransferStatus.PENDIENTE;

    const transfer = await this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.sourceWarehouseId, isActive: true },
        select: { id: true },
      });
      if (!warehouse) throw new BadRequestException('La bodega de origen no existe o está inactiva.');

      if (isThirdParty) {
        const thirdParty = await tx.thirdParty.findFirst({
          where: { id: dto.thirdPartyId, isActive: true },
          select: { id: true },
        });
        if (!thirdParty) throw new BadRequestException('El tercero no existe o está inactivo.');
      } else {
        const branch = await tx.branch.findFirst({
          where: { id: dto.destinationBranchId, isActive: true },
          select: { id: true },
        });
        if (!branch) throw new BadRequestException('La sucursal destino no existe o está inactiva.');
      }

      const created = await tx.transfer.create({
        data: {
          code: this.nextCode(),
          sourceWarehouseId: dto.sourceWarehouseId,
          destinationType: dto.destinationType,
          destinationBranchId: isThirdParty ? null : dto.destinationBranchId,
          thirdPartyId: isThirdParty ? dto.thirdPartyId : null,
          status: initialStatus,
          notes: dto.notes,
          createdById: user.id,
          receivedById: isThirdParty ? user.id : null,
          receivedAt: isThirdParty ? new Date() : null,
          closedAt: isThirdParty ? new Date() : null,
          items: { create: dto.items },
        },
        include: { items: true },
      });

      for (const item of dto.items) {
        const variant = await tx.productVariant.findFirst({
          where: { id: item.variantId, isActive: true, product: { isActive: true } },
          select: { id: true },
        });
        if (!variant) throw new BadRequestException('Una de las variantes no está disponible.');
        await this.inventory.decrement(
          tx, item.variantId, LocationType.BODEGA, dto.sourceWarehouseId, item.quantity,
        );
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            locationType: LocationType.BODEGA,
            locationId: dto.sourceWarehouseId,
            type: MovementType.TRANSFERENCIA_SALIDA,
            quantity: -item.quantity,
            userId: user.id,
            referenceType: 'TRANSFER',
            referenceId: created.id,
            reason: `Transferencia ${created.code} ${isThirdParty ? 'a tercero' : 'a sucursal'}`,
          },
        });
      }
      return created;
    });

    if (!isThirdParty) {
      await this.notifications.notifyTransferCreated(transfer);
    }
    return transfer;
  }

  async send(id: number, dto: any, user: any) {
    const t = await this.prisma.transfer.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Transferencia no encontrada.');
    if (t.status !== TransferStatus.PENDIENTE) {
      throw new BadRequestException('Solo se pueden enviar transferencias pendientes.');
    }
    return this.prisma.transfer.update({
      where: { id },
      data: { status: TransferStatus.ENVIADA, sentAt: new Date(), notes: dto.notes ?? t.notes },
    });
  }

  /**
   * Confirmación obligatoria de recepción en sucursal.
   * Registra diferencias (faltante/dañado) y actualiza inventario en destino.
   */
  async confirm(id: number, dto: any, user: any) {
    const t = await this.prisma.transfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!t) throw new NotFoundException('Transferencia no encontrada.');
    const sellerReceivingPendingTransfer =
      user.role === Role.VENDEDOR && t.status === TransferStatus.PENDIENTE;
    if (t.status !== TransferStatus.ENVIADA && !sellerReceivingPendingTransfer) {
      throw new BadRequestException('La transferencia no está en estado enviada.');
    }
    if (t.destinationType !== TransferDestinationType.SUCURSAL) {
      throw new BadRequestException('Solo las transferencias a sucursal requieren confirmación.');
    }
    this.assertBranchAccess(user, t.destinationBranchId);
    if (!t.destinationBranchId) throw new BadRequestException('La transferencia no tiene sucursal de destino válida.');
    if (dto.items.length !== t.items.length) {
      throw new BadRequestException('Debe registrar la recepción de todos los productos de la transferencia.');
    }
    if (new Set(dto.items.map((item: any) => item.transferItemId)).size !== dto.items.length) {
      throw new BadRequestException('No se puede registrar dos veces el mismo producto.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const conf of dto.items) {
        const item = t.items.find((i) => i.id === conf.transferItemId);
        if (!item) throw new BadRequestException('Ítem de transferencia inválido.');
        const damaged = conf.damagedQuantity ?? 0;
        const ok = conf.receivedQuantity - damaged;
        if (ok < 0 || conf.receivedQuantity > item.quantity) {
          throw new BadRequestException('La cantidad recibida o dañada es inválida.');
        }
        await tx.transferItem.update({
          where: { id: item.id },
          data: { receivedQuantity: conf.receivedQuantity, damagedQuantity: damaged },
        });
        if (ok > 0) {
          await this.inventory.increment(
            tx, item.variantId, LocationType.SUCURSAL, t.destinationBranchId, ok,
          );
          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              locationType: LocationType.SUCURSAL,
              locationId: t.destinationBranchId!,
              type: MovementType.TRANSFERENCIA_RECEPCION,
              quantity: ok,
              userId: user.id,
              referenceType: 'TRANSFER',
              referenceId: t.id,
              reason: `Recepción transferencia ${t.code}`,
            },
          });
        }
      }
      const receivedAt = new Date();
      return tx.transfer.update({
        where: { id },
        data: {
          status: sellerReceivingPendingTransfer ? TransferStatus.CERRADA : TransferStatus.RECIBIDA,
          receivedById: user.id,
          receivedAt,
          ...(sellerReceivingPendingTransfer ? { closedAt: receivedAt } : {}),
        },
        include: { items: true },
      });
    });

    await this.notifications.notifyTransferReceived(updated);
    for (const item of updated.items) {
      await this.inventory.checkAlert(item.variantId, LocationType.SUCURSAL, t.destinationBranchId!);
    }
    return updated;
  }

  async close(id: number, user: any) {
    const t = await this.prisma.transfer.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Transferencia no encontrada.');
    if (t.status !== TransferStatus.RECIBIDA) {
      throw new BadRequestException('Solo se cierran transferencias recibidas.');
    }
    return this.prisma.transfer.update({
      where: { id },
      data: { status: TransferStatus.CERRADA, closedAt: new Date() },
    });
  }
}
