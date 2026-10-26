const { load, saleFixture, saleDto, seller } = require('../helpers');
const { ClientsService } = load('modules/clients/clients.service');
const { SalesService } = load('modules/sales/sales.service');

test('P6: consulta CI devuelve nombre y la venta reutiliza al cliente existente', async () => {
  const f = saleFixture();
  const prisma = { client: { findMany: jest.fn().mockResolvedValue([f.client]) } };
  const clients = new ClientsService(prisma);
  const matches = await clients.searchByCi(' 7654321 ');
  expect(prisma.client.findMany).toHaveBeenCalledWith({
    where: { ci: { contains: '7654321' } },
    select: { id: true, ci: true, fullName: true, phone: true }, take: 10,
  });
  expect(matches[0].fullName).toBe('Ana Pérez');
  const dto = { ...saleDto(), clientName: matches[0].fullName };
  const sale = await f.service.create(dto, seller);
  expect(f.tx.client.findUnique).toHaveBeenCalledWith({ where: { ci: '7654321' } });
  expect(f.tx.client.create).not.toHaveBeenCalled();
  expect(sale).toMatchObject({ clientId: 5, total: 1000 });
  // El cambio visual de los inputs React requiere prueba de componente independiente.
});

test('P7: vendedor no puede anular venta ajena ni restituir su stock', async () => {
  const prisma = {
    sale: { findUnique: jest.fn().mockResolvedValue({ id: 81, sellerId: 99,
      status: 'ACTIVA', createdAt: new Date(), items: [{ variantId: 12, quantity: 2 }] }) },
    $transaction: jest.fn(),
  };
  const inventory = { increment: jest.fn() };
  const notifications = { notifySaleCanceled: jest.fn() };
  const service = new SalesService(prisma, inventory, notifications);
  await expect(service.cancel(81, 'Error de registro', seller)).rejects.toMatchObject({
    status: 403, message: 'Un vendedor solo anula sus propias ventas.',
  });
  expect(prisma.$transaction).not.toHaveBeenCalled();
  expect(inventory.increment).not.toHaveBeenCalled();
  expect(notifications.notifySaleCanceled).not.toHaveBeenCalled();
});
