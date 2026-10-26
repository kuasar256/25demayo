# Matriz de permisos por módulo (implementada en backend con @Roles)

| Módulo | Admin. General | Admin | Enc. Fábrica | Enc. Sucursal | Vendedor |
|---|---|---|---|---|---|
| Seguridad y usuarios | Total | Parcial* | — | — | — |
| Catálogo de productos | Total | Total | Ver | Ver | Ver |
| Ubicaciones | Total | Total | Ver | Ver su sucursal | Ver su sucursal |
| Inventario | Total | Total | Fábrica (bodegas) | Su sucursal | Ver stock |
| Transferencias | Total | Total | Crear/enviar | Confirmar recepción | — |
| Ventas | Total | Total | — | Registrar y anular | Registrar y anular propias (mismo día) |
| Clientes y terceros | Total | Total | Ver terceros | Ver clientes | Ver clientes |
| Reportes | Total | Total | Fábrica | Su sucursal | Ver ranking |
| Auditoría | Total | Total | — | — | — |
| Notificaciones | Sí | Sí | Sí | Sí | Sí |

\* Parcial: el Administrador no puede crear ni eliminar administradores
(solo el Administrador General). Jerarquía implementada en `UsersService`.

Reglas transversales:
- Permisos aplicados en **backend** (guards NestJS), la UI solo oculta acciones.
- Terceros/distribuidores **no** acceden al sistema.
- Vendedor solo anula sus ventas del mismo día, con motivo obligatorio.
