const { load } = require('../helpers');
const { TransfersService } = load('modules/transfers/transfers.service');
const { InventoryService } = load('modules/inventory/inventory.service');

test('P4: crear transferencia descuenta la bodega y deja recepción pendiente', async () => {
  const tx = {
    warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 2 }) },
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 3 }) },
    productVariant: { findFirst: jest.fn().mockResolvedValue({ id: 12 }) },
    stock: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    stockMovement: { create: jest.fn() },
    transfer: { create: jest.fn(async ({ data }) => ({ id: 81, ...data, items: data.items.create })) },
  };
  const notifications = { notifyTransferCreated: jest.fn() };
  const service = new TransfersService({ $transaction: jest.fn(async (fn) => fn(tx)) },
    new InventoryService({}, {}), notifications);
  const result = await service.create({ sourceWarehouseId: 2, destinationType: 'SUCURSAL',
    destinationBranchId: 3, items: [{ variantId: 12, quantity: 2 }] }, { id: 1 });
  expect(tx.stock.updateMany).toHaveBeenCalledWith({
    where: { variantId: 12, locationType: 'BODEGA', locationId: 2, quantity: { gte: 2 } },
    data: { quantity: { decrement: 2 } },
  });
  expect(result).toMatchObject({ status: 'PENDIENTE', receivedAt: null, closedAt: null });
  expect(tx.stockMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    type: 'TRANSFERENCIA_SALIDA', quantity: -2, referenceId: 81,
  }) });
  expect(notifications.notifyTransferCreated).toHaveBeenCalledWith(result);
});

test.each(['PENDIENTE', 'ENVIADA'])('P5: no cierra transferencia %s sin recepción', async (status) => {
  const prisma = { transfer: {
    findUnique: jest.fn().mockResolvedValue({ id: 81, status, destinationType: 'SUCURSAL' }),
    update: jest.fn(),
  } };
  const service = new TransfersService(prisma, {}, {});
  await expect(service.close(81, { id: 1, role: 'ADMIN' })).rejects.toMatchObject({ status: 400 });
  expect(prisma.transfer.update).not.toHaveBeenCalled();
});

test('P5: confirma recepción en sucursal y posteriormente permite cerrar', async () => {
  let transfer = { id: 81, code: 'TRF-81', status: 'ENVIADA', destinationType: 'SUCURSAL',
    destinationBranchId: 3, items: [{ id: 9, variantId: 12, quantity: 2 }] };
  const transferRepo = {
    findUnique: jest.fn(async () => transfer),
    update: jest.fn(async ({ data }) => (transfer = { ...transfer, ...data })),
  };
  const tx = { transfer: transferRepo, transferItem: { update: jest.fn() },
    stockMovement: { create: jest.fn() } };
  const inventory = { increment: jest.fn(), checkAlert: jest.fn() };
  const service = new TransfersService({ transfer: transferRepo,
    $transaction: jest.fn(async (fn) => fn(tx)) }, inventory, { notifyTransferReceived: jest.fn() });
  const user = { id: 21, role: 'ENCARGADO_SUCURSAL', branchId: 3 };
  const received = await service.confirm(81, { items: [
    { transferItemId: 9, receivedQuantity: 2, damagedQuantity: 0 },
  ] }, user);
  expect(received).toMatchObject({ status: 'RECIBIDA', receivedById: 21, receivedAt: expect.any(Date) });
  expect(inventory.increment).toHaveBeenCalledWith(tx, 12, 'SUCURSAL', 3, 2);
  expect(tx.stockMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    type: 'TRANSFERENCIA_RECEPCION', quantity: 2, userId: 21,
    referenceType: 'TRANSFER', referenceId: 81,
  }) });
  expect(await service.close(81, { id: 1, role: 'ADMIN' }))
    .toMatchObject({ status: 'CERRADA', closedAt: expect.any(Date) });
});
