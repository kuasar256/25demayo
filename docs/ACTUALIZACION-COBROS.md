# Actualización de cobros y arqueos

La versión corregida registra cada cobro en `SalePayment`, con importe aplicado,
medio, usuario, venta y turno. La creación de venta conserva un registro INITIAL
(incluso si su importe es cero); cada cobro de saldo crea uno BALANCE. Los cobros
de saldo ya no generan una entrada indistinta en caja chica.

En el PostgreSQL local de este proyecto se aplicó la actualización aditiva
`backend/prisma/sql/add-sale-payments.postgresql.sql`. No se alteraron ventas,
cajas ni importes históricos. Reiniciar el backend para cargar el cliente y el
código nuevos. Para otro entorno PostgreSQL, aplicar esa actualización revisada
antes de iniciar esta versión y ejecutar `npx prisma generate`. No aplicar las
migraciones históricas SQLite contra PostgreSQL ni usar reset.

Las cajas con ventas antiguas sin registro INITIAL se señalan con
`needsReconciliation`. Su resumen es orientativo y no pueden cerrarse como si
estuvieran conciliadas: los registros anteriores no permiten reconstruir con
certeza qué parte se cobró por cada medio y turno. Deben conciliarse a partir de
comprobantes reales, sin generar cobros ficticios ni duplicar movimientos.

La validación de las correcciones se realizó con HTTP real: los 38 casos de
auditoría fueron aprobados en una base SQLite nueva y también en un esquema
PostgreSQL QA nuevo y separado. Se añadieron comprobaciones de turnos y
conciliación. La estructura de cobros en PostgreSQL local también se verificó.
Esto no sustituye las pruebas de concurrencia, respaldos y despliegue antes del
lanzamiento.
