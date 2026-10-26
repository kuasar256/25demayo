const { database,admin,seller,manager,factory,page,load }=require('./mocks');
const { saleFixture,saleDto }=require('../helpers');
const { SalesService }=load('modules/sales/sales.service');
describe('Ventas: filtros, precios y cobros',()=>{
  let db,inventory,notifications,service;
  beforeEach(()=>{db=database();inventory={increment:jest.fn(),decrement:jest.fn(),checkAlert:jest.fn()};
    notifications={notifySaleCanceled:jest.fn()};service=new SalesService(db,inventory,notifications);});
  test.each([admin,{id:2,role:'ADMIN'},seller,manager])('listado conserva alcance y filtros %j',async(user)=>{
    const result=await service.list(user,9,99,{search:' Ana ',status:'ACTIVA',deliveryStatus:'ENTREGADO',hasPendingBalance:true,pagination:page});
    expect(result.total).toBe(0);
    const where=db.sale.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({status:'ACTIVA',deliveryStatus:'ENTREGADO',pendingBalance:{gt:0}});
    expect(where.sellerId).toBe(user===seller?17:user===manager?undefined:99);
    expect(where.locationId).toBe(user===manager?3:user===seller?undefined:9);
    await service.list(user);expect(db.sale.findMany.mock.calls[1][0].take).toBe(300);
  });
  test('detalle 404 y restricciones de propiedad/sucursal',async()=>{
    await expect(service.detail(5,admin)).rejects.toMatchObject({status:404});
    db.sale.findUnique.mockResolvedValue({id:5,sellerId:99,locationType:'BODEGA',locationId:2});
    await expect(service.detail(5,seller)).rejects.toMatchObject({status:403});
    await expect(service.detail(5,manager)).rejects.toMatchObject({status:403});
    db.sale.findUnique.mockResolvedValue({id:5,sellerId:17,locationType:'SUCURSAL',locationId:3});
    expect(await service.detail(5,seller)).toMatchObject({id:5});expect(await service.detail(5,manager)).toMatchObject({id:5});
    expect(await service.detail(5,admin)).toMatchObject({id:5});
  });
  test.each([{clientCi:''},{clientName:''},{clientCi:undefined,clientName:undefined}])('creación exige CI y nombre %j',async(change)=>{
    await expect(service.create({...saleDto(),...change},seller)).rejects.toMatchObject({status:400});
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each([seller,manager])('creación fuera de sucursal rechazada %j',async(user)=>{
    await expect(service.create({...saleDto(),locationId:99},user)).rejects.toMatchObject({status:403});
    await expect(service.create({...saleDto(),locationType:'BODEGA'},user)).rejects.toMatchObject({status:403});
  });
  test.each([null,{isActive:false,product:{isActive:true}},{isActive:true,product:{isActive:false}},
    {isActive:true,product:{isActive:true},price:999,sku:'COL'}])('producto inválido o precio cambiado %j',async(variant)=>{
    const f=saleFixture();f.tx.productVariant.findUnique.mockResolvedValue(variant);
    await expect(f.service.create(saleDto(),seller)).rejects.toMatchObject({status:variant?.price===999?409:400});
    expect(f.tx.sale.create).not.toHaveBeenCalled();expect(f.inventory.decrement).not.toHaveBeenCalled();
  });
  test('cliente nuevo, anticipo, garantía y orden de fabricación automática',async()=>{
    const f=saleFixture();f.tx.client.findUnique.mockResolvedValue(null);
    f.tx.client.create.mockResolvedValue({id:9,fullName:'Ana'});
    f.tx.productVariant.findUnique.mockResolvedValue({id:12,sku:'COL',price:500,costPrice:200,warrantyYears:2,isActive:true,product:{isActive:true}});
    f.tx.cashShift.findFirst.mockResolvedValue({id:7});
    f.tx.productionOrder={count:jest.fn().mockResolvedValue(4),create:jest.fn()};
    const dto={...saleDto(),clientPhone:' 700 ',paymentType:'ANTICIPO',amountPaid:300,
      changeAmount:10,paymentMethod:'QR',notes:' Entregar ',deliveryDate:'2026-11-01',
      createProductionOrder:true,priority:'ALTA',customNotes:'Medida especial',items:[{...saleDto().items[0],warrantySeal:' SELLO '}]};
    const result=await f.service.create(dto,manager);
    expect(result).toMatchObject({clientId:9,total:1000,pendingBalance:700,cashShiftId:7,
      paymentMethod:'QR',notes:'Entregar',changeAmount:0,deliveryStatus:'PENDIENTE_ENTREGA',deliveryDate:new Date('2026-11-01')});
    expect(result.items[0]).toMatchObject({unitCost:200,warrantySeal:'SELLO',warrantyExpiresAt:expect.any(Date)});
    expect(f.tx.client.create).toHaveBeenCalledWith({data:{ci:'7654321',fullName:'Ana Pérez',phone:'700'}});
    expect(f.tx.productionOrder.create.mock.calls[0][0].data).toMatchObject({quantity:2,branchId:3,status:'PENDIENTE',priority:'ALTA',saleId:81,customNotes:'Medida especial'});
  });
  test('venta de fábrica genera orden con valores predeterminados',async()=>{
    const f=saleFixture();f.tx.productionOrder={count:jest.fn().mockResolvedValue(0),create:jest.fn()};
    const dto={...saleDto(),locationType:'BODEGA',locationId:2,createProductionOrder:true,deliveryStatus:'PENDIENTE_ENTREGA'};
    await f.service.create(dto,admin);
    expect(f.tx.productionOrder.create.mock.calls[0][0].data).toMatchObject({priority:'NORMAL',targetDate:null});
    expect(f.tx.productionOrder.create.mock.calls[0][0].data.customNotes).toContain('Ana Pérez');
  });
  test.each([undefined,0,-1])('cobro rechaza importe inválido %s',async(amount)=>{
    await expect(service.payBalance(5,{amount},seller)).rejects.toMatchObject({status:400});expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each([null,{status:'ANULADA'},{status:'ACTIVA',pendingBalance:0,sellerId:17,locationType:'SUCURSAL',locationId:3}])('cobro rechaza venta inválida %j',async(sale)=>{
    db.sale.findUnique.mockResolvedValue(sale);
    await expect(service.payBalance(5,{amount:100},seller)).rejects.toMatchObject({status:sale?400:404});
    expect(db.sale.update).not.toHaveBeenCalled();
  });
  test.each([
    [{amount:50},null,seller,50,50,'PENDIENTE_ENTREGA'],
    [{amount:200,notes:' Pago ',paymentMethod:'QR'}, {id:7},seller,100,0,'PENDIENTE_ENTREGA'],
    [{amount:50,markDelivered:true}, {id:7},admin,50,50,'ENTREGADO'],
  ])('cobro limita saldo y entrega %j',async(dto,shift,user,paid,pending,status)=>{
    db.sale.findUnique.mockResolvedValue({id:5,code:'VTA-5',status:'ACTIVA',sellerId:17,locationType:'SUCURSAL',locationId:3,pendingBalance:100,amountPaid:0,
      notes:null,client:{fullName:'Ana'},deliveryStatus:'PENDIENTE_ENTREGA'});
    db.cashShift.findFirst.mockResolvedValue(shift);
    const result=await service.payBalance(5,dto,user);
    expect(result).toMatchObject({amountPaid:paid,pendingBalance:pending,deliveryStatus:status});
    expect(db.salePayment.create).toHaveBeenCalledTimes(1);
    expect(db.salePayment.create.mock.calls[0][0].data).toMatchObject({amount:paid,cashShiftId:shift?.id??null,paymentMethod:dto.paymentMethod||'EFECTIVO'});
    if(dto.notes)expect(result.notes).toContain('Pago saldo');
  });
  test('entrega exige venta existente y registra fecha',async()=>{
    await expect(service.markDelivered(5,seller)).rejects.toMatchObject({status:404});
    db.sale.findUnique.mockResolvedValue({id:5,status:'ACTIVA',sellerId:17,locationType:'SUCURSAL',locationId:3});
    expect(await service.markDelivered(5,seller)).toMatchObject({deliveryStatus:'ENTREGADO',deliveryDate:expect.any(Date)});
  });
  test('garantía clasifica vigente, vencida y sin fecha',async()=>{
    await expect(service.checkWarranty(' ')).rejects.toMatchObject({status:400});
    db.sale.findMany.mockResolvedValue([{items:[{warrantyExpiresAt:new Date('2099-01-01')},{warrantyExpiresAt:new Date('2000-01-01')},{warrantyExpiresAt:null}]}]);
    const result=await service.checkWarranty(' 123 ');
    expect(result[0].items.map(i=>i.warrantyStatus)).toEqual(['VIGENTE','VENCIDA','VENCIDA']);
    expect(db.sale.findMany.mock.calls[0][0].where.OR[0]).toEqual({client:{ci:{contains:'123'}}});
  });
  test.each([admin,seller,manager])('ranking agrupa vendedores y fechas %j',async(user)=>{
    db.sale.groupBy.mockResolvedValue([{sellerId:17,_count:{id:1},_sum:{total:null}},{sellerId:18,_count:{id:2},_sum:{total:100}}]);
    db.user.findMany.mockResolvedValue([{id:17,fullName:'Ana'},{id:18,fullName:'Luis'}]);
    const result=await service.ranking(user,'2026-10-01','2026-10-19');
    expect(result[0]).toMatchObject({seller:{id:18},total:100,salesCount:2});expect(result[1].total).toBe(0);
    expect(db.sale.groupBy.mock.calls[0][0].where.createdAt).toHaveProperty('gte');
    await service.ranking(user); expect(db.sale.groupBy.mock.calls[1][0].where.createdAt).toBeUndefined();
  });
});
describe('Ventas: anulaciones permitidas y rechazadas',()=>{
  let db,inventory,notifications,service;
  const active=()=>({id:5,code:'VTA-5',status:'ACTIVA',sellerId:17,locationType:'SUCURSAL',locationId:3,
    createdAt:new Date(),items:[{variantId:12,quantity:2}]});
  beforeEach(()=>{db=database();inventory={increment:jest.fn()};notifications={notifySaleCanceled:jest.fn()};service=new SalesService(db,inventory,notifications);});
  test('motivo obligatorio, venta ausente y ya anulada',async()=>{
    await expect(service.cancel(5,' ',seller)).rejects.toMatchObject({status:400});
    await expect(service.cancel(5,'Error',seller)).rejects.toMatchObject({status:404});
    db.sale.findUnique.mockResolvedValue({...active(),status:'ANULADA'});
    await expect(service.cancel(5,'Error',seller)).rejects.toMatchObject({status:400});expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each([
    [seller,{sellerId:99}],[seller,{createdAt:new Date('2000-01-01')}],
    [manager,{locationId:99}],[manager,{locationType:'BODEGA'}],[factory,{}],
  ])('anulación rechazada por alcance o fecha %j %j',async(user,change)=>{
    db.sale.findUnique.mockResolvedValue({...active(),...change});
    await expect(service.cancel(5,'Error',user)).rejects.toMatchObject({status:403});expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each([seller,manager,admin,{id:2,role:'ADMIN'}])('anulación autorizada restituye stock una vez %j',async(user)=>{
    db.sale.findUnique.mockResolvedValue(active());db.sale.findUniqueOrThrow.mockResolvedValue({...active(),status:'ANULADA'});
    expect(await service.cancel(5,' Error ',user)).toMatchObject({status:'ANULADA'});
    expect(db.sale.updateMany.mock.calls[0][0]).toMatchObject({where:{id:5,status:'ACTIVA'},data:{cancelReason:'Error',canceledById:user.id}});
    expect(inventory.increment).toHaveBeenCalledWith(db,12,'SUCURSAL',3,2);
    expect(db.stockMovement.create.mock.calls[0][0].data).toMatchObject({type:'ANULACION_VENTA',quantity:2,referenceId:5});
    expect(notifications.notifySaleCanceled).toHaveBeenCalledTimes(1);
  });
  test('conflicto de estado evita restitución duplicada',async()=>{
    db.sale.findUnique.mockResolvedValue(active());db.sale.updateMany.mockResolvedValue({count:0});
    await expect(service.cancel(5,'Error',admin)).rejects.toMatchObject({status:400});
    expect(inventory.increment).not.toHaveBeenCalled();expect(notifications.notifySaleCanceled).not.toHaveBeenCalled();
  });
});
