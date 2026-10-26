const {database,load}=require('./mocks');
const {of,lastValueFrom}=require('rxjs');
const {Logger}=require('@nestjs/common');
const fs=require('fs');
const {AuditInterceptor}=load('modules/audit/audit.interceptor');
const {UploadController}=load('modules/upload/upload.controller');
const ctx=(req)=>({switchToHttp:()=>({getRequest:()=>req})});

describe('Batería equilibrada: auditoría transversal',()=>{
  test('registra cambios con identidad y solo los nombres de campos',async()=>{
    const db=database();
    expect(await lastValueFrom(new AuditInterceptor(db).intercept(ctx({method:'POST',url:'/api/sales/5',user:{id:17},body:{password:'NO_GUARDAR'},ip:'127.0.0.1'}),{handle:()=>of({id:5})}))).toEqual({id:5});
    const data=db.auditLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({userId:17,module:'sales',entityId:5});
    expect(data.detail).not.toContain('NO_GUARDAR');
  });
  test.each([new Error('fallo simulado'),'fallo simulado'])('fallo de persistencia no impide respuesta %j',async(error)=>{
    const db=database();db.auditLog.create.mockRejectedValue(error);
    const logger=jest.spyOn(Logger.prototype,'error').mockImplementation(()=>{});
    try{
      expect(await lastValueFrom(new AuditInterceptor(db).intercept(ctx({method:'POST'}),{handle:()=>of(null)}))).toBeNull();
      await Promise.resolve();expect(logger).toHaveBeenCalled();
    }finally{logger.mockRestore();}
  });
});

describe('Batería equilibrada: validación de carga',()=>{
  afterEach(()=>jest.restoreAllMocks());
  test('rechaza archivo con tipo no permitido sin tocar archivos reales',()=>{
    const controller=new UploadController();
    const original=fs.readFileSync;
    jest.spyOn(fs,'readFileSync').mockImplementation((path,...args)=>path==='qa-simulado'?Buffer.from('contenido'):original(path,...args));
    const unlink=jest.spyOn(fs,'unlinkSync').mockImplementation(()=>undefined);
    expect(()=>controller.uploadImage({path:'qa-simulado',mimetype:'text/html'},{})).toThrow(expect.objectContaining({status:400}));
    expect(unlink).toHaveBeenCalledWith('qa-simulado');
    expect(()=>controller.uploadImage({path:'qa-simulado',mimetype:'image/jpeg'},{})).toThrow(expect.objectContaining({status:400}));
    expect(()=>controller.uploadImage(undefined,{})).toThrow(expect.objectContaining({status:400}));
  });
  test('filtros y extensión segura se verifican con almacenamiento simulado',()=>{
    const Interceptor=Reflect.getMetadata('__interceptors__',UploadController.prototype.uploadImage)[0];
    const uploader=new Interceptor().multer;
    const cb=jest.fn();
    uploader.storage.getFilename({}, {mimetype:'image/png'}, cb);
    expect(cb.mock.calls.at(-1)[1]).toMatch(/\.png$/);
    uploader.storage.getFilename({}, {}, cb);expect(cb.mock.calls.at(-1)[1]).toMatch(/\.jpg$/);
    const filter=jest.fn();uploader.fileFilter({}, {mimetype:'image/png',originalname:'imagen.png'}, filter);
    expect(filter).toHaveBeenCalledWith(null,true);
    uploader.fileFilter({}, {mimetype:'image/png',originalname:'script.svg'}, filter);
    expect(filter.mock.calls.at(-1)).toEqual([expect.objectContaining({status:400}),false]);
    uploader.fileFilter({}, {}, filter);expect(filter.mock.calls.at(-1)[1]).toBe(false);
  });
});

