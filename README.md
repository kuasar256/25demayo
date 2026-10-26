# Sistema de Gestión — Colchones 25 de Mayo

Sistema web centralizado para administrar productos, inventario multi-bodega,
transferencias fábrica→sucursal/terceros, ventas, producción, caja, cotizaciones
y garantías post-venta, con trazabilidad completa, control por roles y reportes.
Empresa Colchones 25 de Mayo, Cochabamba, Bolivia (Bs).

## Stack Tecnológico
- **Backend**: Node.js + NestJS (MVC modular), Prisma ORM, JWT, PostgreSQL (esquema activo); SQLite para evaluación aislada
- **Frontend**: React + Vite, Tailwind CSS, React Query (servidor), Zustand (UI)
- **Documentación API**: Swagger / OpenAPI (`/api/docs`)
- **Monorepo**: `backend/` + `frontend/` + `docs/`

## Puesta en Marcha

### Backend
```bash
cd backend
cp .env.example .env          # configurar variables de entorno
npm install
npx prisma generate
# Solo para una base PostgreSQL NUEVA y vacía de desarrollo:
npx prisma db push
npm run seed                  # usuarios demo + catálogo + stock inicial
npm run dev                   # http://localhost:3000/api
```

### Bases de datos y migraciones

El esquema activo `backend/prisma/schema.prisma` utiliza **PostgreSQL**. Configure `DATABASE_URL` para ese motor. Los archivos de `backend/prisma/migrations/` y su `migration_lock.toml` corresponden al historial **SQLite**: se conservan como antecedentes y **no deben ejecutarse contra PostgreSQL**. Cambiar solamente el proveedor del lock no convierte el SQL histórico.

El comando `prisma db push` anterior está destinado exclusivamente a una base nueva y vacía de desarrollo. Para una base existente, especialmente producción, no ejecute `migrate reset`, no use `--accept-data-loss` y no aplique el historial SQLite. Prepare un historial PostgreSQL independiente, revise el SQL y establezca una línea base de acuerdo con la estructura real antes de incorporar migraciones. Este procedimiento de despliegue requiere verificación en su entorno y no fue ejecutado durante la validación funcional.

Para pruebas aisladas con SQLite, utilice una copia del esquema con `provider = "sqlite"`, un archivo de base nuevo y una salida del cliente Prisma independiente. No reemplace el cliente de la aplicación ni reutilice la conexión habitual. No se ejecuta el seed general sobre bases con datos reales.

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

### Pruebas Automatizadas
```bash
cd backend
npm test                      # compila y ejecuta pruebas de reglas de negocio
```

## Documentación Interactiva de API (Swagger)

Una vez levantado el backend, acceder a:

> **http://localhost:3000/api/docs**

Desde allí se pueden probar todos los endpoints de la API con autenticación JWT.
1. Ejecutar `POST /api/auth/login` con las credenciales demo.
2. Copiar el `token` de la respuesta.
3. Hacer clic en el botón **Authorize** y pegar el token.

## Usuarios Demo

Contraseña para todos: `admin123`

| Rol | Email | Alcance |
|---|---|---|
| ADMIN_GENERAL | duenio@colchones.bo | Control total del sistema |
| ADMIN | admin@colchones.bo | Administración operativa |
| ENCARGADO_FABRICA | fabrica@colchones.bo | Bodega central y producción |
| ENCARGADO_SUCURSAL | sucursal1@colchones.bo | Sucursal asignada |
| VENDEDOR | vendedor1@colchones.bo | Punto de venta |

## Estructura del Proyecto

```
colchones-sistema/
├── backend/
│   ├── prisma/             # Schema y migraciones de base de datos
│   ├── src/
│   │   ├── common/         # Guards, decoradores, enums y paginación
│   │   ├── modules/        # 14 módulos de negocio (auth, catalog, inventory, ...)
│   │   ├── prisma/         # Servicio de conexión Prisma
│   │   ├── app.module.ts   # Módulo raíz con guards globales
│   │   └── main.ts         # Bootstrap, seguridad, CORS y Swagger
│   └── test/               # Pruebas automatizadas de reglas de negocio
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes reutilizables (Layout, Modales, etc.)
│   │   ├── pages/          # 15 pantallas del sistema
│   │   ├── lib/            # Cliente API y React Query
│   │   └── store/          # Estado global (Zustand)
│   └── dist/               # Build de producción
└── docs/                   # Documentación del proyecto
```

## Variables de Entorno

### Backend (`.env`)
| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql://user:pass@localhost:5432/colchones_db` |
| `JWT_SECRET` | Clave secreta para firma JWT | (generar una clave segura) |
| `JWT_EXPIRES_IN` | Duración del token | `12h` |
| `PORT` | Puerto del servidor | `3000` |
| `CORS_ORIGIN` | Orígenes permitidos (separados por coma) | `http://localhost:5173` |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth | (opcional) |

## Documentación Técnica
- `docs/01-RESUMEN-DEL-DOCUMENTO.md` — Resumen del proyecto
- `docs/02-PLAN-DE-FASES.md` — Roadmap de desarrollo
- `docs/03-MODELO-DE-DATOS.md` — Decisiones del modelo de datos
- `docs/04-MATRIZ-PERMISOS.md` — Matriz de permisos por rol

## Repositorio y publicación manual

Usa **Node.js 24 y npm 11**. Las dependencias se reproducen con `npm ci` en backend y frontend. Las claves se configuran localmente a partir de `.env.example`; no se publican archivos `.env` ni datos de usuarios.

Consulta [la guía para subir a GitHub](docs/SUBIR-A-GITHUB.md) para revisar exclusiones, publicar manualmente y desactivar automatizaciones. El proyecto no incorpora workflows automáticos ni llamadas a APIs de IA. Las configuraciones de cuenta y aplicaciones deben revisarse en GitHub.

Antes de desplegar, revisa [las notas de seguridad](SECURITY.md). Publicar el código no equivale a desplegar la aplicación ni a resolver alertas de dependencias.
