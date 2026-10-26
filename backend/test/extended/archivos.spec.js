const { load }=require('./mocks');
const fs=require('fs');
const { UploadController }=load('modules/upload/upload.controller');
const filePath='imagen-ficticia-qa';
const jpeg=Buffer.from([0xff,0xd8,0xff,0,0,0,0,0,0,0,0,0]);
const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
const webp=Buffer.from([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50]);
describe('Carga de imágenes: firmas binarias, origen y filtros',()=>{
  let controller,read,unlink;
  beforeEach(()=>{
    controller=new UploadController();
    const original=fs.readFileSync;
    read=jest.spyOn(fs,'readFileSync').mockImplementation((path,...args)=>path===filePath?jpeg:original(path,...args));
    unlink=jest.spyOn(fs,'unlinkSync').mockImplementation((path)=>{if(path!==filePath)throw new Error('Ruta no simulada');});
  });
  afterEach(()=>jest.restoreAllMocks());
  function useBytes(buffer){const original=read.getMockImplementation();read.mockImplementation((path,...args)=>path===filePath?buffer:original(path,...args));}
  const request=(forwarded)=>({protocol:'http',get:(name)=>name==='host'?'fabrica.test':forwarded});
  test('sin archivo no acepta carga',()=>{
    expect(()=>controller.uploadImage(undefined,request())).toThrow(expect.objectContaining({status:400}));expect(unlink).not.toHaveBeenCalled();
  });
  test.each([['image/jpeg',jpeg],['image/jpg',jpeg],['image/png',png],['image/webp',webp]])('acepta firma correcta %s', (mimetype,bytes)=>{
    useBytes(bytes);
    expect(controller.uploadImage({path:filePath,mimetype,filename:'imagen.jpg'},request('https,http')))
      .toEqual({url:'https://fabrica.test/uploads/imagen.jpg',filename:'imagen.jpg'});
    expect(unlink).not.toHaveBeenCalled();
  });
  test('sin proxy usa protocolo de la solicitud',()=>{
    expect(controller.uploadImage({path:filePath,mimetype:'image/jpeg',filename:'x.jpg'},request()).url).toBe('http://fabrica.test/uploads/x.jpg');
  });
  test.each([['image/jpeg',Buffer.from('script')],['image/webp',Buffer.from([0x52,0x49,0x46,0x46,0,0,0,0,0,0,0,0])],['text/html',jpeg]])('rechaza firma incongruente %s', (mimetype,bytes)=>{
    useBytes(bytes);
    expect(()=>controller.uploadImage({path:filePath,mimetype},request())).toThrow(expect.objectContaining({status:400}));
    expect(unlink).toHaveBeenCalledWith(filePath);
  });
  test('fallo de lectura y limpieza se transforma en rechazo de imagen',()=>{
    const original=read.getMockImplementation();read.mockImplementation((path,...args)=>{if(path===filePath)throw new Error('lectura');return original(path,...args);});
    unlink.mockImplementation(()=>{throw new Error('ausente');});
    expect(()=>controller.uploadImage({path:filePath,mimetype:'image/jpeg'},request())).toThrow(expect.objectContaining({status:400}));
  });
  test('interceptor conserva directorio de carga, extensión segura y filtros',()=>{
    const Interceptor=Reflect.getMetadata('__interceptors__',UploadController.prototype.uploadImage)[0];
    const uploader=new Interceptor().multer;
    const mkdir=jest.spyOn(fs,'mkdirSync').mockImplementation(()=>undefined);
    const destination=jest.fn();uploader.storage.getDestination({}, {}, destination);
    expect(mkdir).toHaveBeenCalledWith(expect.stringMatching(/public[\\/]uploads$/),{recursive:true});
    expect(destination).toHaveBeenCalledWith(null,expect.stringMatching(/public[\\/]uploads$/));
    const filename=jest.fn();uploader.storage.getFilename({}, {mimetype:'image/png',originalname:'malicioso.exe'}, filename);
    expect(filename).toHaveBeenCalledWith(null,expect.stringMatching(/^\d+-\d+\.png$/));
    uploader.storage.getFilename({}, {}, filename);expect(filename.mock.calls[1][1]).toMatch(/\.jpg$/);
    expect(uploader.limits.fileSize).toBe(5*1024*1024);
    const filter=jest.fn();uploader.fileFilter({}, {mimetype:'image/png',originalname:'imagen.PNG'}, filter);
    expect(filter).toHaveBeenCalledWith(null,true);
    uploader.fileFilter({}, {mimetype:'image/png',originalname:'script.svg'}, filter);
    expect(filter.mock.calls[1]).toEqual([expect.objectContaining({status:400}),false]);
    uploader.fileFilter({}, {}, filter);expect(filter.mock.calls[2][1]).toBe(false);
  });
});
