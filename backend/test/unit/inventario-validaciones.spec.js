const { database, admin, factory, manager, load } = require('../extended/mocks');
const { InventoryService } = load('modules/inventory/inventory.service');

describe('Inventario: validación de destino y entradas inválidas', () => {
  let db, service;
  const entry = () => ({ variantId: 12, locationType: 'BODEGA', locationId: 2, quantity: 1, reason: 'Recuento' });
  beforeEach(() => {
    db = database();
    db.warehouse.findFirst.mockResolvedValue({ id: 2 });
    db.branch.findFirst.mockResolvedValue({ id: 3 });
    db.productVariant.findFirst.mockResolvedValue({ id: 12 });
    service = new InventoryService(db, {});
  });
  test.each(['registerEntry', 'adjust'])('%s rechaza ubicación inexistente/inactiva antes de mutar', async (method) => {
    db.warehouse.findFirst.mockResolvedValue(null);
    await expect(service[method](entry(), factory)).rejects.toMatchObject({ status: 400 });
    expect(db.stock.upsert).not.toHaveBeenCalled();
    expect(db.stockMovement.create).not.toHaveBeenCalled();
  });
  test.each(['registerEntry', 'adjust'])('%s rechaza variante inexistente o desactivada', async (method) => {
    db.productVariant.findFirst.mockResolvedValue(null);
    await expect(service[method](entry(), factory)).rejects.toMatchObject({ status: 400 });
    expect(db.productVariant.findFirst).toHaveBeenCalledWith({
      where: { id: 12, isActive: true, product: { isActive: true } }, select: { id: true },
    });
    expect(db.stock.upsert).not.toHaveBeenCalled();
    expect(db.stockMovement.create).not.toHaveBeenCalled();
  });
  test('ajuste de sucursal exige destino activo', async () => {
    db.branch.findFirst.mockResolvedValue(null);
    await expect(service.adjust({ ...entry(), locationType: 'SUCURSAL', locationId: 3 }, manager))
      .rejects.toMatchObject({ status: 400 });
    expect(db.stockMovement.create).not.toHaveBeenCalled();
  });
  test.each([0, 1.5, 2147483648, -2147483648])('ajuste inválido %s no inicia transacción', async (quantity) => {
    await expect(service.adjust({ ...entry(), quantity }, admin)).rejects.toMatchObject({ status: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each([42, {}, null, '   '])('motivo inválido %j produce 400, no 500', async (reason) => {
    await expect(service.adjust({ ...entry(), reason }, admin)).rejects.toMatchObject({ status: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each([0, -1, 1.5, 2147483648])('ingreso inválido %s no inicia transacción', async (quantity) => {
    await expect(service.registerEntry({ ...entry(), quantity }, factory)).rejects.toMatchObject({ status: 400 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test('stock y kárdex filtran por tipo aunque no se indique un ID', async () => {
    await service.stock({ locationType: 'SUCURSAL' }, admin);
    await service.movements({ locationType: 'SUCURSAL' }, admin);
    expect(db.stock.findMany.mock.calls[0][0].where).toEqual({ locationType: 'SUCURSAL' });
    expect(db.stockMovement.findMany.mock.calls[0][0].where).toEqual({ locationType: 'SUCURSAL' });
  });
});
