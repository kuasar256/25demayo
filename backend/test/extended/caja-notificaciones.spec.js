const { database, admin, seller, manager, load } = require('./mocks');
const { CashRegisterService } = load('modules/cash-register/cash-register.service');
const { NotificationsService } = load('modules/notifications/notifications.service');
const shift = () => ({ id: 5, openedById: 17, branchId: 3, status: 'ABIERTA', initialCash: 100,
  sales: [{ payments:[{kind:'INITIAL'}], total: 50, paymentMethod: 'EFECTIVO' }, { payments:[{kind:'INITIAL'}], total: 20 },
    { payments:[{kind:'INITIAL'}], total: 30, paymentMethod: 'QR' }, { payments:[{kind:'INITIAL'}], total: 40, paymentMethod: 'TARJETA' },
    { payments:[{kind:'INITIAL'}], total: 10, paymentMethod: 'MIXTO' }],
  payments: [{amount:50,paymentMethod:'EFECTIVO'},{amount:20,paymentMethod:'EFECTIVO'},{amount:30,paymentMethod:'QR'},{amount:40,paymentMethod:'TARJETA'},{amount:10,paymentMethod:'MIXTO'}],
  movements: [{ type: 'ENTRADA', amount: 25 }, { type: 'SALIDA', amount: 15 }] });
describe('Caja: conciliación y movimientos', () => {
  let db, service;
  beforeEach(() => { db = database(); service = new CashRegisterService(db); });
  test.each([seller, manager, admin])('turno activo respeta ámbito %j y calcula resumen', async (user) => {
    db.cashShift.findFirst.mockResolvedValue(shift());
    const result = await service.getActiveShift(user);
    expect(db.cashShift.findFirst.mock.calls[0][0].where).toEqual({ status: 'ABIERTA',
      ...(user.role !== 'VENDEDOR' && user.branchId ? { branchId: 3 } : { openedById: user.id }) });
    expect(result.summary).toEqual({ initialCash: 100, totalCashSales: 70, totalQrSales: 30,
      totalCardSales: 40, totalOtherSales: 10, totalSales: 150, salesCount: 5,
      totalInflow: 25, totalOutflow: 15, expectedCash: 180, needsReconciliation: false });
  });
  test('sin turno devuelve null', async () => {
    expect(await service.getActiveShift(seller)).toBeNull();
  });
  test('rechaza apertura negativa y apertura duplicada', async () => {
    await expect(service.openShift(-1, seller)).rejects.toMatchObject({ status: 400 });
    db.cashShift.findFirst.mockResolvedValue(shift());
    await expect(service.openShift(100, seller)).rejects.toMatchObject({ status: 400 });
    expect(db.cashShift.create).not.toHaveBeenCalled();
  });
  test.each([[0, admin], [100, seller]])('abre caja con %i y usuario %j', async (cash, user) => {
    expect(await service.openShift(cash, user)).toMatchObject({ initialCash: cash,
      openedById: user.id, branchId: user.branchId ?? null, status: 'ABIERTA' });
  });
  test.each([
    [null, 10, 'Gasto', 404], [{ openedById:17,branchId:3,status: 'CERRADA' }, 10, 'Gasto', 400],
    [{ openedById:17,branchId:3,status: 'ABIERTA' }, 0, 'Gasto', 400], [{ openedById:17,branchId:3,status: 'ABIERTA' }, 10, ' ', 400],
    [{ openedById:17,branchId:3,status: 'ABIERTA' }, 10, undefined, 400],
  ])('movimiento inválido no escribe: %j %i %s', async (current, amount, reason, status) => {
    db.cashShift.findUnique.mockResolvedValue(current);
    await expect(service.addMovement(5, 'SALIDA', amount, reason, seller)).rejects.toMatchObject({ status });
    expect(db.cashMovement.create).not.toHaveBeenCalled();
  });
  test('registra salida con motivo normalizado', async () => {
    db.cashShift.findUnique.mockResolvedValue(shift());
    expect(await service.addMovement(5, 'SALIDA', 10, ' Transporte ', seller))
      .toMatchObject({ cashShiftId: 5, type: 'SALIDA', amount: 10, reason: 'Transporte' });
  });
  test.each([null, { openedById:17,branchId:3,status: 'CERRADA' }])('rechaza cierre inexistente o repetido %j', async (current) => {
    db.cashShift.findUnique.mockResolvedValue(current);
    await expect(service.closeShift(5, 180, '', seller)).rejects.toMatchObject({ status: current ? 400 : 404 });
    expect(db.cashShift.update).not.toHaveBeenCalled();
  });
  test.each([undefined, ' Arqueo '])('cierre calcula efectivo y diferencia con nota %s', async (notes) => {
    db.cashShift.findUnique.mockResolvedValue(shift());
    expect(await service.closeShift(5, 175, notes, seller)).toMatchObject({ status: 'CERRADA',
      closedById: 17, closedAt: expect.any(Date), expectedCash: 180, actualCash: 175,
      difference: -5, notes: notes ? 'Arqueo' : null });
  });
  test.each([seller, manager, admin])('historial por alcance %j', async (user) => {
    await service.listHistory(user);
    expect(db.cashShift.findMany.mock.calls[0][0].where).toEqual(user.role === 'VENDEDOR'
      ? { openedById: 17 } : user.branchId ? { branchId: 3 } : {});
  });
});
describe('Notificaciones: destinatarios y propiedad', () => {
  let db, service;
  const stock = { variant: { sku: 'COL-1', minStock: 3 }, quantity: 2, locationType: 'BODEGA', locationId: 2 };
  beforeEach(() => { db = database(); service = new NotificationsService(db); });
  test('sin destinatarios no escribe alertas', async () => {
    await service.notifyStockCritical(stock);
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });
  test('evita duplicar alertas sin leer y notifica solo pendientes', async () => {
    db.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    db.notification.findMany.mockResolvedValue([{ userId: 1 }]);
    await service.notifyStockCritical(stock);
    expect(db.notification.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({
      userId: 2, type: 'STOCK_CRITICO', message: 'COL-1 en BODEGA 2: 2 unidades (mínimo 3).',
    })]);
    db.notification.findMany.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
    await service.notifyStockCritical(stock);
    expect(db.notification.createMany).toHaveBeenCalledTimes(1);
  });
  test('transferencia a tercero no solicita notificaciones de sucursal', async () => {
    await service.notifyTransferCreated({ destinationBranchId: null });
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
  test('transferencia creada selecciona administradores y encargado de destino', async () => {
    db.user.findMany.mockResolvedValue([{ id: 1 }]);
    await service.notifyTransferCreated({ code: 'TRF-1', destinationBranchId: 3 });
    expect(db.user.findMany.mock.calls[0][0].where.OR[1].AND).toContainEqual({ branchId: 3 });
    expect(db.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({ userId: 1, type: 'TRANSFERENCIA_CREADA' });
  });
  test('recepción notifica fábrica y administradores', async () => {
    db.user.findMany.mockResolvedValue([{ id: 1 }]);
    await service.notifyTransferReceived({ code: 'TRF-1' });
    expect(db.user.findMany.mock.calls[0][0].where.role.in).toContain('ENCARGADO_FABRICA');
    expect(db.notification.createMany.mock.calls[0][0].data[0].message).toContain('TRF-1');
  });
  test.each([{ fullName: 'Ana' }, {}])('anulación incluye actor y motivo %j', async (actor) => {
    db.user.findMany.mockResolvedValue([{ id: 1 }]);
    await service.notifySaleCanceled({ code: 'VTA-1', cancelReason: 'Error' }, actor);
    expect(db.notification.createMany.mock.calls[0][0].data[0].message)
      .toBe(`Venta VTA-1 anulada por ${actor.fullName ?? 'usuario'}. Motivo: Error`);
  });
  test('consulta y marcado masivo se limitan al dueño', async () => {
    await service.myNotifications(17);
    await service.unreadCount(17);
    await service.markAllRead(17);
    expect(db.notification.findMany.mock.calls[0][0].where).toEqual({ userId: 17 });
    expect(db.notification.count).toHaveBeenCalledWith({ where: { userId: 17, isRead: false } });
    expect(db.notification.updateMany).toHaveBeenCalledWith({ where: { userId: 17, isRead: false }, data: { isRead: true } });
  });
  test('lectura individual exige dueño y es idempotente', async () => {
    expect(await service.markRead(17, 8)).toEqual({ success: true });
    expect(db.notification.updateMany.mock.calls[0][0].where).toEqual({ id: 8, userId: 17, isRead: false });
    db.notification.updateMany.mockResolvedValue({ count: 0 });
    db.notification.findFirst.mockResolvedValue({ id: 8 });
    expect(await service.markRead(17, 8)).toEqual({ success: true });
    db.notification.findFirst.mockResolvedValue(null);
    await expect(service.markRead(99, 8)).rejects.toMatchObject({ status: 404 });
  });
});
