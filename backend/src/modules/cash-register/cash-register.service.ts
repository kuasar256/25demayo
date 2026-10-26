import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertCashShiftAccess } from '../../common/record-access';
import { cashSummary } from './cash-totals';
import { PrismaService } from '../../prisma/prisma.service';
import { CashMovementType, CashShiftStatus, Role } from '../../common/enums';

@Injectable()
export class CashRegisterService {
  constructor(private prisma: PrismaService) {}

  /** Obtener el turno de caja activo para un usuario o sucursal */
  async getActiveShift(user: any) {
    const where: any = { status: CashShiftStatus.ABIERTA };
    if (user.role === Role.VENDEDOR) {
      where.openedById = user.id;
    } else if (user.branchId) {
      where.branchId = user.branchId;
    } else {
      where.openedById = user.id;
    }

    const shift = await this.prisma.cashShift.findFirst({
      where,
      include: {
        openedBy: { select: { id: true, fullName: true, email: true } },
        branch: { select: { id: true, name: true } },
        movements: { orderBy: { createdAt: 'desc' } },
        payments: { where: { sale: { status: 'ACTIVA' } } },
        sales: {
          where: { status: 'ACTIVA' },
          select: { id: true, code: true, total: true, amountPaid: true, paymentMethod: true, createdAt: true, payments: { select: { kind: true } } },
        },
      },
      orderBy: { openedAt: 'desc' },
    });

    if (!shift) return null;

    return { ...shift, summary: cashSummary(shift) };
  }

  /** Apertura de caja */
  async openShift(initialCash: number, user: any) {
    if (initialCash < 0) {
      throw new BadRequestException('El monto inicial no puede ser negativo.');
    }

    const existing = await this.getActiveShift(user);
    if (existing) {
      throw new BadRequestException('Ya existe un turno de caja abierto para esta sesión/sucursal.');
    }

    return this.prisma.cashShift.create({
      data: {
        branchId: user.branchId ?? null,
        openedById: user.id,
        initialCash: Number(initialCash) || 0,
        status: CashShiftStatus.ABIERTA,
      },
      include: {
        openedBy: { select: { id: true, fullName: true } },
        branch: true,
      },
    });
  }

  /** Registrar movimiento de caja chica (gasto / ingreso manual) */
  async addMovement(shiftId: number, type: 'ENTRADA' | 'SALIDA', amount: number, reason: string, user: any) {
    const shift = await this.prisma.cashShift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Turno de caja no encontrado.');
    assertCashShiftAccess(shift, user);
    if (shift.status !== CashShiftStatus.ABIERTA) {
      throw new BadRequestException('No se pueden registrar movimientos en una caja cerrada.');
    }

    if (amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0.');
    }
    if (!reason?.trim()) {
      throw new BadRequestException('El motivo del movimiento es obligatorio.');
    }

    return this.prisma.cashMovement.create({
      data: {
        cashShiftId: shiftId,
        type,
        amount: Number(amount),
        reason: reason.trim(),
      },
    });
  }

  /** Cierre de caja (Arqueo) */
  async closeShift(shiftId: number, actualCash: number, notes: string | undefined, user: any) {
    const shift = await this.prisma.cashShift.findUnique({
      where: { id: shiftId },
      include: {
        sales: { where: { status: 'ACTIVA' }, include: { payments: { select: { kind: true } } } },
        payments: { where: { sale: { status: 'ACTIVA' } } },
        movements: true,
      },
    });

    if (!shift) throw new NotFoundException('Turno de caja no encontrado.');
    assertCashShiftAccess(shift, user);
    if (shift.status !== CashShiftStatus.ABIERTA) {
      throw new BadRequestException('El turno de caja ya se encuentra cerrado.');
    }

    const summary = cashSummary(shift);
    if (summary.needsReconciliation) throw new BadRequestException('Esta caja contiene cobros históricos sin desglose. Debe conciliarlos antes de cerrar.');
    const expectedCash = summary.expectedCash;
    const difference = actualCash - expectedCash;

    return this.prisma.cashShift.update({
      where: { id: shiftId },
      data: {
        status: CashShiftStatus.CERRADA,
        closedById: user.id,
        closedAt: new Date(),
        expectedCash,
        actualCash: Number(actualCash),
        difference,
        notes: notes?.trim() || null,
      },
      include: {
        openedBy: { select: { id: true, fullName: true } },
        closedBy: { select: { id: true, fullName: true } },
        branch: true,
      },
    });
  }

  /** Historial de turnos de caja para reportes y supervisión */
  async listHistory(user: any) {
    const where: any = {};
    if (user.role === Role.VENDEDOR) {
      where.openedById = user.id;
    } else if (user.role === Role.ENCARGADO_SUCURSAL) {
      where.branchId = user.branchId;
    }

    return this.prisma.cashShift.findMany({
      where,
      include: {
        openedBy: { select: { id: true, fullName: true } },
        closedBy: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { sales: true, movements: true } },
      },
      orderBy: { openedAt: 'desc' },
      take: 50,
    });
  }
}
