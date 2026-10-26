jest.mock('bcryptjs', () => ({ compare: jest.fn(), hash: jest.fn(async () => 'HASH_NUEVO') }));
const bcrypt = require('bcryptjs');
const https = require('https');
const { EventEmitter } = require('events');
const { database, load } = require('./mocks');
const { AuthService } = load('modules/auth/auth.service');
const { JwtStrategy } = load('modules/auth/jwt.strategy');
const account = () => ({ id: 5, email: 'ana@example.com', password: 'HASH', fullName: 'Ana',
  role: 'VENDEDOR', branchId: 3, isActive: true, failedAttempts: 0, lockedUntil: null,
  branch: { name: 'Norte' } });
let sequence = 0;
describe('Autenticación: credenciales, bloqueos y recuperación', () => {
  let db, jwt, service, ip, previousClientId;
  beforeEach(() => {
    previousClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    db = database(); jwt = { sign: jest.fn(() => 'JWT_FICTICIO'), verify: jest.fn() };
    service = new AuthService(db, jwt); ip = 'test-' + (++sequence);
    db.user.findUnique.mockResolvedValue(account()); bcrypt.compare.mockResolvedValue(true);
  });
  afterEach(() => { jest.restoreAllMocks();
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
  });
  test.each([true, false])('login exitoso con sucursal presente=%s no expone hash', async (branch) => {
    db.user.findUnique.mockResolvedValue({ ...account(), branch: branch ? { name: 'Norte' } : null });
    const result = await service.login('ana@example.com', 'clave', ip);
    expect(result).toMatchObject({ accessToken: 'JWT_FICTICIO', user: { id: 5, branchName: branch ? 'Norte' : null } });
    expect(result.user).not.toHaveProperty('password');
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 5, email: 'ana@example.com', role: 'VENDEDOR', branchId: 3 });
    expect(db.user.update.mock.calls[0][0].data).toMatchObject({ failedAttempts: 0, lockedUntil: null, lastLoginAt: expect.any(Date) });
  });
  test('correo desconocido genera auditoría sin autenticar', async () => {
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.login('nadie@example.com', 'clave', ip)).rejects.toMatchObject({ status: 401 });
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe('LOGIN_FAILED');
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  test.each([0, 4])('contraseña incorrecta: fallos previos %i', async (failedAttempts) => {
    db.user.findUnique.mockResolvedValue({ ...account(), failedAttempts });
    bcrypt.compare.mockResolvedValue(false);
    await expect(service.login('ana@example.com', 'incorrecta', ip)).rejects.toMatchObject({ status: 401 });
    expect(db.user.update.mock.calls[0][0].data).toMatchObject({
      failedAttempts: failedAttempts === 4 ? 0 : 1,
      lockedUntil: failedAttempts === 4 ? expect.any(Date) : null,
    });
    expect(db.notification.create).toHaveBeenCalledTimes(failedAttempts === 4 ? 1 : 0);
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe(failedAttempts === 4 ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED');
  });
  test('cuenta bloqueada no compara contraseña', async () => {
    db.user.findUnique.mockResolvedValue({ ...account(), lockedUntil: new Date(Date.now() + 60000) });
    await expect(service.login('ana@example.com', 'clave', ip)).rejects.toMatchObject({ status: 403 });
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });
  test('cuenta inactiva no emite JWT', async () => {
    db.user.findUnique.mockResolvedValue({ ...account(), isActive: false });
    await expect(service.login('ana@example.com', 'clave', ip)).rejects.toMatchObject({ status: 403 });
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe('LOGIN_INACTIVE');
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  test('15 fallos bloquean IP y el bloqueo vence a los 10 minutos', async () => {
    db.user.findUnique.mockResolvedValue(null);
    for (let n = 0; n < 15; n++) await expect(service.login('nadie@example.com', 'x', ip)).rejects.toMatchObject({ status: 401 });
    await expect(service.login('nadie@example.com', 'x', ip)).rejects.toMatchObject({ status: 403 });
    expect(db.user.findUnique).toHaveBeenCalledTimes(15);
    const now = Date.now(); jest.spyOn(Date, 'now').mockReturnValue(now + 11 * 60 * 1000);
    db.user.findUnique.mockResolvedValue(account());
    expect((await service.login('ana@example.com', 'clave', ip)).accessToken).toBe('JWT_FICTICIO');
  });
  test('login sin IP utiliza identidad de red por defecto', async () => {
    expect((await service.login('ana@example.com', 'clave')).user.id).toBe(5);
  });
  test('cambio de contraseña rechaza usuario ausente, clave errónea y reutilización', async () => {
    db.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.changePassword(5, 'vieja', 'nueva', ip)).rejects.toMatchObject({ status: 401 });
    bcrypt.compare.mockResolvedValueOnce(false);
    await expect(service.changePassword(5, 'error', 'nueva', ip)).rejects.toMatchObject({ status: 400 });
    await expect(service.changePassword(5, 'igual', 'igual', ip)).rejects.toMatchObject({ status: 400 });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  test('cambio de contraseña cifra y limpia bloqueos', async () => {
    expect(await service.changePassword(5, 'vieja', 'nueva', ip)).toHaveProperty('message');
    expect(bcrypt.hash).toHaveBeenCalledWith('nueva', 10);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { password: 'HASH_NUEVO', failedAttempts: 0, lockedUntil: null } });
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe('PASSWORD_CHANGED');
  });
  test.each([null, { isActive: false }, account()])('recuperación no revela si existe usuario %j', async (user) => {
    db.user.findUnique.mockResolvedValue(user);
    expect(await service.requestRecovery('ana@example.com')).toEqual({ message: 'Si la cuenta está registrada, la solicitud será revisada por el administrador.' });
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });
  test('recuperación evita notificaciones duplicadas durante ventana temporal', async () => {
    db.user.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    db.notification.findMany.mockResolvedValue([{ userId: 1 }]);
    await service.requestRecovery('ana@example.com');
    expect(db.notification.createMany.mock.calls[0][0].data).toEqual([expect.objectContaining({ userId: 2, type: 'PASSWORD_RESET_REQUEST' })]);
    db.notification.findMany.mockResolvedValue([{ userId: 1 }, { userId: 2 }]);
    await service.requestRecovery('ana@example.com');
    expect(db.notification.createMany).toHaveBeenCalledTimes(1);
  });
  test.each([null, {}, { type: 'access', sub: 5 }, { type: 'pwd_reset' }])('reset rechaza payload %j', async (payload) => {
    jwt.verify.mockReturnValue(payload);
    await expect(service.resetPassword('token', 'nueva')).rejects.toMatchObject({ status: 400 });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  test.each([null, { isActive: false }])('reset rechaza cuenta inválida %j', async (user) => {
    jwt.verify.mockReturnValue({ type: 'pwd_reset', sub: 5 }); db.user.findUnique.mockResolvedValue(user);
    await expect(service.resetPassword('token', 'nueva')).rejects.toMatchObject({ status: 400 });
  });
  test.each(['TokenExpiredError', 'JsonWebTokenError'])('reset informa fallo %s', async (name) => {
    jwt.verify.mockImplementation(() => { const e = new Error('inválido'); e.name = name; throw e; });
    await expect(service.resetPassword('token', 'nueva')).rejects.toMatchObject({ status: 400,
      message: name === 'TokenExpiredError' ? 'El token de restablecimiento ha expirado.' : 'Token de restablecimiento inválido.' });
  });
  test('reset válido actualiza clave y auditoría', async () => {
    jwt.verify.mockReturnValue({ type: 'pwd_reset', sub: 5 });
    expect(await service.resetPassword('token', 'nueva')).toHaveProperty('message');
    expect(db.user.update.mock.calls[0][0].data.password).toBe('HASH_NUEVO');
    expect(db.auditLog.create.mock.calls[0][0].data.action).toBe('PASSWORD_RESET');
    await service.getUserById(5);
    expect(db.user.findUnique.mock.calls.at(-1)[0].select).not.toHaveProperty('password');
  });
  function googleResponse(payload, statusCode = 200, networkError = false) {
    jest.spyOn(https, 'get').mockImplementation((url, callback) => {
      const request = new EventEmitter();
      process.nextTick(() => {
        if (networkError) return request.emit('error', new Error('sin red'));
        const response = new EventEmitter(); response.statusCode = statusCode;
        callback(response); response.emit('data', typeof payload === 'string' ? payload : JSON.stringify({ aud: 'test-client', ...payload })); response.emit('end');
      });
      return request;
    });
  }
  test.each([[{ error: 'invalid' }, 200], [{}, 401], ['no-json', 200]])('Google rechaza respuesta inválida %j', async (payload, status) => {
    googleResponse(payload, status);
    await expect(service.googleLogin('google-token', ip)).rejects.toMatchObject({ status: 401 });
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  test('Google maneja error de red y audiencia distinta', async () => {
    googleResponse({}, 200, true);
    await expect(service.googleLogin('token', ip)).rejects.toMatchObject({ status: 401 });
    jest.restoreAllMocks(); googleResponse({ aud: 'otro' });
    const previous = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'aplicacion';
    try { await expect(service.googleLogin('token', ip)).rejects.toMatchObject({ status: 401 }); }
    finally { if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previous; }
  });
  test.each([null, { ...account(), isActive: false }, { ...account(), lockedUntil: new Date(Date.now() + 60000) }])('Google rechaza cuenta %j', async (user) => {
    googleResponse({ email: 'ana@example.com' }); db.user.findUnique.mockResolvedValue(user);
    await expect(service.googleLogin('token', ip)).rejects.toMatchObject({ status: user ? 403 : 401 });
    expect(jwt.sign).not.toHaveBeenCalled();
  });
  test.each([
    [undefined, 'google.png', null], ['local.png', 'google.png', { name: 'Norte' }], [undefined, undefined, null],
  ])('Google conserva avatar propio y no expone contraseña %s %s', async (avatarUrl, picture, branch) => {
    googleResponse({ email: 'ana@example.com', picture });
    db.user.findUnique.mockResolvedValue({ ...account(), avatarUrl, branch });
    const result = await service.googleLogin('token', ip);
    expect(result.user.avatarUrl).toBe(avatarUrl || picture || null);
    expect(result.user.branchName).toBe(branch?.name ?? null);
    expect(result.user).not.toHaveProperty('password');
    expect(db.user.update.mock.calls[0][0].data.avatarUrl).toBe(!avatarUrl && picture ? picture : undefined);
  });
  test('Google respeta bloqueo por IP antes de consultar proveedor', async () => {
    db.user.findUnique.mockResolvedValue(null);
    for (let n = 0; n < 15; n++) await expect(service.login('nadie', 'x', ip)).rejects.toMatchObject({ status: 401 });
    const spy = jest.spyOn(https, 'get');
    await expect(service.googleLogin('token', ip)).rejects.toMatchObject({ status: 403 });
    expect(spy).not.toHaveBeenCalled();
  });
});
describe('JWT: usa estado y rol actuales de base de datos', () => {
  test.each([null, {}, { sub: 0 }])('payload inválido %j', async (payload) => {
    const db = database(); const strategy = new JwtStrategy(db);
    await expect(strategy.validate(payload)).rejects.toMatchObject({ status: 401 });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  test.each([null, { ...account(), isActive: false }, { ...account(), lockedUntil: new Date(Date.now() + 60000) }])('cuenta inválida %j', async (user) => {
    const db = database(); db.user.findUnique.mockResolvedValue(user);
    await expect(new JwtStrategy(db).validate({ sub: 5 })).rejects.toMatchObject({ status: 401 });
  });
  test('devuelve rol vigente sin datos privados', async () => {
    const db = database(); db.user.findUnique.mockResolvedValue(account());
    expect(await new JwtStrategy(db).validate({ sub: 5, role: 'ADMIN_GENERAL' }))
      .toEqual({ id: 5, email: 'ana@example.com', fullName: 'Ana', role: 'VENDEDOR', branchId: 3 });
  });
});
