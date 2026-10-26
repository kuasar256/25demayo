import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');

  // Cabeceras de seguridad HTTP (Prevención de MIME-sniffing, Clickjacking, XSS y ejecución de contenido subido)
  // Se relaja CSP para la ruta /api/docs (Swagger UI necesita scripts inline)
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    const isSwagger = _req.url?.startsWith('/api/docs');
    if (!isSwagger) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; base-uri 'self';",
      );
    }
    next();
  });

  // Validación y sanitización estricta de DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Configuración de CORS segura
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Acceso no permitido por política de seguridad CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Servir imágenes subidas desde /uploads de forma segura (con soporte retrocompatible)
  const uploadsDir = join(__dirname, '..', 'public', 'uploads');
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/uploads/' });

  // --- Documentación interactiva de API (Swagger / OpenAPI) ---
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Colchones 25 de Mayo — API')
    .setDescription(
      'API REST del Sistema de Gestión de Inventario, Ventas y Producción de Colchones 25 de Mayo.\n\n' +
      'Autenticarse primero en **POST /api/auth/login** y luego usar el botón **Authorize** con el token JWT recibido.',
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addTag('Autenticación', 'Login, registro y recuperación de contraseña')
    .addTag('Usuarios', 'Gestión de usuarios y roles del sistema')
    .addTag('Catálogo', 'Productos, variantes, categorías y catálogo de vendedor')
    .addTag('Ubicaciones', 'Bodegas (fábrica) y sucursales comerciales')
    .addTag('Inventario', 'Stock actual, kárdex de movimientos, ingresos y ajustes')
    .addTag('Transferencias', 'Despachos de fábrica a sucursales y terceros')
    .addTag('Ventas', 'Registro de ventas, anulaciones, saldos y garantías')
    .addTag('Clientes', 'Padrón de clientes y proveedores/terceros')
    .addTag('Caja', 'Turnos de caja, arqueo diario y movimientos menores')
    .addTag('Producción', 'Órdenes de fabricación y taller')
    .addTag('Cotizaciones', 'Proformas y presupuestos comerciales')
    .addTag('Reportes', 'Dashboard, reportes de ventas, transferencias y auditoría')
    .addTag('Auditoría', 'Bitácora de acciones y trazabilidad')
    .addTag('Notificaciones', 'Alertas del sistema en tiempo real')
    .addTag('Upload', 'Subida segura de imágenes de productos')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Colchones 25 de Mayo — Documentación API',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend corriendo en http://localhost:${port}`);
  console.log(`📄 Documentación API en http://localhost:${port}/api/docs`);
}
bootstrap();

