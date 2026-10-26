import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { LocationType, Role } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  categories() {
    return this.prisma.category.findMany({ where: { isActive: true } });
  }

  async createCategory(dto: { name: string }) {
    const exists = await this.prisma.category.findUnique({ where: { name: dto.name } });
    if (exists) throw new ConflictException('La categoría ya existe.');
    return this.prisma.category.create({ data: dto });
  }

  products(search?: string) {
    return this.prisma.product.findMany({
      where: search
        ? { OR: [
            { name: { contains: search } },
            { sku: { contains: search } },
            { variants: { some: { sku: { contains: search } } } },
          ] }
        : undefined,
      include: {
        category: true,
        variants: { where: { isActive: true } },
      },
      orderBy: { id: 'asc' },
    });
  }

  sellerCatalog(user: { role: string; branchId: number | null }) {
    if (user.role !== Role.VENDEDOR || !user.branchId) {
      throw new ForbiddenException('El vendedor debe tener una sucursal asignada.');
    }

    return this.prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        description: true,
        imageUrl: true,
        warrantySeal: true,
        category: { select: { name: true } },
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            size: true,
            type: true,
            color: true,
            height: true,
            price: true,
            warrantyYears: true,
            stocks: {
              where: {
                locationType: LocationType.SUCURSAL,
                locationId: user.branchId,
              },
              select: { quantity: true },
            },
          },
          orderBy: { size: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async product(id: number) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true, variants: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado.');
    return p;
  }

  async createProduct(dto: any) {
    const exists = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (exists) throw new ConflictException('El SKU ya existe.');
    const { variants, ...productData } = dto;
    return this.prisma.product.create({
      data: {
        ...productData,
        variants: variants?.length
          ? { create: variants.map(({ id: _id, ...variant }: any) => variant) }
          : undefined,
      },
      include: { variants: true },
    });
  }

  async updateProduct(id: number, dto: any) {
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async createVariant(dto: any) {
    const exists = await this.prisma.productVariant.findUnique({ where: { sku: dto.sku } });
    if (exists) throw new ConflictException('El SKU de variante ya existe.');
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Producto no encontrado.');
    return this.prisma.productVariant.create({ data: dto });
  }

  async updateVariant(id: number, dto: any) {
    if (dto.price != null && (!Number.isFinite(dto.price) || dto.price < 0)) throw new BadRequestException('Precio inválido.');
    const variant = await this.prisma.productVariant.findUnique({ where: { id } });
    if (!variant) throw new NotFoundException('Variante no encontrada.');
    return this.prisma.productVariant.update({ where: { id }, data: dto });
  }

  async syncProductVariants(productId: number, variants: any[]) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado.');

    return this.prisma.$transaction(async (tx) => {
      const currentVariants = await tx.productVariant.findMany({
        where: { productId, isActive: true },
        select: { id: true },
      });
      const currentIds = new Set(currentVariants.map((variant) => variant.id));
      const requestedIds = variants.flatMap((variant) => variant.id ? [variant.id] : []);

      if (requestedIds.some((id) => !currentIds.has(id))) {
        throw new NotFoundException('Una de las variantes no pertenece a este producto o ya no está activa.');
      }
      if (new Set(requestedIds).size !== requestedIds.length) {
        throw new ConflictException('No se puede guardar dos veces la misma variante.');
      }

      const removedIds = currentVariants
        .map((variant) => variant.id)
        .filter((id) => !requestedIds.includes(id));
      if (removedIds.length) {
        await tx.productVariant.updateMany({
          where: { productId, id: { in: removedIds } },
          data: { isActive: false },
        });
      }

      for (const variant of variants) {
        const { id, ...data } = variant;
        if (id) {
          await tx.productVariant.update({ where: { id }, data });
        } else {
          await tx.productVariant.create({
            data: { ...data, productId },
          });
        }
      }

      return tx.productVariant.findMany({ where: { productId, isActive: true } });
    });
  }
}
