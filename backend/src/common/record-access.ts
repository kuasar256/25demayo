import { ForbiddenException } from '@nestjs/common';
import { LocationType, Role } from './enums';

export function assertSaleAccess(sale: any, user: any) {
  if ([Role.ADMIN_GENERAL, Role.ADMIN].includes(user.role)) return;
  if (user.role === Role.VENDEDOR && user.branchId && sale.sellerId === user.id
    && sale.locationType === LocationType.SUCURSAL && sale.locationId === user.branchId) return;
  if (user.role === Role.ENCARGADO_SUCURSAL && user.branchId
    && sale.locationType === LocationType.SUCURSAL && sale.locationId === user.branchId) return;
  throw new ForbiddenException('No puede modificar una venta fuera de su ámbito.');
}

export function assertCashShiftAccess(shift: any, user: any) {
  if ([Role.ADMIN_GENERAL, Role.ADMIN].includes(user.role)) return;
  if (user.role === Role.VENDEDOR && user.branchId && shift.openedById === user.id && shift.branchId === user.branchId) return;
  if (user.role === Role.ENCARGADO_SUCURSAL && user.branchId && shift.branchId === user.branchId) return;
  throw new ForbiddenException('No puede modificar la caja de otro usuario o sucursal.');
}
