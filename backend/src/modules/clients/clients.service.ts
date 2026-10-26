import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LocationType, Role } from '../../common/enums';
import { PaginatedResult, Pagination, paginatedResult } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  /** Autocompletado: busca por CI exacto o parcial */
  searchByCi(ci: string) {
    if (!ci.trim()) return [];
    return this.prisma.client.findMany({
      where: { ci: { contains: ci.trim() } },
      select: { id: true, ci: true, fullName: true, phone: true },
      take: 10,
    });
  }

  async list(search?: string, pagination?: Pagination): Promise<any[] | PaginatedResult<any>> {
    const normalizedSearch = search?.trim();
    const where = normalizedSearch
        ? { OR: [{ ci: { contains: normalizedSearch } }, { fullName: { contains: normalizedSearch } }] }
        : {};
    const query = {
      where,
      include: { _count: { select: { sales: true } } },
      orderBy: { id: 'desc' },
    } as const;
    if (!pagination) {
      return this.prisma.client.findMany({ ...query, take: 100 });
    }

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({ ...query, skip: pagination.skip, take: pagination.pageSize }),
      this.prisma.client.count({ where }),
    ]);
    return paginatedResult(items, total, pagination);
  }

  async detail(id: number, user: any) {
    const salesWhere: any = {};
    if (user.role === Role.VENDEDOR) {
      salesWhere.sellerId = user.id;
    } else if (user.role === Role.ENCARGADO_SUCURSAL) {
      if (!user.branchId) throw new ForbiddenException('Usuario sin sucursal asignada.');
      salesWhere.locationType = LocationType.SUCURSAL;
      salesWhere.locationId = user.branchId;
    }

    const c = await this.prisma.client.findUnique({
      where: { id },
      include: {
        sales: {
          where: salesWhere,
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { items: { include: { variant: { include: { product: true } } } } },
        },
      },
    });
    if (!c) throw new NotFoundException('Cliente no encontrado.');
    return c;
  }

  /** Crea o actualiza según CI (siempre identificado por CI) */
  async upsert(dto: { ci: string; fullName: string; phone?: string }) {
    return this.prisma.client.upsert({
      where: { ci: dto.ci },
      create: dto,
      update: { fullName: dto.fullName, phone: dto.phone },
    });
  }

  async update(id: number, dto: { ci?: string; fullName?: string; phone?: string }) {
    const c = await this.prisma.client.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Cliente no encontrado.');

    const cleanData: any = {};
    if (dto.fullName !== undefined) cleanData.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) cleanData.phone = dto.phone ? dto.phone.trim() : null;

    if (dto.ci !== undefined) {
      const cleanCi = dto.ci.trim();
      if (!cleanCi) throw new ConflictException('El CI no puede estar vacío.');
      if (cleanCi !== c.ci) {
        const existing = await this.prisma.client.findUnique({ where: { ci: cleanCi } });
        if (existing && existing.id !== id) {
          throw new ConflictException(`Ya existe otro cliente registrado con el CI ${cleanCi}.`);
        }
        cleanData.ci = cleanCi;
      }
    }

    return this.prisma.client.update({ where: { id }, data: cleanData });
  }

  thirdParties(type?: string, category?: string) {
    const where: any = { isActive: true };
    if (type) where.type = type;
    if (category) where.category = category;

    return this.prisma.thirdParty.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  createThirdParty(dto: any) {
    return this.prisma.thirdParty.create({ data: dto });
  }

  async updateThirdParty(id: number, dto: any) {
    const tp = await this.prisma.thirdParty.findUnique({ where: { id } });
    if (!tp) throw new NotFoundException('Tercero no encontrado.');
    return this.prisma.thirdParty.update({ where: { id }, data: dto });
  }
}
