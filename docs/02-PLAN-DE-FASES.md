# Plan de desarrollo por fases

## Fase 0 — Fundaciones ✅
- Arquitectura MVC modular NestJS + Prisma (SQLite dev → PostgreSQL prod).
- Modelo de datos completo (21 modelos): usuarios, roles, catálogo, ubicaciones, stock,
  movimientos, transferencias, clientes, ventas, caja, producción, cotizaciones,
  auditoría, notificaciones y garantías.
- Auth JWT con intentos fallidos, bloqueo y Google OAuth.
- Guards de roles (permisos en backend, 5 niveles jerárquicos).
- Seed con datos demo (5 usuarios, catálogo, bodegas, sucursales, stock).
- Scaffold frontend: React + Vite + Tailwind + React Query + Zustand.

## Fase 1 — Backend completo ✅
- [x] Módulos backend con lógica de negocio central:
  inventario (descuento atómico anti-race-condition, ajustes, alertas),
  transferencias (crear/enviar/confirmar/cerrar + diferencias y mermas),
  ventas (CI, stock, anulación por rol, ranking, anticipo/contado),
  caja (apertura, movimientos, arqueo ciego), producción (órdenes OF-),
  cotizaciones (proformas COT-), garantías post-venta.
- [x] Pruebas unitarias de reglas críticas (15 tests: stock, anulación, transferencias, paginación, RBAC).
- [x] Reportes con series cronológicas, comparación periódica y exportación CSV.
- [x] Rate limiting en login (por IP: 15 intentos / 10 min; por cuenta: 5 intentos / 15 min).
- [x] Validación de magic bytes en subida de archivos.
- [x] Documentación interactiva de API (Swagger / OpenAPI en `/api/docs`).

## Fase 2 — Frontend completo ✅
- [x] 15 pantallas de los 14 módulos con CRUD + filtros + paginación.
- [x] Registro de venta con autocompletado de CI (búsqueda en vivo).
- [x] Wizard de transferencia (selección de productos, cantidades, destino).
- [x] Confirmación de recepción con registro de diferencias y daños.
- [x] Gráficas interactivas (Recharts: área, dona, series temporales).
- [x] Modo oscuro completo.
- [x] Catálogo showroom para vendedores con enlace directo a venta.
- [x] Ticket térmico imprimible y envío por WhatsApp.
- [x] Cotizaciones formales A4 con firma y conversión a venta.
- [x] Consulta de garantías vigentes/vencidas.

## Fase 3 — Posibles expansiones (fuera de alcance actual)
- Facturación electrónica boliviana (SIAT / SIN).
- API externa de consulta de CI.
- Modo offline por sucursal con sincronización (cola de operaciones).
- Respaldos automáticos verificados y cifrado en reposo.
- Monitoreo de errores (Sentry o similar).
- PWA y notificaciones push.
- Apps móviles (la API REST ya está preparada).
