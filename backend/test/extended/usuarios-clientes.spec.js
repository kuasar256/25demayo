jest.mock('bcryptjs', () => ({ hash: jest.fn(async () => 'HASH_SEGUR0') }));
const bcrypt = require('bcryptjs');
const { database, admin, seller, manager, page, load } = require('./mocks');
const { UsersService } = load('modules/users/users.service');
const { ClientsService } = load('modules/clients/clients.service');
describe('Usuarios: jerarquía, datos privados y estado', () => {
  let db, service;
  beforeEach(() => { db = database(); service = new UsersService(db); });
  test('listado no selecciona contraseña y pagina filtros', async () => {
    await service.list();
    expect(db.user.findMany.mock.calls[0][0].select).not.toHaveProperty('password');
    db.user.findMany.mockResolvedValue([{ id: 2 }]); db.user.count.mockResolvedValue(11);
    expect(await service.list({ search: ' Ana ', isActive: false, pagination: page }))
      .toMatchObject({ total: 11, totalPages: 2, items: [{ id: 2 }] });
    expect(db.user.findMany.mock.calls[1][0].where).toMatchObject({ isActive: false,
      OR: expect.arrayContaining([{ fullName: { contains: 'Ana' } }]) });
  });
  test('solo general crea administradores', async () => {
    await expect(service.create({ role: 'ADMIN' }, { id: 2, role: 'ADMIN' })).rejects.toMatchObject({ status: 403 });
    expect(db.user.create).not.toHaveBeenCalled();
  });
  test('correo duplicado y sucursal inválida impiden crear', async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: 9 });
    await expect(service.create({ role: 'VENDEDOR', email: 'a@b.com' }, admin)).rejects.toMatchObject({ status: 409 });
    await expect(service.create({ role: 'VENDEDOR', branchId: 99 }, admin)).rejects.toMatchObject({ status: 400 });
    expect(db.user.create).not.toHaveBeenCalled();
  });
  test.each([undefined, 3])('creación cifra contraseña con sucursal %s', async (branchId) => {
    db.branch.findUnique.mockResolvedValue({ id: 3 });
    expect(await service.create({ email: 'a@b.com', password: 'secreto', role: 'VENDEDOR', branchId }, admin))
      .toMatchObject({ email: 'a@b.com', password: 'HASH_SEGUR0' });
    expect(bcrypt.hash).toHaveBeenCalledWith('secreto', 10);
  });
  test('actualización exige usuario existente y protege administrador general', async () => {
    await expect(service.update(9, {}, admin)).rejects.toMatchObject({ status: 404 });
    db.user.findUnique.mockResolvedValue({ id: 9, role: 'ADMIN_GENERAL' });
    await expect(service.update(9, {}, admin)).rejects.toMatchObject({ status: 403 });
  });
  test('administrador edita su perfil pero no su propio rol', async () => {
    db.user.findUnique.mockResolvedValue({ id: 2, role: 'ADMIN' });
    const actor = { id: 2, role: 'ADMIN' };
    expect(await service.update(2, { fullName: 'Ana' }, actor)).toMatchObject({ fullName: 'Ana' });
    await expect(service.update(2, { role: 'ADMIN_GENERAL' }, actor)).rejects.toMatchObject({ status: 403 });
  });
  test('cambio de rol y contraseña por administrador general', async () => {
    db.user.findUnique.mockResolvedValue({ id: 9, role: 'VENDEDOR' });
    expect(await service.update(9, { role: 'ADMIN', password: 'nueva' }, admin))
      .toMatchObject({ role: 'ADMIN', password: 'HASH_SEGUR0' });
  });
  test.each([
    [null, admin, 9, 404], [{ id: 9, role: 'ADMIN_GENERAL' }, admin, 9, 403],
    [{ id: 9, role: 'ADMIN' }, { id: 2, role: 'ADMIN' }, 9, 403],
    [{ id: 17, role: 'VENDEDOR' }, seller, 17, 400],
  ])('estado rechaza acciones no autorizadas %j', async (target, actor, id, status) => {
    db.user.findUnique.mockResolvedValue(target);
    await expect(service.setStatus(id, false, actor)).rejects.toMatchObject({ status });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  test('general desactiva administrador y usuario puede mantener estado activo', async () => {
    db.user.findUnique.mockResolvedValue({ id: 9, role: 'ADMIN' });
    expect(await service.setStatus(9, false, admin)).toMatchObject({ isActive: false });
    db.user.findUnique.mockResolvedValue({ id: 17, role: 'VENDEDOR' });
    expect(await service.setStatus(17, true, seller)).toMatchObject({ isActive: true });
    expect(await service.updateAvatar(17, '/avatar.png')).toMatchObject({ id: 17, avatarUrl: '/avatar.png' });
  });
});
describe('Clientes: búsquedas, alcance de historial y terceros', () => {
  let db, service;
  beforeEach(() => { db = database(); service = new ClientsService(db); });
  test('CI vacío no consulta base', () => {
    expect(service.searchByCi('  ')).toEqual([]);
    expect(db.client.findMany).not.toHaveBeenCalled();
  });
  test.each([undefined, ' Ana '])('lista y pagina búsqueda %s', async (search) => {
    await service.list(search);
    const result = await service.list(search, page);
    expect(result).toMatchObject({ total: 0, page: 1, items: [] });
    expect(db.client.findMany.mock.calls[0][0].where).toEqual(search
      ? { OR: [{ ci: { contains: 'Ana' } }, { fullName: { contains: 'Ana' } }] } : {});
  });
  test.each([seller, manager, admin])('historial conserva alcance %j', async (user) => {
    db.client.findUnique.mockResolvedValue({ id: 5, sales: [] });
    expect(await service.detail(5, user)).toMatchObject({ id: 5 });
    expect(db.client.findUnique.mock.calls[0][0].include.sales.where).toEqual(user.role === 'VENDEDOR'
      ? { sellerId: 17 } : user.branchId ? { locationType: 'SUCURSAL', locationId: 3 } : {});
  });
  test('historial rechaza sucursal no asignada y cliente ausente', async () => {
    await expect(service.detail(5, { role: 'ENCARGADO_SUCURSAL' })).rejects.toMatchObject({ status: 403 });
    await expect(service.detail(5, admin)).rejects.toMatchObject({ status: 404 });
  });
  test('upsert identifica por CI y actualización requiere existencia', async () => {
    await service.upsert({ ci: '123', fullName: 'Ana', phone: '700' });
    expect(db.client.upsert).toHaveBeenCalledWith({ where: { ci: '123' },
      create: { ci: '123', fullName: 'Ana', phone: '700' }, update: { fullName: 'Ana', phone: '700' } });
    await expect(service.update(5, { fullName: 'Ana' })).rejects.toMatchObject({ status: 404 });
    db.client.findUnique.mockResolvedValue({ id: 5 });
    expect(await service.update(5, { fullName: 'Ana' })).toMatchObject({ fullName: 'Ana' });
  });
  test.each([[undefined, undefined], ['DISTRIBUIDOR', 'MAYORISTA']])('terceros filtros %s %s', async (type, category) => {
    await service.thirdParties(type, category);
    expect(db.thirdParty.findMany.mock.calls[0][0].where).toEqual({ isActive: true,
      ...(type ? { type } : {}), ...(category ? { category } : {}) });
  });
  test('terceros creación y edición con existencia', async () => {
    expect(await service.createThirdParty({ name: 'Distribuidor' })).toMatchObject({ name: 'Distribuidor' });
    await expect(service.updateThirdParty(5, {})).rejects.toMatchObject({ status: 404 });
    db.thirdParty.findUnique.mockResolvedValue({ id: 5 });
    expect(await service.updateThirdParty(5, { phone: '700' })).toMatchObject({ id: 5, phone: '700' });
  });
});
