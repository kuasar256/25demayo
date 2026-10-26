require('reflect-metadata');

const assert = require('node:assert/strict');
const test = require('node:test');
const { ForbiddenException } = require('@nestjs/common');
const { ClientsService } = require('../dist/src/modules/clients/clients.service');
const { InventoryService } = require('../dist/src/modules/inventory/inventory.service');
const { LocationsService } = require('../dist/src/modules/locations/locations.service');
const { ReportsService } = require('../dist/src/modules/reports/reports.service');
const { ReportsController } = require('../dist/src/modules/reports/reports.controller');
const { SalesService } = require('../dist/src/modules/sales/sales.service');
const { SalesController } = require('../dist/src/modules/sales/sales.controller');
const { TransfersService } = require('../dist/src/modules/transfers/transfers.service');
const { UploadController } = require('../dist/src/modules/upload/upload.controller');
const { UsersService } = require('../dist/src/modules/users/users.service');
const { ROLES_KEY } = require('../dist/src/common/decorators/roles.decorator');
const { parsePagination } = require('../dist/src/common/pagination');

test('sales search and status filters retain seller access scope', async () => {
  let query;
  const service = new SalesService({
    sale: {
      findMany: async (args) => {
        query = args;
        return [];
      },
      count: async () => 0,
    },
  }, {}, {});

  await service.list(
    { id: 17, role: 'VENDEDOR', branchId: 3 },
    undefined,
    undefined,
    {
      search: '  Ana  ',
      status: 'ACTIVA',
      pagination: { page: 1, pageSize: 10, skip: 0 },
    },
  );

  assert.deepEqual(query.where, {
    status: 'ACTIVA',
    OR: [
      { code: { contains: 'Ana' } },
      { client: { fullName: { contains: 'Ana' } } },
      { client: { ci: { contains: 'Ana' } } },
      { seller: { fullName: { contains: 'Ana' } } },
    ],
    sellerId: 17,
  });
  assert.equal(query.take, 10);
});

test('transfer list filtering retains the destination-branch restriction', async () => {
  let query;
  const service = new TransfersService({
    transfer: {
      findMany: async (args) => {
        query = args;
        return [];
      },
      count: async () => 0,
    },
  }, {}, {});

  await service.list(
    { id: 17, role: 'ENCARGADO_SUCURSAL', branchId: 3 },
    'PENDIENTE',
    '  central ',
    { page: 1, pageSize: 10, skip: 0 },
  );

  assert.deepEqual(query.where, {
    status: 'PENDIENTE',
    OR: [
      { code: { contains: 'central' } },
      { sourceWarehouse: { name: { contains: 'central' } } },
      { destinationBranch: { name: { contains: 'central' } } },
      { thirdParty: { name: { contains: 'central' } } },
    ],
    destinationBranchId: 3,
  });
});

test('audit pagination uses bounded filters and an exclusive end date', async () => {
  let query;
  const service = new ReportsService({
    auditLog: {
      findMany: async (args) => {
        query = args;
        return [];
      },
      count: async () => 0,
    },
  });

  await service.audit(7, 'sales', '2026-10-01', '2026-10-15', {
    page: 2, pageSize: 25, skip: 25,
  });
  assert.deepEqual(query.where, {
    userId: 7,
    module: 'sales',
    createdAt: {
      gte: new Date('2026-10-01T00:00:00.000Z'),
      lt: new Date('2026-10-15T00:00:00.000Z'),
    },
  });
  assert.equal(query.skip, 25);
  assert.equal(query.take, 25);
});

test('audit endpoint rejects impossible dates and reversed ranges', () => {
  const controller = new ReportsController({});
  assert.throws(
    () => controller.audit(undefined, undefined, '2026-02-30'),
    (error) => error.getStatus() === 400,
  );
  assert.throws(
    () => controller.audit(undefined, undefined, '2026-10-16', '2026-10-15'),
    (error) => error.getStatus() === 400,
  );
});

test('pagination defaults safely, caps page size, and rejects malformed or overflowing requests', () => {
  assert.deepEqual(parsePagination('2', '50'), { page: 2, pageSize: 50, skip: 50 });
  assert.deepEqual(parsePagination(undefined, '10'), { page: 1, pageSize: 10, skip: 0 });
  assert.throws(() => parsePagination('0', '25'), (error) => error.getStatus() === 400);
  assert.throws(() => parsePagination('1', '101'), (error) => error.getStatus() === 400);
  assert.throws(() => parsePagination('9007199254740991', '100'), (error) => error.getStatus() === 400);
});

test('client pagination filters case-preserving search and includes total counts', async () => {
  let query;
  const service = new ClientsService({
    client: {
      findMany: async (args) => {
        query = args;
        return [{ id: 1, fullName: 'Cliente' }];
      },
      count: async ({ where }) => {
        assert.deepEqual(where, query.where);
        return 26;
      },
    },
  });

  const result = await service.list('  Ana  ', { page: 2, pageSize: 25, skip: 25 });

  assert.deepEqual(query.where, {
    OR: [{ ci: { contains: 'Ana' } }, { fullName: { contains: 'Ana' } }],
  });
  assert.equal(query.skip, 25);
  assert.equal(query.take, 25);
  assert.deepEqual(result, {
    items: [{ id: 1, fullName: 'Cliente' }],
    total: 26,
    page: 2,
    pageSize: 25,
    totalPages: 2,
  });
});

test('inventory pagination keeps branch scope and applies product search before counting', async () => {
  let stockQuery;
  let movementQuery;
  const service = new InventoryService({
    stock: {
      findMany: async (args) => {
        stockQuery = args;
        return [{ id: 1, quantity: 3 }];
      },
      count: async ({ where }) => {
        assert.deepEqual(where, stockQuery.where);
        return 1;
      },
    },
    stockMovement: {
      findMany: async (args) => {
        movementQuery = args;
        return [{ id: 4, reason: 'Reposición' }];
      },
      count: async ({ where }) => {
        assert.deepEqual(where, movementQuery.where);
        return 1;
      },
    },
  }, {});

  const pagination = { page: 1, pageSize: 10, skip: 0 };
  const stock = await service.stock({ search: 'Colchón' }, {
    id: 7, role: 'VENDEDOR', branchId: 3,
  }, pagination);
  assert.deepEqual(stockQuery.where, {
    locationType: 'SUCURSAL',
    locationId: 3,
    variant: {
      OR: [
        { sku: { contains: 'Colchón' } },
        { product: { name: { contains: 'Colchón' } } },
        { size: { contains: 'Colchón' } },
      ],
    },
  });
  assert.equal(stock.total, 1);

  const movements = await service.movements({ search: 'Reposición' }, {
    id: 7, role: 'VENDEDOR', branchId: 3,
  }, pagination);
  assert.deepEqual(movementQuery.where, {
    locationType: 'SUCURSAL',
    locationId: 3,
    OR: [
      { variant: { sku: { contains: 'Reposición' } } },
      { variant: { product: { name: { contains: 'Reposición' } } } },
      { reason: { contains: 'Reposición' } },
      { user: { fullName: { contains: 'Reposición' } } },
    ],
  });
  assert.equal(movements.total, 1);
});

test('an administrator cannot change their own role but can edit their profile', async () => {
  const service = new UsersService({
    user: {
      findUnique: async () => ({ id: 5, role: 'ADMIN' }),
      update: async ({ data }) => data,
    },
  });

  await assert.rejects(
    service.update(5, { role: 'ADMIN_GENERAL' }, { id: 5, role: 'ADMIN' }),
    (error) => error instanceof ForbiddenException && error.getStatus() === 403,
  );
  assert.equal(
    (await service.update(5, { fullName: 'Administrador' }, { id: 5, role: 'ADMIN' })).fullName,
    'Administrador',
  );
});

test('sales read endpoints exclude factory staff at the API boundary', () => {
  const allowedRoles = ['ADMIN_GENERAL', 'ADMIN', 'ENCARGADO_SUCURSAL', 'VENDEDOR'];

  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, SalesController.prototype.list), allowedRoles);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, SalesController.prototype.detail), allowedRoles);
});

test('image upload is restricted to product managers', () => {
  assert.deepEqual(
    Reflect.getMetadata(ROLES_KEY, UploadController.prototype.uploadImage),
    ['ADMIN_GENERAL', 'ADMIN'],
  );
});

test('client purchase history is restricted to the requesting seller', async () => {
  let query;
  const service = new ClientsService({
    client: {
      findUnique: async (args) => {
        query = args;
        return { id: 3, sales: [] };
      },
    },
  });

  await service.detail(3, { id: 17, role: 'VENDEDOR' });

  assert.deepEqual(query.include.sales.where, { sellerId: 17 });
});

test('branch staff only receives their assigned branch', async () => {
  let query;
  const service = new LocationsService({
    branch: {
      findMany: async (args) => {
        query = args;
        return [];
      },
    },
  });

  await service.branches({ id: 17, role: 'VENDEDOR', branchId: 4 });
  assert.deepEqual(query.where, { isActive: true, id: 4 });
  assert.throws(
    () => service.branches({ id: 17, role: 'VENDEDOR', branchId: null }),
    (error) => error.getStatus() === 403,
  );
});

test('inactive branches are available only to administrators when explicitly requested', async () => {
  let query;
  const service = new LocationsService({
    branch: {
      findMany: async (args) => {
        query = args;
        return [];
      },
    },
  });

  await service.branches({ id: 2, role: 'ADMIN' }, true);
  assert.deepEqual(query.where, {});

  await service.branches({ id: 2, role: 'ENCARGADO_FABRICA' });
  assert.deepEqual(query.where, { isActive: true });

  assert.throws(
    () => service.branches({ id: 17, role: 'VENDEDOR', branchId: 4 }, true),
    (error) => error.getStatus() === 403,
  );
});

test('factory dashboard metrics query warehouse sales', async () => {
  const saleFilters = [];
  const service = new ReportsService({
    sale: {
      aggregate: async ({ where }) => {
        saleFilters.push(where);
        return { _sum: { total: 0 }, _count: 0 };
      },
      findMany: async () => [],
    },
    stock: { findMany: async () => [] },
    transfer: { count: async () => 0 },
    saleItem: { findMany: async () => [] },
  });

  await service.dashboard({ id: 2, role: 'ENCARGADO_FABRICA', branchId: null });

  assert.equal(saleFilters.length, 2);
  assert.ok(saleFilters.every((where) => (
    where.locationType === 'BODEGA' && !Object.hasOwn(where, 'locationId')
  )));
});

test('transfer creation links stock movements and rejects inconsistent destinations', async () => {
  const movements = [];
  const tx = {
    warehouse: { findFirst: async () => ({ id: 2 }) },
    branch: { findFirst: async () => ({ id: 4 }) },
    thirdParty: { findFirst: async () => ({ id: 9 }) },
    transfer: { create: async () => ({ id: 81, code: 'TRF-TEST', items: [] }) },
    productVariant: { findFirst: async () => ({ id: 12 }) },
    stockMovement: { create: async ({ data }) => movements.push(data) },
  };
  const service = new TransfersService(
    { $transaction: async (run) => run(tx) },
    { decrement: async () => undefined },
    { notifyTransferCreated: async () => undefined },
  );

  const transfer = await service.create({
    sourceWarehouseId: 2,
    destinationType: 'SUCURSAL',
    destinationBranchId: 4,
    items: [{ variantId: 12, quantity: 2 }],
  }, { id: 1 });

  assert.equal(movements[0].referenceId, transfer.id);
  await assert.rejects(
    service.create({
      sourceWarehouseId: 2,
      destinationType: 'SUCURSAL',
      destinationBranchId: 4,
      thirdPartyId: 9,
      items: [{ variantId: 12, quantity: 1 }],
    }, { id: 1 }),
    (error) => error.getStatus() === 400,
  );
  await assert.rejects(
    service.create({
      sourceWarehouseId: 2,
      destinationType: 'SUCURSAL',
      destinationBranchId: 4,
      items: [{ variantId: 12, quantity: 1 }, { variantId: 12, quantity: 1 }],
    }, { id: 1 }),
    (error) => error.getStatus() === 400,
  );
});
