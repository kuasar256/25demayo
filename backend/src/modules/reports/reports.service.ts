import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { LocationType, Role, SaleStatus, TransferStatus } from '../../common/enums';
import { PaginatedResult, Pagination, paginatedResult } from '../../common/pagination';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /** Dashboard adaptado por rol (doc 6.4.2) */
  async dashboard(user: any) {
    const isAdmin = user.role === Role.ADMIN_GENERAL || user.role === Role.ADMIN;
    const isFactory = user.role === Role.ENCARGADO_FABRICA;
    const isBranch = user.role === Role.ENCARGADO_SUCURSAL || user.role === Role.VENDEDOR;

    const result: any = {};

    // Ventas del día / mes
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const salesWhere: any = { status: SaleStatus.ACTIVA };
    if (isFactory) {
      salesWhere.locationType = LocationType.BODEGA;
    } else if (!isAdmin) {
      if (!user.branchId) throw new ForbiddenException('El usuario no tiene una sucursal asignada.');
      salesWhere.locationType = LocationType.SUCURSAL;
      salesWhere.locationId = user.branchId;
    }
    if (user.role === Role.VENDEDOR) salesWhere.sellerId = user.id;

    const [todaySales, monthSales] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { ...salesWhere, createdAt: { gte: dayStart } },
        _sum: { total: true }, _count: true,
      }),
      this.prisma.sale.aggregate({
        where: { ...salesWhere, createdAt: { gte: monthStart } },
        _sum: { total: true }, _count: true,
      }),
    ]);
    result.salesToday = { total: todaySales._sum.total ?? 0, count: todaySales._count };
    result.salesMonth = { total: monthSales._sum.total ?? 0, count: monthSales._count };

    // Stock crítico
    const criticalStocks = await this.prisma.stock.findMany({
      include: { variant: true },
    });
    result.criticalStock = criticalStocks
      .filter((s) => {
        if (isFactory) return s.locationType === LocationType.BODEGA;
        if (isBranch) return s.locationType === LocationType.SUCURSAL && s.locationId === user.branchId;
        return true;
      })
      .filter((s) => s.quantity <= s.variant.minStock)
      .map((s) => ({
        sku: s.variant.sku, product: s.variant.sku,
        locationType: s.locationType, locationId: s.locationId,
        quantity: s.quantity, minStock: s.variant.minStock,
      }));

    // Transferencias pendientes
    const pendingWhere: any = { status: { in: [TransferStatus.PENDIENTE, TransferStatus.ENVIADA] } };
    if (isBranch) pendingWhere.destinationBranchId = user.branchId;
    result.pendingTransfers = await this.prisma.transfer.count({ where: pendingWhere });

    // Chart: Sales by Branch (month)
    const salesMonthRows = await this.prisma.sale.findMany({
      where: { ...salesWhere, createdAt: { gte: monthStart } },
      include: { branch: true },
    });
    const byBranch = new Map<string, number>();
    for (const s of salesMonthRows) {
      const key = s.branch?.name ?? 'Fábrica Central';
      byBranch.set(key, (byBranch.get(key) ?? 0) + s.total);
    }
    result.salesByBranch = Array.from(byBranch.entries()).map(([name, total]) => ({ name, total }));

    // Chart: Top Products (month)
    const topItems = await this.prisma.saleItem.findMany({
      where: { sale: { ...salesWhere, createdAt: { gte: monthStart } } },
      select: {
        variantId: true,
        quantity: true,
        variant: {
          select: {
            size: true,
            product: { select: { name: true, imageUrl: true } },
          },
        },
      },
    });
    const grouped = new Map<number, { name: string; quantity: number; imageUrl: string | null }>();
    for (const item of topItems) {
      const key = item.variantId;
      const current = grouped.get(key) ?? {
        name: `${item.variant.product.name} ${item.variant.size}`,
        quantity: 0,
        imageUrl: item.variant.product.imageUrl,
      };
      current.quantity += item.quantity;
      grouped.set(key, current);
    }
    result.topProducts = Array.from(grouped.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    return result;
  }

  async salesByPeriod(
    user: any,
    from?: string,
    to?: string,
    locationId?: number,
    sellerId?: number,
    locationType?: string,
  ) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const firstOfMonth = `${today.slice(0, 8)}01`;
    const startDate = this.parseReportDate(from ?? firstOfMonth, 'Fecha inicial');
    const endDate = this.parseReportDate(to ?? today, 'Fecha final');
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);

    if (end <= start) {
      throw new BadRequestException('La fecha final debe ser igual o posterior a la fecha inicial.');
    }
    const duration = end.getTime() - start.getTime();
    if (duration > 366 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException('El periodo del reporte no puede superar 366 días.');
    }

    const where: any = { createdAt: { gte: start, lt: end } };
    if (user.role === Role.VENDEDOR) {
      if (!user.branchId) throw new ForbiddenException('El vendedor no tiene una sucursal asignada.');
      where.sellerId = user.id;
      where.locationType = LocationType.SUCURSAL;
      where.locationId = user.branchId;
    } else if (user.role === Role.ENCARGADO_SUCURSAL) {
      if (!user.branchId) throw new ForbiddenException('El encargado no tiene una sucursal asignada.');
      where.locationType = LocationType.SUCURSAL;
      where.locationId = user.branchId;
    } else if (user.role === Role.ENCARGADO_FABRICA) {
      where.locationType = LocationType.BODEGA;
    } else {
      if (locationType) where.locationType = locationType;
      if (locationId) where.locationId = locationId;
      if (sellerId) where.sellerId = sellerId;
    }

    const activeWhere = { ...where, status: SaleStatus.ACTIVA };
    const previousStart = new Date(start.getTime() - duration);
    const previousWhere = {
      ...where,
      status: SaleStatus.ACTIVA,
      createdAt: { gte: previousStart, lt: start },
    };
    const [sales, currentAggregate, canceledCount, previousAggregate] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        select: {
          id: true,
          code: true,
          status: true,
          total: true,
          createdAt: true,
          locationType: true,
          locationId: true,
          client: { select: { fullName: true } },
          seller: { select: { id: true, fullName: true } },
          branch: { select: { name: true } },
          items: {
            select: {
              quantity: true,
              unitPrice: true,
              unitCost: true,
              variant: {
                select: {
                  sku: true,
                  size: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sale.aggregate({
        where: activeWhere,
        _sum: { total: true },
        _count: { id: true },
      }),
      this.prisma.sale.count({
        where: { ...where, status: SaleStatus.ANULADA },
      }),
      this.prisma.sale.aggregate({
        where: previousWhere,
        _sum: { total: true },
        _count: { id: true },
      }),
    ]);

    const warehouseIds = Array.from(new Set(
      sales.filter((sale) => sale.locationType === LocationType.BODEGA).map((sale) => sale.locationId),
    ));
    const warehouses = warehouseIds.length
      ? await this.prisma.warehouse.findMany({
          where: { id: { in: warehouseIds } },
          select: { id: true, name: true },
        })
      : [];
    const warehouseNames = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));

    const activeSales = sales.filter((sale) => sale.status === SaleStatus.ACTIVA);
    const daily = new Map<string, { date: string; total: number; count: number }>();
    const branches = new Map<string, number>();
    const sellers = new Map<number, { id: number; name: string; total: number; count: number }>();
    const products = new Map<string, { sku: string; name: string; quantity: number; revenue: number }>();
    let units = 0;

    let totalCost = 0;

    for (const sale of activeSales) {
      const date = sale.createdAt.toISOString().slice(0, 10);
      const day = daily.get(date) ?? { date, total: 0, count: 0 };
      day.total += sale.total;
      day.count += 1;
      daily.set(date, day);

      const locationName = sale.locationType === LocationType.SUCURSAL
        ? sale.branch?.name ?? 'Sucursal'
        : warehouseNames.get(sale.locationId) ?? 'Bodega';
      branches.set(locationName, (branches.get(locationName) ?? 0) + sale.total);

      const seller = sellers.get(sale.seller.id) ?? {
        id: sale.seller.id, name: sale.seller.fullName, total: 0, count: 0,
      };
      seller.total += sale.total;
      seller.count += 1;
      sellers.set(sale.seller.id, seller);

      for (const item of sale.items) {
        const itemCost = (item.unitCost || 0) * item.quantity;
        totalCost += itemCost;

        const current = products.get(item.variant.sku) ?? {
          sku: item.variant.sku,
          name: `${item.variant.product.name} ${item.variant.size}`,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += item.quantity;
        current.revenue += item.unitPrice * item.quantity;
        units += item.quantity;
        products.set(item.variant.sku, current);
      }
    }

    const total = currentAggregate._sum.total ?? 0;
    const count = currentAggregate._count.id;
    const grossProfit = total - totalCost;
    const profitMargin = total > 0 ? (grossProfit / total) * 100 : 0;
    const previousTotal = previousAggregate._sum.total ?? 0;
    const previousCount = previousAggregate._count.id;
    const percentChange = (current: number, previous: number) =>
      previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100;
    const dailySeries: { date: string; total: number; count: number }[] = [];
    for (const day = new Date(start); day < end; day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10);
      dailySeries.push(daily.get(date) ?? { date, total: 0, count: 0 });
    }

    return {
      period: {
        from: startDate,
        to: endDate,
        previousFrom: previousStart.toISOString().slice(0, 10),
        previousTo: new Date(start.getTime() - 1).toISOString().slice(0, 10),
      },
      summary: {
        total,
        totalCost,
        grossProfit,
        profitMargin,
        count,
        averageTicket: count ? total / count : 0,
        units,
        canceledCount,
      },
      comparison: {
        totalPercent: percentChange(total, previousTotal),
        countPercent: percentChange(count, previousCount),
      },
      daily: dailySeries,
      byBranch: Array.from(branches, ([name, branchTotal]) => ({ name, total: branchTotal }))
        .sort((a, b) => b.total - a.total),
      bySeller: Array.from(sellers.values()).sort((a, b) => b.total - a.total),
      topProducts: Array.from(products.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 20),
      sales: sales.slice(0, 500).map((sale) => ({
        ...sale,
        locationName: sale.locationType === LocationType.SUCURSAL
          ? sale.branch?.name ?? 'Sucursal'
          : warehouseNames.get(sale.locationId) ?? 'Bodega',
      })),
    };
  }

  private parseReportDate(value: string, label: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${label} debe tener el formato YYYY-MM-DD.`);
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${label} no es válida.`);
    }
    return value;
  }

  async topProducts(user: any, limit = 10) {
    const where: any = { status: SaleStatus.ACTIVA };
    if (user.role === Role.ENCARGADO_SUCURSAL) {
      where.locationType = LocationType.SUCURSAL;
      where.locationId = user.branchId;
    }
    if (user.role === Role.VENDEDOR) {
      where.sellerId = user.id;
      where.locationType = LocationType.SUCURSAL;
      where.locationId = user.branchId;
    }
    if (user.role === Role.ENCARGADO_FABRICA) where.locationType = LocationType.BODEGA;

    const items = await this.prisma.saleItem.findMany({
      where: { sale: where },
      include: { variant: { include: { product: true } } },
    });

    const grouped = new Map<number, { name: string; sku: string; quantity: number; revenue: number }>();
    for (const item of items) {
      const key = item.variantId;
      const current = grouped.get(key) ?? {
        name: `${item.variant.product.name} ${item.variant.size}`,
        sku: item.variant.sku, quantity: 0, revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += item.unitPrice * item.quantity;
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  async transfers(status?: string) {
    return this.prisma.transfer.findMany({
      where: status ? { status: status as TransferStatus } : undefined,
      include: {
        sourceWarehouse: true,
        destinationBranch: true,
        thirdParty: true,
        items: true,
      },
      orderBy: { id: 'desc' },
      take: 200,
    });
  }

  async audit(
    userId?: number,
    module?: string,
    from?: string,
    to?: string,
    pagination?: Pagination,
  ): Promise<any[] | PaginatedResult<any>> {
    const where: any = {
      ...(userId ? { userId } : {}),
      ...(module ? { module } : {}),
      ...(from || to
        ? { createdAt: {
            ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
            ...(to ? { lt: new Date(`${to}T00:00:00.000Z`) } : {}),
          } }
        : {}),
    };
    const query = {
      where,
      include: { user: { select: { fullName: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    } as const;
    if (!pagination) return this.prisma.auditLog.findMany({ ...query, take: 500 });

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        ...query,
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginatedResult(items, total, pagination);
  }
}
