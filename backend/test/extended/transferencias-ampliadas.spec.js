const {database,admin,seller,manager,page,load}=require('./mocks');
const {TransfersService}=load('modules/transfers/transfers.service');
describe('Transferencias: estados, destinos y diferencias de recepción',()=>{
  let db,inventory,notifications,service;
  const dto=()=>({sourceWarehouseId:2,destinationType:'SUCURSAL',destinationBranchId:3,items:[{variantId:12,quantity:2}]});
  const transfer=()=>({id:5,code:'TRF-5',status:'ENVIADA',destinationType:'SUCURSAL',destinationBranchId:3,
    notes:'Original',items:[{id:9,variantId:12,quantity:2}]});
  beforeEach(()=>{
    db=database();inventory={decrement:jest.fn(),increment:jest.fn(),checkAlert:jest.fn()};
    notifications={notifyTransferCreated:jest.fn(),notifyTransferReceived:jest.fn()};
    service=new TransfersService(db,inventory,notifications);
    db.warehouse.findFirst.mockResolvedValue({id:2});db.branch.findFirst.mockResolvedValue({id:3});
    db.thirdParty.findFirst.mockResolvedValue({id:8});db.productVariant.findFirst.mockResolvedValue({id:12});
    db.transfer.create.mockImplementation(async({data})=>({id:5,...data,items:data.items.create}));
    db.transfer.update.mockImplementation(async({data})=>({...transfer(),...data}));
  });
  test.each([admin,seller,manager])('listado filtra estado, búsqueda y sucursal %j',async(user)=>{
    await service.list(user,'PENDIENTE',' TRF ',page);
    const where=db.transfer.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('PENDIENTE');expect(where.OR[0]).toEqual({code:{contains:'TRF'}});
    expect(where.destinationBranchId).toBe(user.branchId);
    await service.list(user);expect(db.transfer.findMany.mock.calls[1][0]).not.toHaveProperty('take');
  });
  test('listado necesita asignación de sucursal',async()=>{
    await expect(service.list({role:'VENDEDOR'})).rejects.toMatchObject({status:403});
    expect(db.transfer.findMany).not.toHaveBeenCalled();
  });
  test('detalle exige existencia y pertenencia a sucursal',async()=>{
    await expect(service.detail(5,admin)).rejects.toMatchObject({status:404});
    db.transfer.findUnique.mockResolvedValue(transfer());
    expect(await service.detail(5,manager)).toMatchObject({id:5});
    expect(await service.detail(5,admin)).toMatchObject({id:5});
    await expect(service.detail(5,{...seller,branchId:4})).rejects.toMatchObject({status:403});
    await expect(service.detail(5,{...seller,branchId:null})).rejects.toMatchObject({status:403});
  });
  test.each([
    {destinationType:'TERCERO',thirdPartyId:undefined,destinationBranchId:undefined},
    {destinationType:'TERCERO',thirdPartyId:8,destinationBranchId:3},
    {destinationBranchId:undefined},{thirdPartyId:8},
    {items:[{variantId:12,quantity:1},{variantId:12,quantity:1}]},
  ])('creación rechaza destino ambiguo o ítems duplicados %j',async(change)=>{
    await expect(service.create({...dto(),...change},admin)).rejects.toMatchObject({status:400});
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  test.each(['warehouse','branch','productVariant'])('creación exige %s activo',async(model)=>{
    db[model].findFirst.mockResolvedValue(null);
    await expect(service.create(dto(),admin)).rejects.toMatchObject({status:400});
    expect(inventory.decrement).not.toHaveBeenCalled();
  });
  test('tercero inexistente se rechaza; tercero válido cierra salida inmediatamente',async()=>{
    const input={...dto(),destinationType:'TERCERO',destinationBranchId:undefined,thirdPartyId:8};
    db.thirdParty.findFirst.mockResolvedValueOnce(null);
    await expect(service.create(input,admin)).rejects.toMatchObject({status:400});
    const result=await service.create(input,admin);
    expect(result).toMatchObject({status:'CERRADA',destinationBranchId:null,thirdPartyId:8,
      receivedById:1,receivedAt:expect.any(Date),closedAt:expect.any(Date)});
    expect(inventory.decrement).toHaveBeenCalledWith(db,12,'BODEGA',2,2);
    expect(notifications.notifyTransferCreated).not.toHaveBeenCalled();
  });
  test('envío exige pendiente y conserva notas si no se reemplazan',async()=>{
    await expect(service.send(5,{},admin)).rejects.toMatchObject({status:404});
    db.transfer.findUnique.mockResolvedValue(transfer());
    await expect(service.send(5,{},admin)).rejects.toMatchObject({status:400});
    db.transfer.findUnique.mockResolvedValue({...transfer(),status:'PENDIENTE'});
    expect(await service.send(5,{},admin)).toMatchObject({status:'ENVIADA',notes:'Original',sentAt:expect.any(Date)});
    expect(await service.send(5,{notes:'Nueva'},admin)).toMatchObject({notes:'Nueva'});
  });
  test.each([
    [null,manager,{items:[]},404],
    [{status:'PENDIENTE'},manager,{items:[]},400],
    [{destinationType:'TERCERO'},manager,{items:[]},400],
    [{destinationBranchId:4},manager,{items:[]},403],
    [{destinationBranchId:null},admin,{items:[]},400],
    [{},manager,{items:[]},400],
    [{items:[{id:9,quantity:2},{id:10,quantity:2}]},manager,{items:[{transferItemId:9},{transferItemId:9}]},400],
    [{},manager,{items:[{transferItemId:99,receivedQuantity:1}]},400],
    [{},manager,{items:[{transferItemId:9,receivedQuantity:1,damagedQuantity:2}]},400],
    [{},manager,{items:[{transferItemId:9,receivedQuantity:3}]},400],
  ])('recepción inválida %j %j',async(change,user,input,status)=>{
    db.transfer.findUnique.mockResolvedValue(change===null?null:{...transfer(),...change});
    await expect(service.confirm(5,input,user)).rejects.toMatchObject({status});
    expect(db.transfer.update).not.toHaveBeenCalled();expect(notifications.notifyTransferReceived).not.toHaveBeenCalled();
  });
  test.each([[manager,'ENVIADA',2,1,'RECIBIDA'],[seller,'PENDIENTE',2,0,'CERRADA'],[manager,'ENVIADA',0,0,'RECIBIDA']])(
    'recepción %j estado %s cantidad %i dañados %i',async(user,status,receivedQuantity,damagedQuantity,expected)=>{
      db.transfer.findUnique.mockResolvedValue({...transfer(),status});
      const result=await service.confirm(5,{items:[{transferItemId:9,receivedQuantity,damagedQuantity}]},user);
      expect(result).toMatchObject({status:expected,receivedById:user.id,receivedAt:expect.any(Date)});
      expect(db.transferItem.update).toHaveBeenCalledWith({where:{id:9},data:{receivedQuantity,damagedQuantity}});
      if(receivedQuantity>damagedQuantity) expect(inventory.increment).toHaveBeenCalledWith(db,12,'SUCURSAL',3,receivedQuantity-damagedQuantity);
      else expect(inventory.increment).not.toHaveBeenCalled();
      if(expected==='CERRADA')expect(result.closedAt).toEqual(result.receivedAt);
      expect(notifications.notifyTransferReceived).toHaveBeenCalledWith(result);
    });
  test('cierre rechaza transferencia inexistente',async()=>{
    await expect(service.close(5,admin)).rejects.toMatchObject({status:404});expect(db.transfer.update).not.toHaveBeenCalled();
  });
});
