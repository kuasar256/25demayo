const { load } = require('../helpers');
const { getJwtSecret } = load('common/jwt-secret');
const { AuthService } = load('modules/auth/auth.service');
const { AuthController } = load('modules/auth/auth.controller');
const { validate } = require('class-validator');

describe('Seguridad: configuración y entradas de autenticación', () => {
  let original;
  beforeEach(() => { original = { ...process.env }; });
  afterEach(() => {
    for (const key of ['JWT_SECRET', 'NODE_ENV', 'GOOGLE_CLIENT_ID']) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
  test.each([undefined, 'dev-secret', 'cambia-esto-en-produccion', 'corta'])('producción rechaza secreto inseguro %s', value => {
    process.env.NODE_ENV = 'production';
    if (value === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = value;
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });
  test('producción conserva una clave suficientemente larga', () => {
    process.env.NODE_ENV = 'production'; process.env.JWT_SECRET = 'A'.repeat(48);
    expect(getJwtSecret()).toBe(process.env.JWT_SECRET);
  });
  test('desarrollo conserva arranque local sin secreto configurado', () => {
    process.env.NODE_ENV = 'development'; delete process.env.JWT_SECRET;
    expect(getJwtSecret()).toBe('dev-secret');
  });
  test.each([undefined, 'tu-client-id-de-google.apps.googleusercontent.com'])('Google sin configuración válida rechaza antes de consultar la base %s', async value => {
    if (value === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = value;
    const db = { user: { findUnique: jest.fn() } }; const jwt = { sign: jest.fn() };
    await expect(new AuthService(db, jwt).googleLogin('token', 'security-test')).rejects.toMatchObject({ status: 401 });
    expect(db.user.findUnique).not.toHaveBeenCalled(); expect(jwt.sign).not.toHaveBeenCalled();
  });
  test.each([123, {}, []])('login rechaza contraseña no textual %j', async password => {
    const LoginDto = Reflect.getMetadata('design:paramtypes', AuthController.prototype, 'login')[0];
    const dto = Object.assign(new LoginDto(), { email: 'ana@example.com', password });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'password' && e.constraints?.isString)).toBe(true);
  });
});
