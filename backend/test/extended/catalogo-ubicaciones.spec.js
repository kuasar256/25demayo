const { database, admin, seller, manager, load } = require('./mocks');
const { CatalogService } = load('modules/catalog/catalog.service');
const { LocationsService } = load('modules/locations/locations.service');
describe('Catálogo: identidad, disponibilidad y sincronización de variantes', () => {
  let db, service;
  beforeEach(() => { db = database(); service = new CatalogService(db); });
  test('lista categorías activas', async () => {
    db.category.findMany.mockResolvedValue([{ name: 'Colchones' }]);
    expect(await service.categories()).toEqual([{ name: 'Colchones' }]);
    expect(db.category.findMany).toHaveBeenCalledWith({ where: { isActive: true } });
  });
  test('crea categoría nueva y rechaza duplicados', async () => {
    expect(await service.createCategory({ name: 'Catres' })).toMatchObject({ name: 'Catres' });
    db.category.findUnique.mockResolvedValue({ id: 2 });
    await expect(service.createCategory({ name: 'Catres' })).rejects.toMatchObject({ status: 409 });
    expect(db.category.create).toHaveBeenCalledTimes(1);
  });
  test.each([undefined, 'COL'])('consulta productos con búsqueda %s', async (search) => {
    await service.products(search);
    const query = db.product.findMany.mock.calls[0][0];
    expect(query.include.variants.where).toEqual({ isActive: true });
    expect(query.where).toEqual(search ? { OR: [
      { name: { contains: search } }, { sku: { contains: search } },
      { variants: { some: { sku: { contains: search } } } },
    ] } : undefined);
  });
  test.each([{ role: 'ADMIN' }, { role: 'VENDEDOR' }])('catálogo vendedor exige rol y sucursal: %j', (user) => {
    expect(() => service.sellerCatalog(user)).toThrow(expect.objectContaining({ status: 403 }));
    expect(db.product.findMany).not.toHaveBeenCalled();
  });
  test('catálogo vendedor limita existencias a su sucursal', async () => {
    await service.sellerCatalog(seller);
    expect(db.product.findMany.mock.calls[0][0].select.variants.select.stocks.where)
      .toEqual({ locationType: 'SUCURSAL', locationId: 3 });
  });
  test('detalle devuelve producto o 404', async () => {
    db.product.findUnique.mockResolvedValueOnce({ id: 2, name: 'Colchón' });
    expect(await service.product(2)).toMatchObject({ name: 'Colchón' });
    await expect(service.product(9)).rejects.toMatchObject({ status: 404 });
  });
  test.each([undefined, [], [{ id: 999, sku: 'VAR-1', price: 500 }]].map((value) => [value]))('creación controla variantes %j', async (variants) => {
    const result = await service.createProduct({ sku: 'COL-1', variants });
    expect(result.sku).toBe('COL-1');
    expect(result.variants).toEqual(variants?.length ? { create: [{ sku: 'VAR-1', price: 500 }] } : undefined);
  });
  test('SKU duplicado impide crear producto', async () => {
    db.product.findUnique.mockResolvedValue({ id: 1 });
    await expect(service.createProduct({ sku: 'COL-1' })).rejects.toMatchObject({ status: 409 });
    expect(db.product.create).not.toHaveBeenCalled();
  });
  test('actualización conserva identificador de producto', async () => {
    expect(await service.updateProduct(2, { name: 'Nuevo' })).toMatchObject({ id: 2, name: 'Nuevo' });
  });
  test('variante requiere SKU libre y producto existente', async () => {
    db.productVariant.findUnique.mockResolvedValueOnce({ id: 9 });
    await expect(service.createVariant({ sku: 'V', productId: 2 })).rejects.toMatchObject({ status: 409 });
    await expect(service.createVariant({ sku: 'V', productId: 2 })).rejects.toMatchObject({ status: 404 });
    db.product.findUnique.mockResolvedValue({ id: 2 });
    expect(await service.createVariant({ sku: 'V', productId: 2 })).toMatchObject({ sku: 'V', productId: 2 });
  });
  test('actualiza variante existente y rechaza inexistente', async () => {
    await expect(service.updateVariant(2, { price: 600 })).rejects.toMatchObject({ status: 404 });
    db.productVariant.findUnique.mockResolvedValue({ id: 2 });
    expect(await service.updateVariant(2, { price: 600 })).toMatchObject({ id: 2, price: 600 });
  });
  test('sincronización rechaza producto ausente antes de la transacción', async () => {
    await expect(service.syncProductVariants(2, [])).rejects.toMatchObject({ status: 404 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each([[{ id: 99 }], [{ id: 1 }, { id: 1 }]].map((value) => [value]))('rechaza variantes ajenas o repetidas %j', async (variants) => {
    db.product.findUnique.mockResolvedValue({ id: 2 });
    db.productVariant.findMany.mockResolvedValue([{ id: 1 }]);
    await expect(service.syncProductVariants(2, variants)).rejects.toMatchObject({ status: variants.length === 1 ? 404 : 409 });
    expect(db.productVariant.update).not.toHaveBeenCalled();
  });
  test('sincroniza: desactiva retiradas, modifica existentes y crea nuevas', async () => {
    db.product.findUnique.mockResolvedValue({ id: 2 });
    db.productVariant.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    await service.syncProductVariants(2, [{ id: 1, price: 600 }, { sku: 'NUEVA', price: 700 }]);
    expect(db.productVariant.updateMany).toHaveBeenCalledWith({ where: { productId: 2, id: { in: [2] } }, data: { isActive: false } });
    expect(db.productVariant.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { price: 600 } });
    expect(db.productVariant.create).toHaveBeenCalledWith({ data: { productId: 2, sku: 'NUEVA', price: 700 } });
  });
  test('sin cambios de identificadores no desactiva variantes', async () => {
    db.product.findUnique.mockResolvedValue({ id: 2 });
    db.productVariant.findMany.mockResolvedValue([{ id: 1 }]);
    await service.syncProductVariants(2, [{ id: 1, price: 600 }]);
    expect(db.productVariant.updateMany).not.toHaveBeenCalled();
  });
});
describe('Ubicaciones: alcance y edición', () => {
  let db, service;
  beforeEach(() => { db = database(); service = new LocationsService(db); });
  test('bodegas solo activas; creación conserva datos', async () => {
    await service.warehouses();
    expect(db.warehouse.findMany.mock.calls[0][0].where).toEqual({ isActive: true });
    expect(await service.createWarehouse({ name: 'Central' })).toMatchObject({ name: 'Central' });
    expect(await service.createBranch({ name: 'Norte' })).toMatchObject({ name: 'Norte' });
  });
  test.each([seller, manager, admin, { role: 'ADMIN' }, { role: 'ENCARGADO_FABRICA' }])('sucursales según rol %j', async (user) => {
    await service.branches(user);
    expect(db.branch.findMany.mock.calls[0][0].where).toEqual(
      user.branchId ? { isActive: true, id: 3 } : { isActive: true });
  });
  test('inactivas solo administradores; usuario de sucursal necesita asignación', async () => {
    await service.branches(admin, true);
    expect(db.branch.findMany.mock.calls[0][0].where).toEqual({});
    expect(() => service.branches(seller, true)).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => service.branches({ role: 'VENDEDOR' })).toThrow(expect.objectContaining({ status: 403 }));
  });
  test.each([['Warehouse','warehouse'], ['Branch','branch']])('editar %s valida existencia', async (suffix, model) => {
    await expect(service['update' + suffix](9, { name: 'Nuevo' })).rejects.toMatchObject({ status: 404 });
    db[model].findUnique.mockResolvedValue({ id: 9 });
    expect(await service['update' + suffix](9, { name: 'Nuevo' })).toMatchObject({ id: 9, name: 'Nuevo' });
  });
});
