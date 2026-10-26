require('reflect-metadata');
const path = require('node:path');
const dist = process.env.TEST_DIST || path.resolve(__dirname, '../dist/src');
exports.load = (name) => require(path.join(dist, name));
exports.seller = { id: 17, role: 'VENDEDOR', branchId: 3 };
exports.saleDto = () => ({
  locationType: 'SUCURSAL', locationId: 3,
  clientCi: '7654321', clientName: 'Ana Pérez',
  items: [{ variantId: 12, quantity: 2, expectedUnitPrice: 500 }],
});
exports.saleFixture = () => {
  const client = { id: 5, ci: '7654321', fullName: 'Ana Pérez', phone: '70000000' };
  const tx = {
    client: { findUnique: jest.fn().mockResolvedValue(client), create: jest.fn() },
    productVariant: { findUnique: jest.fn().mockResolvedValue({
      id: 12, sku: 'COL-12', price: 500, isActive: true, product: { isActive: true },
    }) },
    salePayment: { create: jest.fn() },
    cashShift: { findFirst: jest.fn().mockResolvedValue(null) },
    sale: { create: jest.fn().mockImplementation(async ({ data }) => ({
      id: 81, ...data, client, items: data.items.create,
    })) },
    stockMovement: { create: jest.fn().mockImplementation(async ({ data }) => data) },
  };
  const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) };
  const inventory = { decrement: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn(), checkAlert: jest.fn().mockResolvedValue(undefined) };
  const { SalesService } = exports.load('modules/sales/sales.service');
  return { client, tx, prisma, inventory, service: new SalesService(prisma, inventory, {}) };
};
