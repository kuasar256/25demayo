const { load, database } = require('./mocks');
const { parsePagination } = load('common/pagination');
const { RolesGuard } = load('common/guards/roles.guard');
const { PrismaService } = load('prisma/prisma.service');

describe('Controles básicos de la batería reducida', () => {
  test('consulta básica de transferencias conserva el filtro de estado', async () => {
    const { ReportsService } = load('modules/reports/reports.service');
    const db = database();
    db.transfer.findMany.mockResolvedValue([{id:5,status:'PENDIENTE'}]);
    expect(await new ReportsService(db).transfers('PENDIENTE')).toEqual([{id:5,status:'PENDIENTE'}]);
    expect(db.transfer.findMany.mock.calls[0][0].where).toEqual({status:'PENDIENTE'});
  });
  test.each([['0','10'],['9007199254740992','10'],['1','101'],['9007199254740991','100']])(
    'paginación rechaza parámetros inválidos %s %s', (page, size) => {
      expect(() => parsePagination(page,size)).toThrow(expect.objectContaining({status:400}));
    });
  test('endpoint restringido rechaza una petición sin identidad', () => {
    const guard = new RolesGuard({getAllAndOverride: () => ['ADMIN']});
    const context = {getHandler: () => () => {}, getClass: () => class {},
      switchToHttp: () => ({getRequest: () => ({})})};
    expect(() => guard.canActivate(context)).toThrow(expect.objectContaining({status:403}));
  });
  test('inicio de persistencia invoca conexión sin acceder a una base real', async () => {
    const connect = jest.fn();
    await PrismaService.prototype.onModuleInit.call({$connect:connect});

    expect(connect).toHaveBeenCalledTimes(1);

  });
});


