import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LocationType, MovementType, ProductionPriority, ProductionStatus, Role } from '../../common/enums';

@Injectable()
export class ProductionService {
  constructor(private prisma: PrismaService) {}

  private async nextCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.productionOrder.count();
    return `OF-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async list(user: any, filters: { branchId?: number; status?: string; priority?: string; search?: string } = {}) {
    const where: any = {};

    if (user.role === Role.VENDEDOR || user.role === Role.ENCARGADO_SUCURSAL) {
      if (!user.branchId) throw new ForbiddenException('Usuario sin sucursal asignada.');
      where.branchId = user.branchId;
    } else if (filters.branchId) {
      where.branchId = +filters.branchId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { code: { contains: s } },
        { customNotes: { contains: s } },
        { variant: { product: { name: { contains: s } } } },
        { sale: { client: { fullName: { contains: s } } } },
      ];
    }

    return this.prisma.productionOrder.findMany({
      where,
      include: {
        variant: {
          include: { product: true },
        },
        branch: true,
        warehouse: true,
        requestedBy: { select: { id: true, fullName: true, role: true } },
        assignedTo: { select: { id: true, fullName: true, role: true } },
        sale: {
          include: {
            client: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(
    dto: {
      variantId: number;
      quantity?: number;
      branchId?: number;
      warehouseId?: number;
      priority?: string;
      customNotes?: string;
      targetDate?: string;
      saleId?: number;
    },
    user: any,
  ) {
    if ([Role.VENDEDOR, Role.ENCARGADO_SUCURSAL].includes(user.role) &&
      (!user.branchId || (dto.branchId != null && dto.branchId !== user.branchId))) {
      throw new ForbiddenException('Solo puede solicitar fabricación para su sucursal.');
    }
    if (dto.priority && !Object.values(ProductionPriority).includes(dto.priority as any)) throw new BadRequestException('Prioridad inválida.');
    if (dto.targetDate && Number.isNaN(new Date(dto.targetDate).getTime())) throw new BadRequestException('Fecha objetivo inválida.');
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { product: true },
    });
    if (!variant) throw new NotFoundException('Variante de producto no encontrada.');

    const code = await this.nextCode();
    const branchId = dto.branchId || user.branchId || null;

    return this.prisma.productionOrder.create({
      data: {
        code,
        variantId: dto.variantId,
        quantity: dto.quantity && dto.quantity > 0 ? dto.quantity : 1,
        branchId,
        warehouseId: dto.warehouseId || null,
        requestedById: user.id,
        status: ProductionStatus.PENDIENTE,
        priority: dto.priority || ProductionPriority.NORMAL,
        customNotes: dto.customNotes?.trim() || null,
        saleId: dto.saleId || null,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      },
      include: {
        variant: { include: { product: true } },
        branch: true,
        requestedBy: { select: { fullName: true } },
      },
    });
  }

  async updateStatus(id: number, status: string, user: any) {
    const validStatuses = Object.values(ProductionStatus);
    if (!validStatuses.includes(status as any)) {
      throw new BadRequestException(`Estado inválido. Opciones: ${validStatuses.join(', ')}`);
    }

    const order = await this.prisma.productionOrder.findUnique({
      where: { id },
      include: { variant: true },
    });
    if (!order) throw new NotFoundException('Orden de fabricación no encontrada.');

    const isTerminado = status === ProductionStatus.TERMINADO;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productionOrder.update({
        where: { id },
        data: {
          status,
          completedAt: isTerminado ? new Date() : order.completedAt,
        },
        include: {
          variant: { include: { product: true } },
          branch: true,
          requestedBy: { select: { fullName: true } },
          assignedTo: { select: { fullName: true } },
          sale: { include: { client: true } },
        },
      });

      return updated;
    });
  }

  async assign(id: number, assignedToId: number | null, user: any) {
    const order = await this.prisma.productionOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Orden de fabricación no encontrada.');

    return this.prisma.productionOrder.update({
      where: { id },
      data: { assignedToId },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    });
  }
}
