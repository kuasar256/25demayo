const { admin, page, load } = require('./mocks');
const req = { user: admin, ip: '127.0.0.1' };
const dto = { name: 'Dato', status: 'PENDIENTE', initialCash: 100, actualCash: 90,
  type: 'SALIDA', amount: 10, reason: 'Transporte', notes: 'Nota', variants: [{ sku: 'V' }],
  email: 'ana@example.com', password: 'clave', idToken: 'google', token: 'reset',
  newPassword: 'nueva', currentPassword: 'anterior', assignedToId: 7, avatarUrl: '/avatar', isActive: false };
const cases = [
  ['auth','AuthController','login',[dto,req],'login',[dto.email,dto.password,req.ip]],
  ['auth','AuthController','googleLogin',[dto,req],'googleLogin',['google',req.ip]],
  ['auth','AuthController','recover',[dto],'requestRecovery',[dto.email]],
  ['auth','AuthController','reset',[dto],'resetPassword',['reset','nueva']],
  ['auth','AuthController','changePassword',[dto,req],'changePassword',[1,'anterior','nueva',req.ip]],
  ['auth','AuthController','me',[req],'getUserById',[1]],
  ['cash-register','CashRegisterController','getActive',[req],'getActiveShift',[admin]],
  ['cash-register','CashRegisterController','open',[dto,req],'openShift',[100,admin]],
  ['cash-register','CashRegisterController','addMovement',[5,dto,req],'addMovement',[5,'SALIDA',10,'Transporte',admin]],
  ['cash-register','CashRegisterController','close',[5,dto,req],'closeShift',[5,90,'Nota',admin]],
  ['cash-register','CashRegisterController','history',[req],'listHistory',[admin]],
  ['catalog','CatalogController','categories',[],'categories',[]],
  ['catalog','CatalogController','createCategory',[dto],'createCategory',[dto]],
  ['catalog','CatalogController','sellerCatalog',[req],'sellerCatalog',[admin]],
  ['catalog','CatalogController','product',[5],'product',[5]],
  ['catalog','CatalogController','createProduct',[dto],'createProduct',[dto]],
  ['catalog','CatalogController','updateProduct',[5,dto],'updateProduct',[5,dto]],
  ['catalog','CatalogController','syncProductVariants',[5,dto],'syncProductVariants',[5,dto.variants]],
  ['catalog','CatalogController','createVariant',[dto],'createVariant',[dto]],
  ['catalog','CatalogController','updateVariant',[5,dto],'updateVariant',[5,dto]],
  ['clients','ClientsController','detail',[5,req],'detail',[5,admin]],
  ['clients','ClientsController','upsert',[dto],'upsert',[dto]],
  ['clients','ClientsController','update',[5,dto],'update',[5,dto]],
  ['clients','ThirdPartiesController','list',['DISTRIBUIDOR','MAYORISTA'],'thirdParties',['DISTRIBUIDOR','MAYORISTA']],
  ['clients','ThirdPartiesController','create',[dto],'createThirdParty',[dto]],
  ['clients','ThirdPartiesController','update',[5,dto],'updateThirdParty',[5,dto]],
  ['inventory','InventoryController','stock',[{ page:'1',pageSize:'10' },req],'stock',[{page:'1',pageSize:'10'},admin,page]],
  ['inventory','InventoryController','critical',[req],'critical',[admin]],
  ['inventory','InventoryController','movements',[{},req],'movements',[{},admin,undefined]],
  ['inventory','InventoryController','entry',[dto,req],'registerEntry',[dto,admin]],
  ['inventory','InventoryController','adjust',[dto,req],'adjust',[dto,admin]],
  ['locations','LocationsController','warehouses',[],'warehouses',[]],
  ['locations','LocationsController','createWarehouse',[dto],'createWarehouse',[dto]],
  ['locations','LocationsController','createBranch',[dto],'createBranch',[dto]],
  ['locations','LocationsController','updateWarehouse',[5,dto],'updateWarehouse',[5,dto]],
  ['locations','LocationsController','updateBranch',[5,dto],'updateBranch',[5,dto]],
  ['notifications','NotificationsController','my',[req],'myNotifications',[1]],
  ['notifications','NotificationsController','unreadCount',[req],'unreadCount',[1]],
  ['notifications','NotificationsController','readAll',[req],'markAllRead',[1]],
  ['notifications','NotificationsController','markRead',[req,5],'markRead',[1,5]],
  ['production','ProductionController','create',[dto,req],'create',[dto,admin]],
  ['production','ProductionController','updateStatus',[5,dto,req],'updateStatus',[5,'PENDIENTE',admin]],
  ['production','ProductionController','assign',[5,dto,req],'assign',[5,7,admin]],
  ['production','ProductionController','assign',[5,{},req],'assign',[5,null,admin]],
  ['quotations','QuotationsController','list',['Ana','PENDIENTE'],'list',['Ana','PENDIENTE']],
  ['quotations','QuotationsController','detail',[5],'detail',[5]],
  ['quotations','QuotationsController','create',[dto,req],'create',[dto,admin]],
  ['quotations','QuotationsController','updateStatus',[5,dto],'updateStatus',[5,'PENDIENTE']],
  ['quotations','QuotationsController','delete',[5],'delete',[5]],
  ['reports','ReportsController','dashboard',[req],'dashboard',[admin]],
  ['reports','ReportsController','transfers',['PENDIENTE'],'transfers',['PENDIENTE']],
  ['sales','SalesController','checkWarranty',['123'],'checkWarranty',['123']],
  ['sales','SalesController','ranking',['2026-10-01','2026-10-19',req],'ranking',[admin,'2026-10-01','2026-10-19']],
  ['sales','SalesController','detail',[5,req],'detail',[5,admin]],
  ['sales','SalesController','create',[dto,req],'create',[dto,admin]],
  ['sales','SalesController','cancel',[5,dto,req],'cancel',[5,'Transporte',admin]],
  ['sales','SalesController','payBalance',[5,dto,req],'payBalance',[5,dto,admin]],
  ['sales','SalesController','deliver',[5,req],'markDelivered',[5,admin]],
  ['transfers','TransfersController','detail',[5,req],'detail',[5,admin]],
  ['transfers','TransfersController','create',[dto,req],'create',[dto,admin]],
  ['transfers','TransfersController','send',[5,dto,req],'send',[5,dto,admin]],
  ['transfers','TransfersController','confirm',[5,dto,req],'confirm',[5,dto,admin]],
  ['transfers','TransfersController','close',[5,req],'close',[5,admin]],
  ['users','UsersController','updateMe',[dto,req],'updateAvatar',[1,'/avatar']],
  ['users','UsersController','create',[dto,req],'create',[dto,admin]],
  ['users','UsersController','update',[5,dto,req],'update',[5,dto,admin]],
  ['users','UsersController','setStatus',[5,dto,req],'setStatus',[5,false,admin]],
];
describe('Controladores: contrato de argumentos e identidad autenticada', () => {
  test.each(cases)('%s.%s.%s transmite datos e identidad al servicio', async (module, className, method, args, serviceMethod, expected) => {
    const Class = load(`modules/${module}/${module}.controller`)[className];
    const service = { [serviceMethod]: jest.fn().mockResolvedValue({ id: 50 }) };
    expect(await new Class(service)[method](...args)).toEqual({ id: 50 });
    expect(service[serviceMethod]).toHaveBeenCalledTimes(1);
    expect(service[serviceMethod]).toHaveBeenCalledWith(...expected);
  });
});
describe('Controladores: normalización y validación de consultas', () => {
  function setup(module, className, method) {
    const Class = load(`modules/${module}/${module}.controller`)[className];
    const fn = jest.fn().mockReturnValue([]);
    return [new Class({ [method]: fn }), fn];
  }
  test.each([undefined, ' Ana ', 12])('catálogo limpia búsqueda %j', (search) => {
    const [controller, fn] = setup('catalog','CatalogController','products');
    controller.products(search);
    expect(fn).toHaveBeenCalledWith(typeof search === 'string' ? 'Ana' : undefined);
  });
  test.each([undefined,' 123 ',12])('cliente limpia CI %j', (ci) => {
    const [controller,fn] = setup('clients','ClientsController','searchByCi'); controller.search(ci);
    expect(fn).toHaveBeenCalledWith(typeof ci === 'string' ? '123' : '');
  });
  test.each([undefined,' Ana '])('cliente limpia y pagina %s', (search) => {
    const [controller,fn] = setup('clients','ClientsController','list'); controller.list(search,'1','10');
    expect(fn).toHaveBeenCalledWith(search ? 'Ana' : undefined,page);
  });
  test.each([undefined,'true','false'])('ubicaciones interpreta inactivas %s', (flag) => {
    const [controller,fn] = setup('locations','LocationsController','branches'); controller.branches(req,flag);
    expect(fn).toHaveBeenCalledWith(admin, flag === 'true');
  });
  test.each([undefined,'3'])('producción convierte sucursal %s', (branch) => {
    const [controller,fn] = setup('production','ProductionController','list'); controller.list(branch,'PENDIENTE','ALTA','Ana',req);
    expect(fn).toHaveBeenCalledWith(admin,{ branchId: branch ? 3 : undefined, status:'PENDIENTE',priority:'ALTA',search:'Ana' });
  });
  test.each([undefined,'ACTIVA','INVALIDO'])('ventas valida estado %s y filtros', (status) => {
    const [controller,fn] = setup('sales','SalesController','list');
    controller.list('3','17',' Ana ',status,'ENTREGADO','true','1','10',req);
    expect(fn).toHaveBeenCalledWith(admin,3,17,{ search:'Ana',status:status==='ACTIVA'?'ACTIVA':undefined,
      deliveryStatus:'ENTREGADO',hasPendingBalance:true,pagination:page });
    controller.list(undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,req);
    expect(fn.mock.calls[1][1]).toBeUndefined(); expect(fn.mock.calls[1][3].hasPendingBalance).toBe(false);
  });
  test.each([undefined,'PENDIENTE','INVALIDO',12])('transferencias valida estado %j', (status) => {
    const [controller,fn] = setup('transfers','TransfersController','list'); controller.list(status,' Ana ','1','10',req);
    expect(fn).toHaveBeenCalledWith(admin,status==='PENDIENTE'?'PENDIENTE':undefined,'Ana',page);
    controller.list(undefined,undefined,undefined,undefined,req);
    expect(fn.mock.calls[1][2]).toBeUndefined();
  });
  test.each(['active','inactive',undefined])('usuarios interpreta estado %s', (status) => {
    const [controller,fn] = setup('users','UsersController','list'); controller.list(' Ana ',status,'1','10');
    expect(fn).toHaveBeenCalledWith({ search:'Ana',isActive:status==='active'?true:status==='inactive'?false:undefined,pagination:page });
    controller.list(); expect(fn.mock.calls[1][0].search).toBeUndefined();
  });
  test.each([['x',undefined,undefined],[undefined,'x',undefined],[undefined,undefined,'INVALIDO']])('reportes rechaza filtros inválidos %s %s %s', (locationId,sellerId,locationType) => {
    const [controller,fn] = setup('reports','ReportsController','salesByPeriod');
    expect(() => controller.salesByPeriod(undefined,undefined,locationId,sellerId,locationType,req))
      .toThrow(expect.objectContaining({ status:400 })); expect(fn).not.toHaveBeenCalled();
  });
  test('reportes convierte identificadores y aplica límite por defecto', () => {
    const [controller,fn] = setup('reports','ReportsController','salesByPeriod');
    controller.salesByPeriod('2026-10-01','2026-10-19','3','17','SUCURSAL',req);
    expect(fn).toHaveBeenCalledWith(admin,'2026-10-01','2026-10-19',3,17,'SUCURSAL');
    controller.salesByPeriod(undefined,undefined,undefined,undefined,undefined,req);
    expect(fn.mock.calls[1]).toEqual([admin,undefined,undefined,undefined,undefined,undefined]);
    const [top,topFn] = setup('reports','ReportsController','topProducts');
    top.topProducts(undefined,req); top.topProducts('5',req);
    expect(topFn.mock.calls).toEqual([[admin,10],[admin,5]]);
  });
  test.each([['x'],[undefined,undefined,'incorrecta'],[undefined,undefined,'2026-02-30'],
    [undefined,undefined,undefined,'incorrecta'],[undefined,undefined,'2026-10-19','2026-10-01']])('auditoría rechaza entrada inválida %j', (...args) => {
    const [controller,fn] = setup('reports','ReportsController','audit');
    expect(() => controller.audit(...args)).toThrow(expect.objectContaining({ status:400 })); expect(fn).not.toHaveBeenCalled();
  });
  test('auditoría limpia módulo y mantiene fechas y paginación', () => {
    const [controller,fn] = setup('reports','ReportsController','audit');
    controller.audit('17',' sales ','2026-10-01','2026-10-19','1','10');
    expect(fn).toHaveBeenCalledWith(17,'sales','2026-10-01','2026-10-19',page);
    controller.audit(); expect(fn.mock.calls[1]).toEqual([undefined,undefined,undefined,undefined,undefined]);
  });
});

describe('DTO: validación de ítems anidados antes de llamar servicios', () => {
  const { plainToInstance } = require('class-transformer');
  const { validateSync } = require('class-validator');
  test.each(['stock','movements'])('inventario convierte identificadores numéricos en consulta %s', (method) => {
    const {InventoryController}=load('modules/inventory/inventory.controller');
    const [Dto]=Reflect.getMetadata('design:paramtypes',InventoryController.prototype,method);
    const query=plainToInstance(Dto,{locationType:'SUCURSAL',locationId:'3',variantId:'12'});
    expect(query.locationId).toBe(3);
    if(method==='movements') expect(query.variantId).toBe(12);
    expect(validateSync(query)).toEqual([]);
  });
  test.each([
    ['sales','SalesController','create', { locationType:'SUCURSAL',locationId:3,clientCi:'123',clientName:'Ana',items:[{variantId:12,quantity:0,expectedUnitPrice:500}] }],
    ['catalog','CatalogController','createProduct', { categoryId:1,name:'Colchón',sku:'COL',variants:[{sku:'V',size:'2 plazas',price:-1}] }],
    ['catalog','CatalogController','syncProductVariants', { variants:[{sku:'V',size:'2 plazas',price:-1}] }],
    ['transfers','TransfersController','create', {sourceWarehouseId:2,destinationType:'SUCURSAL',destinationBranchId:3,items:[{variantId:12,quantity:0}]}],
    ['transfers','TransfersController','confirm', {items:[{transferItemId:9,receivedQuantity:-1}]}],
    ['quotations','QuotationsController','create', {clientName:'Ana',items:[{variantId:12,quantity:0,unitPrice:500}]}],
  ])('%s.%s.%s rechaza cantidad/precio inválido', (module,className,method,body) => {
    const Class = load(`modules/${module}/${module}.controller`)[className];
    const types = Reflect.getMetadata('design:paramtypes',Class.prototype,method);
    const Dto = types.find((Type) => Type !== Number && Type !== Object && Type !== String);
    const errors = validateSync(plainToInstance(Dto,body));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === 'items' || error.property === 'variants')).toBe(true);
  });
});
