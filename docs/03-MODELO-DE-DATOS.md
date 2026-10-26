# Modelo de datos (resumen)

Ver `backend/prisma/schema.prisma` para la fuente exacta.

## Entidades principales
- **User** (email, password hash, role, branchId?, isActive, failedAttempts, lockedUntil)
- **Warehouse** (bodegas de fábrica) / **Branch** (sucursales)
- **Category → Product → ProductVariant**
  (variante: size, type, color, price, minStock, maxStock, sku)
- **Stock** (variantId + locationType + locationId + quantity, único por combinación)
- **StockMovement** (trazabilidad: tipo, cantidad ±, motivo, usuario, referencia, fecha)
- **Transfer** + **TransferItem**
  (estados: PENDIENTE → ENVIADA → RECIBIDA → CERRADA; diferencias recibidas/dañadas)
- **ThirdParty** (terceros/distribuidores, sin acceso al sistema)
- **Client** (CI único, nombre, teléfono, historial de compras)
- **Sale** + **SaleItem** (estado ACTIVA/ANULADA, motivo y responsable de anulación)
- **AuditLog** (quién, qué, cuándo, desde dónde)
- **Notification** (campana: stock crítico, transferencias, anulaciones, bloqueos)

## Decisiones importantes
1. **Stock identificado por (variante, tipo de ubicación, id de ubicación)** —
   una sola tabla soporta bodegas y sucursales sin duplicar lógica.
2. **Movimientos con signo** (+ entra, − sale) para trazabilidad completa y
   conciliación (descuadres).
3. **Descuentos atómicos** con `UPDATE ... WHERE quantity >= ?` para evitar
   ventas/transferencias con stock insuficiente en concurrencia.
4. **Precios siempre calculados en el servidor** al crear la venta — el cliente
   nunca envía el total.
5. **Anulación restituye stock** con movimiento ANULACION_VENTA, motivo y
   responsable obligatorios.
6. **Auditoría en dos niveles**: interceptor global de mutaciones + eventos
   semánticos (login, bloqueo).
