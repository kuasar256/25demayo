import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { LocationType, MovementType, Role } from '../../common/enums';
import { PaginatedResult, Pagination, paginatedResult } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Alcance por rol: ENCARGADO_SUCURSAL y VENDEDOR solo ven su sucursal.
   */
  private scopeFilter(user: any, q: any) {
    if (user.role === Role.ENCARGADO_SUCURSAL || user.role === Role.VENDEDOR) {
      if (!user.branchId) throw new ForbiddenException('Usuario sin sucursal asignada.');
      return { locationType: LocationType.SUCURSAL, locationId: user.branchId };
    }
    if (user.role === Role.ENCARGADO_FABRICA) {
      return { locationType: LocationType.BODEGA, ...(q.locationId ? { locationId: +q.locationId } : {}) };
    }
    if (q.locationType) {
      return { locationType: q.locationType, ...(q.locationId ? { locationId: +q.locationId } : {}) };
    }
    return {};
  }


  stock(q: any, user: any): Promise<any[]>;
  stock(q: any, user: any, pagination: Pagination): Promise<PaginatedResult<any>>;
  async stock(q: any, user: any, pagination?: Pagination): Promise<any[] | PaginatedResult<any>> {
    const scope = this.scopeFilter(user, q);
    const search = q.search?.trim();
    const where = {
      ...scope,
      ...(search
        ? { variant: {
            OR: [
              { sku: { contains: search } },
              { product: { name: { contains: search } } },
              { size: { contains: search } },
            ],
          } }
        : {}),
    };
    const query = {
      where,
      include: {
        variant: { include: { product: { include: { category: true } } } },
      },
      orderBy: { variantId: 'asc' },
    } as const;
    if (!pagination) return this.prisma.stock.findMany(query);
    const [items, total] = await Promise.all([
      this.prisma.stock.findMany({
        ...query,
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.stock.count({ where }),
    ]);
    return paginatedResult(items, total, pagination);
  }

  /** Stock crítico: quantity <= minStock */
  async critical(user: any) {
    const all = await this.stock({}, user);
    return all
      .filter((s) => s.quantity <= s.variant.minStock)
      .map((s) => ({ ...s, deficit: Math.max(0, s.variant.minStock - s.quantity) }));
  }

  async movements(
    q: any,
    user: any,
    pagination?: Pagination,
  ): Promise<any[] | PaginatedResult<any>> {
    const scope = this.scopeFilter(user, q);
    const search = q.search?.trim();
    const where = {
      ...scope,
      ...(q.variantId ? { variantId: q.variantId } : {}),
      ...(search
        ? {
            OR: [
              { variant: { sku: { contains: search } } },
              { variant: { product: { name: { contains: search } } } },
              { reason: { contains: search } },
              { user: { fullName: { contains: search } } },
            ],
          }
        : {}),
    };
    const query = {
      where,
      include: {
        variant: { include: { product: true } },
        user: { select: { fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    } as const;
    if (!pagination) return this.prisma.stockMovement.findMany({ ...query, take: 200 });
    const [items, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        ...query,
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return paginatedResult(items, total, pagination);
  }

  /** Descuento atómico con verificación de stock (evita race conditions). */
  async decrement(
    tx: any, variantId: number, locationType: string, locationId: number, quantity: number,
  ) {
    const res = await tx.stock.updateMany({
      where: { variantId, locationType, locationId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (res.count === 0) {
      throw new BadRequestException('Stock insuficiente para la operación.');
    }
  }

  async increment(
    tx: any, variantId: number, locationType: string, locationId: number, quantity: number,
  ) {
    await tx.stock.upsert({
      where: { variantId_locationType_locationId: { variantId, locationType, locationId } },
      create: { variantId, locationType, locationId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  private async validateStockTarget(tx: any, dto: any) {
    const location = dto.locationType === LocationType.BODEGA
      ? await tx.warehouse.findFirst({ where: { id: dto.locationId, isActive: true }, select: { id: true } })
      : await tx.branch.findFirst({ where: { id: dto.locationId, isActive: true }, select: { id: true } });
    if (!location) throw new BadRequestException('La ubicación no existe o está inactiva.');
    const variant = await tx.productVariant.findFirst({
      where: { id: dto.variantId, isActive: true, product: { isActive: true } },
      select: { id: true },
    });
    if (!variant) throw new BadRequestException('La variante no existe o está inactiva.');
  }

  async registerEntry(dto: any, user: any) {
    if (dto.locationType !== LocationType.BODEGA && user.role === Role.ENCARGADO_FABRICA) {
      throw new ForbiddenException('El encargado de fábrica solo registra en bodegas.');
    }
    if (!Number.isInteger(dto.quantity) || dto.quantity < 1 || dto.quantity > 2147483647) {
      throw new BadRequestException('La cantidad de ingreso debe ser un entero positivo válido.');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await this.validateStockTarget(tx, dto);
      await this.increment(tx, dto.variantId, dto.locationType, dto.locationId, dto.quantity);
      const movement = await tx.stockMovement.create({
        data: {
          variantId: dto.variantId,
          locationType: dto.locationType,
          locationId: dto.locationId,
          type: MovementType.INGRESO,
          quantity: dto.quantity,
          reason: dto.reason ?? 'Ingreso de producto terminado',
          userId: user.id,
          referenceType: 'ADJUST',
        },
      });
      return movement;
    });
    await this.checkAlert(dto.variantId, dto.locationType, dto.locationId);
    return result;
  }

  async adjust(dto: any, user: any) {
    if (typeof dto.reason !== 'string' || !dto.reason.trim()) {
      throw new BadRequestException('El motivo del ajuste es obligatorio.');
    }
    if (!Number.isInteger(dto.quantity) || dto.quantity === 0 || Math.abs(dto.quantity) > 2147483647) {
      throw new BadRequestException('La cantidad del ajuste debe ser un entero distinto de cero dentro del rango permitido.');
    }
    // Encargado de sucursal solo ajusta su sucursal
    if (user.role === Role.ENCARGADO_SUCURSAL) {
      if (dto.locationType !== LocationType.SUCURSAL || dto.locationId !== user.branchId) {
        throw new ForbiddenException('Solo puede ajustar stock de su sucursal.');
      }
    }
    // Encargado de fábrica solo ajusta bodegas
    if (user.role === Role.ENCARGADO_FABRICA) {
      if (dto.locationType !== LocationType.BODEGA) {
        throw new ForbiddenException('El encargado de fábrica solo puede ajustar stock de bodegas de fábrica.');
      }
    }

    const delta = dto.quantity; // >0 entrada, <0 salida
    const result = await this.prisma.$transaction(async (tx) => {
      await this.validateStockTarget(tx, dto);
      if (delta >= 0) {
        await this.increment(tx, dto.variantId, dto.locationType, dto.locationId, delta);
      } else {
        await this.decrement(tx, dto.variantId, dto.locationType, dto.locationId, -delta);
      }
      return tx.stockMovement.create({
        data: {
          variantId: dto.variantId,
          locationType: dto.locationType,
          locationId: dto.locationId,
          type: delta >= 0 ? MovementType.AJUSTE_ENTRADA : MovementType.AJUSTE_SALIDA,
          quantity: delta,
          reason: dto.reason,
          userId: user.id,
          referenceType: 'ADJUST',
        },
      });
    });
    await this.checkAlert(dto.variantId, dto.locationType, dto.locationId);
    return result;
  }

  /** Genera notificación si el stock bajó del mínimo. */
  async checkAlert(variantId: number, locationType: string, locationId: number) {
    const stock = await this.prisma.stock.findUnique({
      where: { variantId_locationType_locationId: { variantId, locationType, locationId } },
      include: { variant: { include: { product: true } } },
    });
    if (!stock) return;
    if (stock.quantity <= stock.variant.minStock) {
      await this.notifications.notifyStockCritical(stock);
    }
  }
}
