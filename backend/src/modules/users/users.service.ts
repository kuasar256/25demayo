import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Role } from '../../common/enums';
import { PaginatedResult, Pagination, paginatedResult } from '../../common/pagination';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

const HIERARCHY: Record<Role, number> = {
  ADMIN_GENERAL: 4,
  ADMIN: 3,
  ENCARGADO_FABRICA: 2,
  ENCARGADO_SUCURSAL: 2,
  VENDEDOR: 1,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(
    filters: { search?: string; isActive?: boolean; pagination?: Pagination } = {},
  ): Promise<any[] | PaginatedResult<any>> {
    const where: any = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { branch: { name: { contains: search } } },
      ];
    }
    const query = {
      where,
      select: {
        id: true, email: true, fullName: true, role: true,
        branchId: true, isActive: true, lastLoginAt: true, createdAt: true,
        branch: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
    } as const;
    if (!filters.pagination) return this.prisma.user.findMany(query);

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        ...query,
        skip: filters.pagination.skip,
        take: filters.pagination.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginatedResult(items, total, filters.pagination);
  }

  private assertCanManage(actor: { id?: number; role: Role }, targetRole: Role, targetId?: number) {
    // Solo ADMIN_GENERAL puede crear o gestionar a otros administradores
    if (HIERARCHY[targetRole] >= HIERARCHY.ADMIN && actor.role !== Role.ADMIN_GENERAL) {
      if (targetId !== undefined && actor.id === targetId) {
        return; // Un administrador puede editar sus propios datos
      }
      throw new ForbiddenException('Solo el administrador general gestiona administradores.');
    }
  }

  async create(dto: any, actor: { id: number; role: Role }) {
    this.assertCanManage(actor, dto.role);
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('El correo ya está registrado.');
    if (dto.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch) throw new BadRequestException('Sucursal no válida.');
    }
    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { ...dto, password },
      select: {
        id: true, email: true, fullName: true, role: true, branchId: true, isActive: true,
      },
    });
    return user;
  }

  async update(id: number, dto: any, actor: { id: number; role: Role }) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    if (target.role === Role.ADMIN_GENERAL && actor.id !== target.id) {
      throw new ForbiddenException('No puede modificar al administrador general.');
    }

    // Validar que el actor pueda gestionar al usuario con su rol actual
    this.assertCanManage(actor, target.role as Role, id);

    // Si se intenta cambiar el rol, validar también el nuevo rol asignado
    if (dto.role) {
      if (actor.id === id) {
        throw new ForbiddenException('No puede cambiar su propio rol.');
      }
      this.assertCanManage(actor, dto.role, id);
    }

    if (dto.branchId != null) {
      const branch = await this.prisma.branch.findUnique({ where: { id: dto.branchId } });
      if (!branch || !branch.isActive) throw new BadRequestException('Sucursal no válida o inactiva.');
    }

    const data: any = { ...dto };
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, email: true, fullName: true, role: true, branchId: true, isActive: true,
      },
    });
  }

  async setStatus(id: number, isActive: boolean, actor: { id: number; role: Role }) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Usuario no encontrado.');
    if (target.role === Role.ADMIN_GENERAL) {
      throw new ForbiddenException('No puede desactivar al administrador general.');
    }

    // Solo ADMIN_GENERAL puede cambiar el estado de otros administradores
    if (target.role === Role.ADMIN && actor.role !== Role.ADMIN_GENERAL) {
      throw new ForbiddenException('Solo el administrador general puede cambiar el estado de un administrador.');
    }

    if (actor.id === id && !isActive) {
      throw new BadRequestException('No puede desactivarse a sí mismo.');
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, fullName: true, isActive: true },
    });
  }

  async updateAvatar(id: number, avatarUrl?: string) {
    return this.prisma.user.update({
      where: { id },
      data: { avatarUrl },
      select: { id: true, email: true, fullName: true, avatarUrl: true, role: true, branchId: true },
    });
  }
}
