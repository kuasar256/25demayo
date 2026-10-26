import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../../common/enums';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /** Notifica a admins + encargados de fábrica cuando hay stock crítico */
  async notifyStockCritical(stock: any) {
    const targets = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA] },
      },
      select: { id: true },
    });
    if (targets.length === 0) return;

    const messagePrefix = `${stock.variant.sku} en ${stock.locationType} ${stock.locationId}:`;
    const existingAlerts = await this.prisma.notification.findMany({
      where: {
        userId: { in: targets.map((user) => user.id) },
        type: 'STOCK_CRITICO',
        isRead: false,
        message: { startsWith: messagePrefix },
      },
      select: { userId: true },
    });
    const usersWithUnreadAlert = new Set(existingAlerts.map((notification) => notification.userId));
    const usersToNotify = targets.filter((user) => !usersWithUnreadAlert.has(user.id));
    if (usersToNotify.length === 0) return;

    await this.prisma.notification.createMany({
      data: usersToNotify.map((u) => ({
        userId: u.id,
        type: 'STOCK_CRITICO',
        title: 'Stock crítico',
        message: `${stock.variant.sku} en ${stock.locationType} ${stock.locationId}: ` +
          `${stock.quantity} unidades (mínimo ${stock.variant.minStock}).`,
      })),
    });
  }

  async notifyTransferCreated(transfer: any) {
    if (!transfer.destinationBranchId) return;
    const targets = await this.prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: { in: [Role.ADMIN_GENERAL, Role.ADMIN] } },
          {
            AND: [
              { role: Role.ENCARGADO_SUCURSAL },
              { branchId: transfer.destinationBranchId },
            ],
          },
        ],
      },
      select: { id: true },
    });
    await this.prisma.notification.createMany({
      data: targets.map((u) => ({
        userId: u.id,
        type: 'TRANSFERENCIA_CREADA',
        title: 'Nueva transferencia',
        message: `Transferencia ${transfer.code} creada hacia su sucursal.`,
      })),
    });
  }

  async notifyTransferReceived(transfer: any) {
    const targets = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_FABRICA] },
      },
      select: { id: true },
    });
    await this.prisma.notification.createMany({
      data: targets.map((u) => ({
        userId: u.id,
        type: 'TRANSFERENCIA_RECIBIDA',
        title: 'Transferencia recibida',
        message: `Transferencia ${transfer.code} fue recibida en sucursal.`,
      })),
    });
  }

  async notifySaleCanceled(sale: any, actor: any) {
    const targets = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: [Role.ADMIN_GENERAL, Role.ADMIN, Role.ENCARGADO_SUCURSAL] },
      },
      select: { id: true },
    });
    await this.prisma.notification.createMany({
      data: targets.map((u) => ({
        userId: u.id,
        type: 'VENTA_ANULADA',
        title: 'Venta anulada',
        message: `Venta ${sale.code} anulada por ${actor.fullName ?? 'usuario'}. Motivo: ${sale.cancelReason}`,
      })),
    });
  }

  myNotifications(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        isRead: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  unreadCount(userId: number) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  markAllRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async markRead(userId: number, notificationId: number) {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, isRead: false },
      data: { isRead: true },
    });

    if (result.count === 0) {
      const notification = await this.prisma.notification.findFirst({
        where: { id: notificationId, userId },
        select: { id: true },
      });
      if (!notification) {
        throw new NotFoundException('Notificación no encontrada.');
      }
    }

    return { success: true };
  }
}
