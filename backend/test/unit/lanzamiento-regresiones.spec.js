const { database, admin, seller, manager, load } = require('../extended/mocks');
const { SalesService } = load('modules/sales/sales.service');
const { CashRegisterService } = load('modules/cash-register/cash-register.service');
const { ProductionService } = load('modules/production/production.service');
const { QuotationsService } = load('modules/quotations/quotations.service');
const { cashSummary } = load('modules/cash-register/cash-totals');

describe('Regresión de autorización por registro', () => {
  let db;
  beforeEach(() => { db = database(); });
  test.each([seller, manager])('cobro ajeno rechazado antes de registrar pagos %j', async user => {
    db.sale.findUnique.mockResolvedValue({ id: 1, sellerId: 99, locationType: 'SUCURSAL', locationId: 4, status: 'ACTIVA', pendingBalance: 50 });
    await expect(new SalesService(db, {}, {}).payBalance(1, { amount: 10 }, user)).rejects.toMatchObject({ status: 403 });
    expect(db.salePayment.create).not.toHaveBeenCalled(); expect(db.sale.update).not.toHaveBeenCalled();
  });
  test.each([seller, manager])('entrega ajena rechazada %j', async user => {
    db.sale.findUnique.mockResolvedValue({ id: 1, sellerId: 99, locationType: 'SUCURSAL', locationId: 4, status: 'ACTIVA' });
    await expect(new SalesService(db, {}, {}).markDelivered(1, user)).rejects.toMatchObject({ status: 403 });
    expect(db.sale.update).not.toHaveBeenCalled();
  });
  test.each([seller, manager])('caja ajena rechaza movimiento y cierre %j', async user => {
    db.cashShift.findUnique.mockResolvedValue({ id: 7, openedById: 99, branchId: 4, status: 'ABIERTA' });
    const service = new CashRegisterService(db);
    await expect(service.addMovement(7, 'SALIDA', 10, 'Gasto', user)).rejects.toMatchObject({ status: 403 });
    await expect(service.closeShift(7, 0, '', user)).rejects.toMatchObject({ status: 403 });
    expect(db.cashMovement.create).not.toHaveBeenCalled(); expect(db.cashShift.update).not.toHaveBeenCalled();
  });
  test('encargado sin sucursal no lista fabricación', async () => {
    await expect(new ProductionService(db).list({ role: 'ENCARGADO_SUCURSAL' })).rejects.toMatchObject({ status: 403 });
    expect(db.productionOrder.findMany).not.toHaveBeenCalled();
  });
  test('fabricación solicitada para sucursal ajena se rechaza', async () => {
    await expect(new ProductionService(db).create({ variantId: 1, branchId: 4 }, seller)).rejects.toMatchObject({ status: 403 });
    expect(db.productionOrder.create).not.toHaveBeenCalled();
  });
});

describe('Regresión de cobros y arqueos', () => {
  const shift = (payments, sales = []) => ({ initialCash: 0, payments, sales, movements: [] });
  test('anticipo efectivo 40 y saldo QR 60 conservan efectivo 40', () => {
    const result = cashSummary(shift([{ paymentMethod: 'EFECTIVO', amount: 40 }, { paymentMethod: 'QR', amount: 60 }]));
    expect(result).toMatchObject({ expectedCash: 40, totalCashSales: 40, totalQrSales: 60, totalSales: 100 });
  });
  test('el total vendido no duplica los pagos', () => {
    expect(cashSummary(shift([{ paymentMethod: 'EFECTIVO', amount: 40 }], [{ total: 100, amountPaid: 40, payments: [{ kind: 'INITIAL' }] }])).expectedCash).toBe(40);
  });
  test('cobro en un turno distinto se computa solo en ese turno', () => {
    expect(cashSummary(shift([{ paymentMethod: 'EFECTIVO', amount: 60 }])).expectedCash).toBe(60);
  });
  test('un registro antiguo sin desglose se marca para conciliación', () => {
    expect(cashSummary(shift([], [{ total: 100, amountPaid: 40, payments: [] }])).needsReconciliation).toBe(true);
  });
  test('caja histórica no puede cerrarse como si su estimación estuviera conciliada', async () => {
    const db = database(); db.cashShift.findUnique.mockResolvedValue({ ...shift([], [{ total: 100, payments: [] }]), status: 'ABIERTA' });
    await expect(new CashRegisterService(db).closeShift(1, 100, '', admin)).rejects.toMatchObject({ status: 400 });
    expect(db.cashShift.update).not.toHaveBeenCalled();
  });
  test.each([false, undefined])('cobrar no marca entrega con opción %s', async markDelivered => {
    const db = database(); db.sale.findUnique.mockResolvedValue({ id: 1, sellerId: 17, locationType: 'SUCURSAL', locationId: 3, status: 'ACTIVA', pendingBalance: 60, amountPaid: 40, deliveryStatus: 'PENDIENTE_ENTREGA' });
    const result = await new SalesService(db, {}, {}).payBalance(1, { amount: 60, paymentMethod: 'QR', markDelivered }, seller);
    expect(result.deliveryStatus).toBe('PENDIENTE_ENTREGA');
    expect(db.salePayment.create.mock.calls[0][0].data).toMatchObject({ amount: 60, paymentMethod: 'QR', kind: 'BALANCE' });
    expect(db.cashMovement.create).not.toHaveBeenCalled();
  });
});

test('cotizaciones nuevas no reutilizan correlativo después de eliminar', async () => {
  const db = database(); const service = new QuotationsService(db);
  const dto = { clientName: 'QA', items: [{ variantId: 1, quantity: 1, unitPrice: 100 }] };
  const first = await service.create(dto, admin); const second = await service.create(dto, admin);
  expect(first.code).not.toEqual(second.code); expect(db.quotation.count).not.toHaveBeenCalled();
});
test('estado de cotización inválido no se persiste', async () => {
  const db = database(); db.quotation.findUnique.mockResolvedValue({ id: 1 });
  await expect(new QuotationsService(db).updateStatus(1, 'INVENTADO')).rejects.toMatchObject({ status: 400 });
  expect(db.quotation.update).not.toHaveBeenCalled();
});
