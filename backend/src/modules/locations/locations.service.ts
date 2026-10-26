import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  warehouses() {
    return this.prisma.warehouse.findMany({
      where: { isActive: true },
      include: { _count: { select: { stocks: true } } },
    });
  }

  branches(user: any, includeInactive = false) {
    const isAdmin = user.role === Role.ADMIN_GENERAL || user.role === Role.ADMIN;
    if (includeInactive && !isAdmin) {
      throw new ForbiddenException('Solo los administradores pueden consultar sucursales inactivas.');
    }

    const where: any = includeInactive ? {} : { isActive: true };
    if (user.role === Role.ENCARGADO_SUCURSAL || user.role === Role.VENDEDOR) {
      if (!user.branchId) throw new ForbiddenException('Usuario sin sucursal asignada.');
      where.id = user.branchId;
    }
    return this.prisma.branch.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, stocks: true } },
      },
    });
  }

  createWarehouse(dto: { name: string }) {
    return this.prisma.warehouse.create({ data: dto });
  }

  createBranch(dto: any) {
    return this.prisma.branch.create({ data: dto });
  }

  async updateWarehouse(id: number, dto: any) {
    const w = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Bodega no encontrada.');
    return this.prisma.warehouse.update({ where: { id }, data: dto });
  }

  async updateBranch(id: number, dto: any) {
    const b = await this.prisma.branch.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Sucursal no encontrada.');
    return this.prisma.branch.update({ where: { id }, data: dto });
  }
}
