/**
 * Constantes que reemplazan los enums de Prisma (SQLite no soporta enums).
 * Importar desde aquí en lugar de @prisma/client.
 */

export const Role = {
  ADMIN_GENERAL: 'ADMIN_GENERAL',
  ADMIN: 'ADMIN',
  ENCARGADO_FABRICA: 'ENCARGADO_FABRICA',
  ENCARGADO_SUCURSAL: 'ENCARGADO_SUCURSAL',
  VENDEDOR: 'VENDEDOR',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const LocationType = {
  BODEGA: 'BODEGA',
  SUCURSAL: 'SUCURSAL',
} as const;
export type LocationType = (typeof LocationType)[keyof typeof LocationType];

export const MovementType = {
  INGRESO: 'INGRESO',
  AJUSTE_ENTRADA: 'AJUSTE_ENTRADA',
  AJUSTE_SALIDA: 'AJUSTE_SALIDA',
  VENTA: 'VENTA',
  ANULACION_VENTA: 'ANULACION_VENTA',
  TRANSFERENCIA_SALIDA: 'TRANSFERENCIA_SALIDA',
  TRANSFERENCIA_RECEPCION: 'TRANSFERENCIA_RECEPCION',
} as const;
export type MovementType = (typeof MovementType)[keyof typeof MovementType];

export const TransferStatus = {
  PENDIENTE: 'PENDIENTE',
  ENVIADA: 'ENVIADA',
  RECIBIDA: 'RECIBIDA',
  CERRADA: 'CERRADA',
} as const;
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export const TransferDestinationType = {
  SUCURSAL: 'SUCURSAL',
  TERCERO: 'TERCERO',
} as const;
export type TransferDestinationType = (typeof TransferDestinationType)[keyof typeof TransferDestinationType];

export const SaleStatus = {
  ACTIVA: 'ACTIVA',
  ANULADA: 'ANULADA',
} as const;
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

export const PaymentMethod = {
  EFECTIVO: 'EFECTIVO',
  QR: 'QR',
  TARJETA: 'TARJETA',
  MIXTO: 'MIXTO',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const CashShiftStatus = {
  ABIERTA: 'ABIERTA',
  CERRADA: 'CERRADA',
} as const;
export type CashShiftStatus = (typeof CashShiftStatus)[keyof typeof CashShiftStatus];

export const CashMovementType = {
  ENTRADA: 'ENTRADA',
  SALIDA: 'SALIDA',
} as const;
export type CashMovementType = (typeof CashMovementType)[keyof typeof CashMovementType];

export const PaymentType = {
  CONTADO: 'CONTADO',
  ANTICIPO: 'ANTICIPO',
} as const;
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType];

export const DeliveryStatus = {
  ENTREGADO: 'ENTREGADO',
  PENDIENTE_ENTREGA: 'PENDIENTE_ENTREGA',
} as const;
export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const ProductionStatus = {
  PENDIENTE: 'PENDIENTE',
  EN_PROCESO: 'EN_PROCESO',
  TERMINADO: 'TERMINADO',
  CANCELADO: 'CANCELADO',
} as const;
export type ProductionStatus = (typeof ProductionStatus)[keyof typeof ProductionStatus];

export const ProductionPriority = {
  BAJA: 'BAJA',
  NORMAL: 'NORMAL',
  ALTA: 'ALTA',
  URGENTE: 'URGENTE',
} as const;
export type ProductionPriority = (typeof ProductionPriority)[keyof typeof ProductionPriority];
