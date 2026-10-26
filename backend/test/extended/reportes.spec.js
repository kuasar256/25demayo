const { database, admin, seller, manager, factory, page, load } = require('./mocks');
const { ReportsService } = load('modules/reports/reports.service');
function reportSale(id, locationType, locationId, branch, total, sku, quantity = 2, status = 'ACTIVA') {
  return { id, status, total, locationType, locationId, branch,
    seller: { id: id === 3 ? 18 : 17, fullName: id === 3 ? 'Luis' : 'Ana' },
    createdAt: new Date(id === 3 ? '2026-10-02T12:00:00Z' : '2026-10-01T12:00:00Z'),
    items: [{ quantity, unitPrice: total / quantity, unitCost: id === 3 ? 0 : 100,
      variant: { sku, size: '2 plazas', product: { name: 'Colchón' } } }] };
}
describe('Reportes: sumas, comparaciones, fechas y alcance', () => {
  let db, service;
  beforeEach(() => {
    db = database(); service = new ReportsService(db);
    db.sale.aggregate.mockResolvedValue({ _sum: { total: 0 }, _count: { id: 0 } });
  });
  test.each([admin, { role: 'ADMIN', id: 2 }, seller, manager, factory])('dashboard respeta rol %j y agrega productos', async (user) => {
    db.sale.aggregate.mockResolvedValue({ _sum: { total: null }, _count: 0 });
    db.stock.findMany.mockResolvedValue([
      { locationType:'SUCURSAL',locationId:3,quantity:2,variant:{sku:'A',minStock:3} },
      { locationType:'SUCURSAL',locationId:4,quantity:1,variant:{sku:'B',minStock:3} },
      { locationType:'BODEGA',locationId:2,quantity:1,variant:{sku:'C',minStock:3} },
      { locationType:'BODEGA',locationId:2,quantity:10,variant:{sku:'D',minStock:3} },
    ]);
    db.sale.findMany.mockResolvedValue([{total:100,branch:{name:'Norte'}},{total:200,branch:{name:'Norte'}},{total:50,branch:null}]);
    const variant = { size:'2 plazas',product:{name:'Colchón',imageUrl:null} };
    db.saleItem.findMany.mockResolvedValue([{variantId:1,quantity:2,variant},{variantId:1,quantity:3,variant},{variantId:2,quantity:1,variant}]);
    const result = await service.dashboard(user);
    expect(result.salesToday).toEqual({ total:0,count:0 });
    expect(result.salesByBranch).toContainEqual({name:'Norte',total:300});
    expect(result.topProducts.map((p) => p.quantity)).toEqual([5,1]);
    expect(result.criticalStock.map((s) => s.sku)).toEqual(user.role==='ENCARGADO_FABRICA'?['C']:user.branchId?['A']:['A','B','C']);
    const where = db.sale.aggregate.mock.calls[0][0].where;
    if (user.role==='VENDEDOR') expect(where.sellerId).toBe(17);
    if (user.role==='ENCARGADO_FABRICA') expect(where.locationType).toBe('BODEGA');
    if (user.branchId) expect(where.locationId).toBe(3);
  });
  test('dashboard rechaza usuario de sucursal sin asignación', async () => {
    await expect(service.dashboard({role:'VENDEDOR'})).rejects.toMatchObject({status:403});
  });
  test.each([
    ['incorrecta','2026-10-01'], ['2026-02-30','2026-10-01'],
    ['2026-10-02','2026-10-01'], ['2024-01-01','2026-10-01'], ['2026-13-01','2026-10-01'],
  ])('reporte rechaza periodo %s a %s', async (from,to) => {
    await expect(service.salesByPeriod(admin,from,to)).rejects.toMatchObject({status:400});
    expect(db.sale.findMany).not.toHaveBeenCalled();
  });
  test.each([seller,manager])('reporte exige sucursal para %j', async (user) => {
    await expect(service.salesByPeriod({...user,branchId:null},'2026-10-01','2026-10-02')).rejects.toMatchObject({status:403});
  });
  test.each([admin,seller,manager,factory])('reporte aplica filtro autorizado %j', async (user) => {
    await service.salesByPeriod(user,'2026-10-01','2026-10-02',9,99,'BODEGA');
    const where = db.sale.findMany.mock.calls[0][0].where;
    expect(where.createdAt).toEqual({gte:new Date('2026-10-01T00:00:00Z'),lt:new Date('2026-10-03T00:00:00Z')});
    if (user.branchId) expect(where).toMatchObject({locationType:'SUCURSAL',locationId:3});
    else expect(where.locationType).toBe('BODEGA');
    if (user.role==='VENDEDOR') expect(where.sellerId).toBe(17);
    if (user===admin) expect(where).toMatchObject({locationId:9,sellerId:99});
  });
  test('reporte agrupa importes, costo, margen y ventas anuladas', async () => {
    db.sale.findMany.mockResolvedValue([
      reportSale(1,'SUCURSAL',3,{name:'Norte'},500,'COL-1'),
      reportSale(2,'SUCURSAL',3,{name:'Norte'},300,'COL-1',1),
      reportSale(3,'BODEGA',2,null,200,'COL-2'),
      reportSale(4,'BODEGA',9,null,999,'COL-X',1,'ANULADA'),
      reportSale(5,'SUCURSAL',5,null,100,'COL-3',1),
      reportSale(6,'BODEGA',9,null,100,'COL-4',1),
    ]);
    db.warehouse.findMany.mockResolvedValue([{id:2,name:'Central'}]);
    db.sale.count.mockResolvedValue(1);
    db.sale.aggregate.mockResolvedValueOnce({_sum:{total:1200},_count:{id:5}})
      .mockResolvedValueOnce({_sum:{total:600},_count:{id:2}});
    const result = await service.salesByPeriod(admin,'2026-10-01','2026-10-03');
    expect(result.summary).toMatchObject({total:1200,totalCost:500,grossProfit:700,count:5,averageTicket:240,units:7,canceledCount:1});
    expect(result.comparison).toEqual({totalPercent:100,countPercent:150});
    expect(result.daily.map((d) => d.total)).toEqual([1000,200,0]);
    expect(result.byBranch).toContainEqual({name:'Norte',total:800});
    expect(result.byBranch).toContainEqual({name:'Central',total:200});
    expect(result.topProducts[0]).toMatchObject({sku:'COL-1',quantity:3,revenue:800});
    expect(result.bySeller[0]).toMatchObject({id:17,total:1000});
    expect(result.sales.find((s) => s.id===4).locationName).toBe('Bodega');
  });
  test.each([0,100])('comparación con periodo previo vacío y total actual %i', async (total) => {
    db.sale.aggregate.mockResolvedValueOnce({_sum:{total:total||null},_count:{id:total?1:0}})
      .mockResolvedValueOnce({_sum:{total:null},_count:{id:0}});
    const result = await service.salesByPeriod(admin);
    expect(result.summary.total).toBe(total);
    expect(result.comparison.totalPercent).toBe(total?null:0);
    expect(result.summary.profitMargin).toBe(total?100:0);
  });
  test.each([admin,seller,manager,factory])('ranking productos agrega y respeta ámbito %j', async (user) => {
    const variant={sku:'COL',size:'2 plazas',product:{name:'Colchón'}};
    db.saleItem.findMany.mockResolvedValue([{variantId:1,quantity:2,unitPrice:100,variant},
      {variantId:1,quantity:3,unitPrice:100,variant},{variantId:2,quantity:7,unitPrice:100,variant}]);
    expect((await service.topProducts(user,1))[0]).toMatchObject({quantity:7,revenue:700});
    await service.topProducts(user);
    const where=db.saleItem.findMany.mock.calls[0][0].where.sale;
    expect(where.status).toBe('ACTIVA');
    if(user.branchId) expect(where.locationId).toBe(3);
    if(user===factory) expect(where.locationType).toBe('BODEGA');
    if(user===seller) expect(where.sellerId).toBe(17);
  });
  test.each([undefined,'PENDIENTE'])('reporte transferencias filtra estado %s', async (status) => {
    await service.transfers(status);
    expect(db.transfer.findMany.mock.calls[0][0].where).toEqual(status?{status}:undefined);
  });
  test.each([[undefined,undefined],[ '2026-10-01',undefined ],[undefined,'2026-10-19'],['2026-10-01','2026-10-19']])('auditoría filtra rango y pagina %s %s', async (from,to) => {
    await service.audit(undefined,undefined,from,to);
    const result=await service.audit(17,'sales',from,to,page);
    expect(result.total).toBe(0);
    const where=db.auditLog.findMany.mock.calls[1][0].where;
    expect(where).toMatchObject({userId:17,module:'sales'});
    if(from) expect(where.createdAt.gte).toEqual(new Date('2026-10-01T00:00:00Z'));
    if(to) expect(where.createdAt.lt).toEqual(new Date('2026-10-19T00:00:00Z'));
  });
});
