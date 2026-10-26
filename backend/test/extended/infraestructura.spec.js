const { database, load } = require('./mocks');
const { of, lastValueFrom, throwError } = require('rxjs');
const { Logger } = require('@nestjs/common');
const { Reflector } = require('@nestjs/core');
const { AuthGuard } = require('@nestjs/passport');
const { RolesGuard } = load('common/guards/roles.guard');
const { JwtAuthGuard } = load('common/guards/jwt-auth.guard');
const { Roles, Public, ROLES_KEY, IS_PUBLIC_KEY } = load('common/decorators/roles.decorator');
const { parsePagination, paginatedResult } = load('common/pagination');
const { AuditService } = load('modules/audit/audit.service');
const { AuditInterceptor } = load('modules/audit/audit.interceptor');
const { PrismaService } = load('prisma/prisma.service');
const context = (request, handler = () => {}, Class = class {}) => ({
  switchToHttp: () => ({ getRequest: () => request }), getHandler: () => handler, getClass: () => Class,
});
describe('Paginación: límites y enteros seguros', () => {
  test.each([[undefined,undefined,undefined], ['2',undefined,{page:2,pageSize:25,skip:25}],
    [undefined,'10',{page:1,pageSize:10,skip:0}],['1','100',{page:1,pageSize:100,skip:0}]])('entrada %s %s', (p,size,result) => {
    expect(parsePagination(p,size)).toEqual(result);
  });
  test.each([['0','10'],['1','0'],['1','101'],['abc','10'],['1.5','10'],['-1','10'],
    ['9007199254740992','10'],['9007199254740991','100']])('rechaza %s %s', (p,size) => {
    expect(() => parsePagination(p,size)).toThrow(expect.objectContaining({status:400}));
  });
  test('calcula total de páginas sin alterar ítems', () => {
    expect(paginatedResult([{id:1}],11,{page:2,pageSize:10,skip:10})).toEqual({items:[{id:1}],total:11,page:2,pageSize:10,totalPages:2});
  });
});
describe('Guards: metadata de roles y rutas públicas', () => {
  test('decoradores establecen metadata y handler prevalece sobre clase', () => {
    class Target { action() {} }
    Roles('ADMIN')(Target); Roles('VENDEDOR')(Target.prototype,'action',Object.getOwnPropertyDescriptor(Target.prototype,'action'));
    Public()(Target.prototype,'action',Object.getOwnPropertyDescriptor(Target.prototype,'action'));
    expect(Reflect.getMetadata(ROLES_KEY,Target)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY,Target.prototype.action)).toBe(true);
    expect(new RolesGuard(new Reflector()).canActivate(context({user:{role:'VENDEDOR'}},Target.prototype.action,Target))).toBe(true);
  });
  test.each([undefined,[],['ADMIN']])('roles requeridos %j', (roles) => {
    const reflector={getAllAndOverride:jest.fn(()=>roles)};
    const guard=new RolesGuard(reflector);
    expect(guard.canActivate(context({user:{role:'ADMIN'}}))).toBe(true);
    if(roles?.length) {
      expect(()=>guard.canActivate(context({}))).toThrow(expect.objectContaining({status:403}));
      expect(()=>guard.canActivate(context({user:{role:'VENDEDOR'}}))).toThrow(expect.objectContaining({status:403}));
    }
  });
  test('JWT omite autenticación solo en rutas públicas', () => {
    const reflector={getAllAndOverride:jest.fn(()=>true)};
    const base=jest.spyOn(AuthGuard('jwt').prototype,'canActivate').mockReturnValue(true);
    try {
      const guard=new JwtAuthGuard(reflector);
      expect(guard.canActivate(context({}))).toBe(true); expect(base).not.toHaveBeenCalled();
      reflector.getAllAndOverride.mockReturnValue(false);
      const ctx=context({}); expect(guard.canActivate(ctx)).toBe(true); expect(base).toHaveBeenCalledWith(ctx);
    } finally { base.mockRestore(); }
  });
});
describe('Auditoría: trazabilidad y fallos de persistencia', () => {
  test('servicio conserva datos de auditoría', async () => {
    const db=database(); const data={userId:17,action:'POST',module:'sales',entityId:5};
    expect(await new AuditService(db).log(data)).toMatchObject(data);
    expect(db.auditLog.create).toHaveBeenCalledWith({data});
  });
  test.each(['GET','POST','PATCH','PUT','DELETE'])('método %s registra solo mutaciones sin almacenar secretos', async (method) => {
    const db=database(); const interceptor=new AuditInterceptor(db);
    const body={password:'NO_REGISTRAR',clientCi:'123'};
    const result=await lastValueFrom(interceptor.intercept(context({method,url:'/api/sales/5',user:{id:17},ip:'127.0.0.1',body}),{handle:()=>of({id:5})}));
    expect(result).toEqual({id:5});
    if(method==='GET') expect(db.auditLog.create).not.toHaveBeenCalled();
    else {
      expect(db.auditLog.create.mock.calls[0][0].data).toMatchObject({userId:17,action:method,module:'sales',entity:'5',entityId:5});
      expect(db.auditLog.create.mock.calls[0][0].data.detail).not.toContain('NO_REGISTRAR');
    }
  });
  test.each([new Error('falló'), 'falló'])('fallo de auditoría %j no rompe respuesta', async (error) => {
    const db=database(); db.auditLog.create.mockRejectedValue(error);
    const logger=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>{});
    try {
      expect(await lastValueFrom(new AuditInterceptor(db).intercept(context({method:'POST'}),{handle:()=>of(null)}))).toBeNull();
      await Promise.resolve(); expect(logger).toHaveBeenCalled();
    } finally { logger.mockRestore(); }
  });
  test('operación fallida no se registra como mutación exitosa', async () => {
    const db=database(); const error=new Error('rechazada');
    await expect(lastValueFrom(new AuditInterceptor(db).intercept(context({method:'POST'}),{handle:()=>throwError(()=>error)}))).rejects.toBe(error);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  test('ciclo de Prisma conecta y desconecta usando dobles sin abrir base real', async () => {
    const connect=jest.fn(), disconnect=jest.fn();
    await PrismaService.prototype.onModuleInit.call({$connect:connect});
    await PrismaService.prototype.onModuleDestroy.call({$disconnect:disconnect});
    expect(connect).toHaveBeenCalledTimes(1); expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
