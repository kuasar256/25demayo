const { load } = require('../helpers');
const methods = ['findMany', 'findUnique', 'findFirst', 'findUniqueOrThrow', 'create',
  'createMany', 'update', 'updateMany', 'upsert', 'count', 'aggregate', 'delete', 'groupBy'];
function database() {
  const db = {};
  for (const name of ['user','branch','warehouse','category','product','productVariant','stock',
    'stockMovement','sale','salePayment','saleItem','cashShift','cashMovement','transfer','transferItem',
    'productionOrder','quotation','client','thirdParty','notification','auditLog']) {
    db[name] = {};
    for (const method of methods) db[name][method] = jest.fn();
    db[name].findMany.mockResolvedValue([]);
    db[name].count.mockResolvedValue(0);
    db[name].create.mockImplementation(async ({ data }) => ({ id: 50, ...data }));
    db[name].update.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
    db[name].updateMany.mockResolvedValue({ count: 1 });
    db[name].createMany.mockResolvedValue({ count: 1 });
  }
  db.$transaction = jest.fn(async (fn) => fn(db));
  return db;
}
const admin = { id: 1, role: 'ADMIN_GENERAL', fullName: 'Administrador' };
const seller = { id: 17, role: 'VENDEDOR', branchId: 3 };
const manager = { id: 21, role: 'ENCARGADO_SUCURSAL', branchId: 3 };
const factory = { id: 22, role: 'ENCARGADO_FABRICA' };
const page = { page: 1, pageSize: 10, skip: 0 };
module.exports = { database, admin, seller, manager, factory, page, load };
