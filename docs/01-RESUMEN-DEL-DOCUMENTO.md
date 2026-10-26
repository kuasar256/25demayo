# Resumen del documento "PROMPT MAESTRO 1.1"

## Contexto de negocio
- Empresa boliviana de fabricación y venta de colchones y catres.
- Fábrica central con varias bodegas internas + menos de 5 sucursales propias.
- Venta directa en fábrica, distribución a sucursales y a terceros/distribuidores.
- Moneda: Bolivianos (Bs). Sin integraciones externas obligatorias por ahora.

## Problema
Sin sistema: no se sabe qué hay en cada bodega/sucursal, qué sale y a dónde,
qué se vende ni a qué precio, ni quién registró cada movimiento.
Resultado: descuadres, pérdidas, ventas no registradas y falta de stock.

## Solución propuesta
Sistema web centralizado (MVC modular en capas):
1. **Presentación**: interfaces responsive por rol.
2. **Control**: validación, permisos por rol, coordinación.
3. **Negocio**: entidades + reglas (stock mínimo, recepción obligatoria, descuento).
4. **Datos**: BD relacional centralizada + auditoría + respaldos.
5. **Infraestructura**: backups, seguridad, notificaciones internas.

## Módulos (9 + 1 transversal)
Seguridad/usuarios · Catálogo · Ubicaciones · Inventario · Transferencias ·
Ventas · Clientes y terceros · Reportes · Auditoría + Notificaciones.

## Reglas clave de negocio
- Transferencia fábrica→sucursal: **recepción obligatoria** para cerrar.
- Transferencia fábrica→tercero: se registra salida y se cierra (sin confirmación).
- Venta: cliente siempre identificado por **CI** (buscar, autocompletar o crear).
- Anulación: motivo obligatorio + reglas por rol (vendedor solo propias y mismo día).
- Stock mínimo/máximo por variante → alertas automáticas.
- **Permisos aplicados en backend**, no solo en la interfaz.
- Resiliencia offline con sincronización (fase posterior).

## Roles fijos (1 usuario = 1 rol)
| Rol | Alcance |
|---|---|
| ADMIN_GENERAL | Control total, auditoría, usuarios |
| ADMIN | Todo excepto crear admins, modifica precios |
| ENCARGADO_FABRICA | Bodegas, ingresos, transferencias |
| ENCARGADO_SUCURSAL | Solo su sucursal: recepción, ventas, anulaciones |
| VENDEDOR | Solo registra ventas en su sucursal, ve stock y clientes |

## Lo NO incluido en esta versión
Facturación electrónica · crédito/apartados/pagos parciales · devoluciones/cambios ·
materia prima · costos de fabricación · inventario en tránsito · flujos de aprobación ·
roles personalizados · acceso de terceros al sistema.

## Diseño visual
Fondo #FFFFFF / #F5F6FA, tarjetas blancas con sombra suave, rojo #F20732
(énfasis/datos/alertas), azul #07038C (navegación/encabezados), éxito #28A745,
advertencia #FFC107. Fuente Poppins. Modo claro y oscuro. Responsive.
