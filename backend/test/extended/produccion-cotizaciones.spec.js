const { database, admin, seller, manager, factory, load } = require('./mocks');
const { ProductionService } = load('modules/production/production.service');
const { QuotationsService } = load('modules/quotations/quotations.service');
describe('Producción', () => {
  let db, service;
  beforeEach(() => { db = database(); service = new ProductionService(db); });
  test.each([seller, manager, admin])('listado filtra responsable y búsqueda %j', async (user) => {
    await service.list(user, { branchId: 8, status: 'PENDIENTE', priority: 'ALTA', search: ' Ana ' });
    const where = db.productionOrder.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PENDIENTE');
    expect(where.priority).toBe('ALTA');
    expect(where.branchId).toBe(user.branchId || (user.role === 'VENDEDOR' ? undefined : 8));
    expect(where.OR[0]).toEqual({ code: { contains: 'Ana' } });
  });
  test('listado sin filtros no añade condiciones', async () => {
    await service.list(admin);
    expect(db.productionOrder.findMany.mock.calls[0][0].where).toEqual({});
  });
  test('creación exige variante', async () => {
    await expect(service.create({ variantId: 8 }, admin)).rejects.toMatchObject({ status: 404 });
    expect(db.productionOrder.create).not.toHaveBeenCalled();
  });
  test.each([{}, { quantity: 0 }, { quantity: 3, branchId: 3, warehouseId: 2, priority: 'ALTA', customNotes: ' Especial ', targetDate: '2026-11-01', saleId: 7 }])('creación asigna valores de negocio %j', async (options) => {
    db.productVariant.findUnique.mockResolvedValue({ id: 8 });
    const result = await service.create({ variantId: 8, ...options }, seller);
    expect(result).toMatchObject({ variantId: 8, quantity: options.quantity || 1,
      branchId: options.branchId || 3, status: 'PENDIENTE', requestedById: 17,
      priority: options.priority || 'NORMAL', customNotes: options.customNotes ? 'Especial' : null });
    expect(result.code).toMatch(/^OF-\d{4}-0001$/);
    if (options.targetDate) expect(result.targetDate).toEqual(new Date('2026-11-01'));
  });
  test('fábrica puede crear orden sin sucursal', async () => {
    db.productVariant.findUnique.mockResolvedValue({ id: 8 });
    expect((await service.create({ variantId: 8 }, factory)).branchId).toBeNull();
  });
  test('estado inválido y orden inexistente no se actualizan', async () => {
    await expect(service.updateStatus(1, 'INVALIDO', admin)).rejects.toMatchObject({ status: 400 });
    await expect(service.updateStatus(1, 'PENDIENTE', admin)).rejects.toMatchObject({ status: 404 });
    expect(db.productionOrder.update).not.toHaveBeenCalled();
  });
  test.each(['TERMINADO', 'PENDIENTE'])('estado %s mantiene fecha coherente', async (status) => {
    db.productionOrder.findUnique.mockResolvedValue({ id: 1, completedAt: null });
    expect(await service.updateStatus(1, status, admin)).toMatchObject({ status,
      completedAt: status === 'TERMINADO' ? expect.any(Date) : null });
  });
  test('asignación valida orden y permite asignar o retirar responsable', async () => {
    await expect(service.assign(1, 7, admin)).rejects.toMatchObject({ status: 404 });
    db.productionOrder.findUnique.mockResolvedValue({ id: 1 });
    expect(await service.assign(1, 7, admin)).toMatchObject({ assignedToId: 7 });
    expect(await service.assign(1, null, admin)).toMatchObject({ assignedToId: null });
  });
});
describe('Cotizaciones: importes, vigencia y estado', () => {
  let db, service;
  beforeEach(() => { db = database(); service = new QuotationsService(db); });
  test.each([undefined, []])('rechaza cotización sin ítems %j', async (items) => {
    await expect(service.create({ items }, admin)).rejects.toMatchObject({ status: 400 });
    expect(db.quotation.create).not.toHaveBeenCalled();
  });
  test.each([{}, { clientId: 5, clientCi: ' 123 ', clientPhone: ' 700 ', clientEmail: ' a@b.com ', notes: ' especial ', validDays: 30 }])('calcula subtotal y normaliza cliente %j', async (optional) => {
    const result = await service.create({ clientName: ' Ana ', ...optional,
      items: [{ variantId: 8, quantity: 3, unitPrice: 12.345 }, { variantId: 9, quantity: 2, unitPrice: 10 }] }, admin);
    expect(result).toMatchObject({ clientName: 'Ana', total: 57.04, status: 'PENDIENTE',
      validDays: optional.validDays || 15, clientId: optional.clientId || null });
    expect(result.items.create[0].subtotal).toBe(37.04);
    expect(result.code).toMatch(/^COT-\d{4}-[A-F0-9]{32}$/);
  });
  test.each([[undefined, undefined], [' Ana ', 'PENDIENTE'], [' ', undefined]])('consulta búsqueda y estado %s %s', async (search, status) => {
    await service.list(search, status);
    const where = db.quotation.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(status);
    expect(where.OR?.[0].code.contains).toBe(search?.trim() || undefined);
  });
  test.each(['detail','updateStatus','delete'])('%s rechaza identificador ausente', async (method) => {
    await expect(service[method](7, 'APROBADA')).rejects.toMatchObject({ status: 404 });
  });
  test('detalle, aceptación y eliminación conservan identificador', async () => {
    db.quotation.findUnique.mockResolvedValue({ id: 7, total: 500 });
    db.quotation.delete.mockResolvedValue({ id: 7 });
    expect(await service.detail(7)).toMatchObject({ total: 500 });
    expect(await service.updateStatus(7, 'APROBADA')).toMatchObject({ id: 7, status: 'APROBADA' });
    expect(await service.delete(7)).toEqual({ id: 7 });
    expect(db.quotation.delete).toHaveBeenCalledWith({ where: { id: 7 } });
  });
});
