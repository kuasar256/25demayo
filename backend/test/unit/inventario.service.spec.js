const { load, saleFixture, saleDto, seller } = require('../helpers');
const { InventoryService } = load('modules/inventory/inventory.service');

test('P1: la venta descuenta stock solo en la ubicación correspondiente', async () => {
  const f = saleFixture();
  // El servicio de inventario es real; solo Prisma está simulado.
  const rows = [
    { variantId: 12, locationType: 'SUCURSAL', locationId: 3, quantity: 10 },
    { variantId: 12, locationType: 'SUCURSAL', locationId: 4, quantity: 20 },
  ];
  f.tx.stock = { updateMany: jest.fn(async ({ where, data }) => {
    const row = rows.find((s) => s.variantId === where.variantId &&
      s.locationType === where.locationType && s.locationId === where.locationId &&
      s.quantity >= where.quantity.gte);
    if (!row) return { count: 0 };
    row.quantity -= data.quantity.decrement;
    return { count: 1 };
  }) };
  const inventory = new InventoryService({}, {});
  f.inventory.decrement.mockImplementation((...args) => inventory.decrement(...args));
  const sale = await f.service.create(saleDto(), seller);
  expect(rows.map((s) => s.quantity)).toEqual([8, 20]);
  expect(f.tx.stock.updateMany).toHaveBeenCalledWith({
    where: { variantId: 12, locationType: 'SUCURSAL', locationId: 3, quantity: { gte: 2 } },
    data: { quantity: { decrement: 2 } },
  });
  expect(sale.total).toBe(1000);
  expect(f.tx.stockMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    type: 'VENTA', quantity: -2, locationId: 3, referenceId: sale.id,
  }) });
});

test('P2: stock insuficiente rechaza la venta antes de persistirla', async () => {
  const f = saleFixture();
  f.tx.stock = { updateMany: jest.fn().mockResolvedValue({ count: 0 }) };
  const inventory = new InventoryService({}, {});
  f.inventory.decrement.mockImplementation((...args) => inventory.decrement(...args));
  await expect(f.service.create(saleDto(), seller)).rejects.toMatchObject({
    status: 400, message: 'Stock insuficiente para la operación.',
  });
  expect(f.tx.stock.updateMany).toHaveBeenCalledWith(expect.objectContaining({
    where: expect.objectContaining({ quantity: { gte: 2 } }),
  }));
  expect(f.tx.sale.create).not.toHaveBeenCalled();
  expect(f.tx.stockMovement.create).not.toHaveBeenCalled();
  expect(f.inventory.checkAlert).not.toHaveBeenCalled();
});

test('P3: ajuste con motivo incrementa stock y registra historial', async () => {
  const tx = {
    warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
    productVariant: { findFirst: jest.fn().mockResolvedValue({ id: 12 }) },
    stock: { upsert: jest.fn().mockResolvedValue({ quantity: 13 }) },
    stockMovement: { create: jest.fn(async ({ data }) => ({ id: 90, ...data })) },
  };
  const prisma = { $transaction: jest.fn(async (fn) => fn(tx)),
    stock: { findUnique: jest.fn().mockResolvedValue(null) } };
  const service = new InventoryService(prisma, {});
  const result = await service.adjust({ variantId: 12, locationType: 'BODEGA',
    locationId: 2, quantity: 3, reason: 'Recuento físico' }, { id: 1, role: 'ADMIN' });
  expect(tx.stock.upsert).toHaveBeenCalledWith({
    where: { variantId_locationType_locationId: { variantId: 12, locationType: 'BODEGA', locationId: 2 } },
    create: { variantId: 12, locationType: 'BODEGA', locationId: 2, quantity: 3 },
    update: { quantity: { increment: 3 } },
  });
  expect(result).toMatchObject({ id: 90, type: 'AJUSTE_ENTRADA', quantity: 3,
    reason: 'Recuento físico', userId: 1, referenceType: 'ADJUST' });
});

test('Complementaria: ajuste sin motivo no inicia transacción', async () => {
  const prisma = { $transaction: jest.fn() };
  const service = new InventoryService(prisma, {});
  await expect(service.adjust({ reason: '  ' }, { role: 'ADMIN' }))
    .rejects.toMatchObject({ status: 400 });
  expect(prisma.$transaction).not.toHaveBeenCalled();
});

test.each([2, 3])('Complementaria: stock %i con mínimo 3 genera alerta', async (quantity) => {
  const stock = { quantity, variant: { minStock: 3 } };
  const notifications = { notifyStockCritical: jest.fn() };
  const service = new InventoryService({ stock: {
    findUnique: jest.fn().mockResolvedValue(stock),
  } }, notifications);
  await service.checkAlert(12, 'SUCURSAL', 3);
  expect(notifications.notifyStockCritical).toHaveBeenCalledWith(stock);
});

test('Complementaria: stock superior al mínimo no genera alerta', async () => {
  const notifications = { notifyStockCritical: jest.fn() };
  const service = new InventoryService({ stock: { findUnique: jest.fn()
    .mockResolvedValue({ quantity: 4, variant: { minStock: 3 } }) } }, notifications);
  await service.checkAlert(12, 'SUCURSAL', 3);
  expect(notifications.notifyStockCritical).not.toHaveBeenCalled();
});
