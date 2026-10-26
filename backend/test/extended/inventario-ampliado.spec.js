const { database,admin,seller,manager,factory,page,load }=require('./mocks');
const { InventoryService }=load('modules/inventory/inventory.service');
describe('Inventario: ámbito, historial, ingresos y ajustes de salida',()=>{
  let db,service,notifications;
  beforeEach(()=>{db=database();db.warehouse.findFirst.mockResolvedValue({id:2});db.branch.findFirst.mockResolvedValue({id:3});db.productVariant.findFirst.mockResolvedValue({id:12});notifications={notifyStockCritical:jest.fn()};service=new InventoryService(db,notifications);});
  test.each([admin,seller,manager,factory])('stock y movimientos conservan ubicación %j',async(user)=>{
    const query={locationType:'BODEGA',locationId:'2',variantId:12,search:' COL '};
    await service.stock(query,user); await service.movements(query,user);
    const where=db.stock.findMany.mock.calls[0][0].where;
    expect(where.locationType).toBe(user.branchId?'SUCURSAL':'BODEGA');
    expect(where.locationId).toBe(user.branchId||2);
    expect(where.variant.OR[0]).toEqual({sku:{contains:'COL'}});
    const movement=db.stockMovement.findMany.mock.calls[0][0];
    expect(movement.where.variantId).toBe(12);expect(movement.take).toBe(200);
  });
  test.each([admin,factory])('filtro vacío y paginación %j',async(user)=>{
    await service.stock({},user,page); await service.movements({},user,page);
    expect(db.stock.findMany.mock.calls[0][0].where).toEqual(user===factory?{locationType:'BODEGA'}:{});
    expect(db.stockMovement.findMany.mock.calls[0][0].skip).toBe(0);
  });
  test.each(['VENDEDOR','ENCARGADO_SUCURSAL'])('rol %s sin sucursal no consulta stock',async(role)=>{
    await expect(service.stock({}, {role})).rejects.toMatchObject({status:403});
    expect(db.stock.findMany).not.toHaveBeenCalled();
  });
  test('stock crítico filtra y calcula déficit sin negativos',async()=>{
    db.stock.findMany.mockResolvedValue([{quantity:1,variant:{minStock:3}}, {quantity:3,variant:{minStock:3}}, {quantity:4,variant:{minStock:3}}]);
    expect((await service.critical(admin)).map(s=>s.deficit)).toEqual([2,0]);
  });
  test('encargado fábrica no registra entrada fuera de bodega',async()=>{
    await expect(service.registerEntry({locationType:'SUCURSAL'},factory)).rejects.toMatchObject({status:403});
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each([undefined,'Producción'])('entrada registra stock y motivo %s',async(reason)=>{
    const dto={variantId:12,locationType:'BODEGA',locationId:2,quantity:4,reason};
    expect(await service.registerEntry(dto,factory)).toMatchObject({quantity:4,type:'INGRESO',userId:22,reason:reason??'Ingreso de producto terminado'});
    expect(db.stock.upsert.mock.calls[0][0].update.quantity.increment).toBe(4);
  });
  test.each([
    [manager,'BODEGA',3,403],[manager,'SUCURSAL',4,403],[factory,'SUCURSAL',3,403],
  ])('ajuste fuera de alcance %j %s %i',async(user,locationType,locationId,status)=>{
    await expect(service.adjust({variantId:12,locationType,locationId,quantity:-2,reason:'Daño'},user)).rejects.toMatchObject({status});
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each([[manager,'SUCURSAL',3],[factory,'BODEGA',2]])('ajuste negativo permitido %j',async(user,locationType,locationId)=>{
    expect(await service.adjust({variantId:12,locationType,locationId,quantity:-2,reason:'Daño'},user))
      .toMatchObject({quantity:-2,type:'AJUSTE_SALIDA',reason:'Daño',userId:user.id});
    expect(db.stock.updateMany.mock.calls[0][0].data).toEqual({quantity:{decrement:2}});
  });
  test('sin existencia o sobre mínimo no notifica',async()=>{
    await service.checkAlert(12,'BODEGA',2);
    db.stock.findUnique.mockResolvedValue({quantity:10,variant:{minStock:3}});
    await service.checkAlert(12,'BODEGA',2);
    expect(notifications.notifyStockCritical).not.toHaveBeenCalled();
  });
});
