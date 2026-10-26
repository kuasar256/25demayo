# Política de automatización y trabajo con agentes

Este proyecto se mantiene con ejecuciones manuales para controlar el consumo.

- Trabajar únicamente sobre lo solicitado por el propietario.
- No crear ni activar workflows, tareas programadas, bots, revisiones automáticas, agentes en la nube o llamadas a APIs de IA sin autorización explícita.
- No instalar Git hooks ni herramientas que lancen agentes al hacer commit o push.
- No ejecutar despliegues, publicar ni hacer push sin autorización explícita.
- No leer ni publicar .env, bases reales, respaldos, uploads o claves privadas.
- Las pruebas deben usar mocks o una base aislada. No ejecutar seeds ni migraciones contra datos reales.
- Conservar las pruebas existentes; no cambiar sus resultados o cobertura para alcanzar una cifra predeterminada.
- Leer solamente archivos relacionados con la tarea; excluir node_modules, dist y coverage de búsquedas generales.
- Ejecutar las comprobaciones adecuadas una vez por cambio; repetirlas únicamente ante cambios nuevos o fallos.

Estas instrucciones orientan a los agentes que las respetan. No revocan permisos de aplicaciones ni sustituyen la configuración de automatizaciones y facturación en GitHub o en el proveedor de IA.
