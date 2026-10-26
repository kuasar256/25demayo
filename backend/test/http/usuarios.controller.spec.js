const { load } = require('../helpers');
const request = require('supertest');
const { Module } = require('@nestjs/common');
const { NestFactory, Reflector } = require('@nestjs/core');
const { UsersController } = load('modules/users/users.controller');
const { UsersService } = load('modules/users/users.service');
const { RolesGuard } = load('common/guards/roles.guard');

describe('P8: autorización HTTP para POST /users', () => {
  let app;
  const users = { create: jest.fn().mockResolvedValue({ id: 100 }) };
  // Identidad controlada por la prueba; no representa autenticación JWT real.
  let identity;
  beforeAll(async () => {
    class TestModule {}
    Module({ controllers: [UsersController], providers: [
      { provide: UsersService, useValue: users },
    ] })(TestModule);
    app = await NestFactory.create(TestModule, { logger: false });
    app.use((req, res, next) => { req.user = identity; next(); });
    app.useGlobalGuards(new RolesGuard(app.get(Reflector)));
    await app.init();
  });
  afterAll(async () => { if (app) await app.close(); });
  test('VENDEDOR recibe 403 y no se llama al servicio', async () => {
    identity = { id: 17, role: 'VENDEDOR', branchId: 3 };
    const response = await request(app.getHttpServer()).post('/users').send({
      fullName: 'Usuario', email: 'usuario@example.com', password: 'clave123', role: 'VENDEDOR',
    });
    expect(response.status).toBe(403);
    expect(response.body.statusCode).toBe(403);
    expect(users.create).not.toHaveBeenCalled();
  });
  test.each(['ADMIN', 'ADMIN_GENERAL'])('control positivo: %s puede crear', async (role) => {
    identity = { id: 1, role };
    const dto = { fullName: 'Usuario', email: 'usuario@example.com', password: 'clave123', role: 'VENDEDOR' };
    const response = await request(app.getHttpServer()).post('/users').send(dto);
    expect(response.status).toBe(201);
    expect(users.create).toHaveBeenCalledWith(dto, identity);
  });
});
