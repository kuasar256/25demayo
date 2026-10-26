import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface QuotationItemInput {
  variantId: number;
  quantity: number;
  unitPrice: number;
}

export interface CreateQuotationInput {
  clientId?: number;
  clientName: string;
  clientCi?: string;
  clientPhone?: string;
  clientEmail?: string;
  validDays?: number;
  notes?: string;
  items: QuotationItemInput[];
}

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    return `COT-${year}-${randomUUID().replace(/-/g, '').toUpperCase()}`;
  }

  async create(dto: CreateQuotationInput, user: any) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La cotización debe tener al menos un producto.');
    }

    const code = await this.generateCode();

    // Calcular subtotal de cada ítem y total
    const itemsData = dto.items.map((item) => {
      const subtotal = Math.round(item.quantity * item.unitPrice * 100) / 100;
      return {
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal,
      };
    });

    const total = itemsData.reduce((sum, it) => sum + it.subtotal, 0);

    return this.prisma.quotation.create({
      data: {
        code,
        clientId: dto.clientId || null,
        clientName: dto.clientName.trim(),
        clientCi: dto.clientCi?.trim() || null,
        clientPhone: dto.clientPhone?.trim() || null,
        clientEmail: dto.clientEmail?.trim() || null,
        validDays: dto.validDays || 15,
        status: 'PENDIENTE',
        notes: dto.notes?.trim() || null,
        total,
        createdById: user.id,
        items: {
          create: itemsData,
        },
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
  }

  async list(search?: string, status?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q, ...(process.env.DATABASE_URL?.startsWith('file:') ? {} : { mode: 'insensitive' as const }) } },
        { clientName: { contains: q, ...(process.env.DATABASE_URL?.startsWith('file:') ? {} : { mode: 'insensitive' as const }) } },
        { clientCi: { contains: q, ...(process.env.DATABASE_URL?.startsWith('file:') ? {} : { mode: 'insensitive' as const }) } },
      ];
    }

    return this.prisma.quotation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  async detail(id: number) {
    const quote = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        client: true,
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
    if (!quote) throw new NotFoundException('Cotización no encontrada.');
    return quote;
  }

  async updateStatus(id: number, status: string) {
    const quote = await this.prisma.quotation.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada.');

    if (!['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CONVERTIDA_A_VENTA'].includes(status)) throw new BadRequestException('Estado de cotización inválido.');

    return this.prisma.quotation.update({
      where: { id },
      data: { status },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }

  async delete(id: number) {
    const quote = await this.prisma.quotation.findUnique({ where: { id } });
    if (!quote) throw new NotFoundException('Cotización no encontrada.');
    return this.prisma.quotation.delete({ where: { id } });
  }
}
