# Seguridad

No publiques claves, archivos .env, bases de datos, respaldos ni datos de clientes. Usa las plantillas .env.example y configura los valores privados fuera de Git.

Los botones de demostración solo se muestran en desarrollo. Antes de desplegar, cambia las contraseñas iniciales o desactiva las cuentas demo; ocultar botones no invalida sus credenciales. Configura NODE_ENV=production y JWT_SECRET con una clave aleatoria de al menos 32 caracteres.

La revisión del 26 de octubre de 2026 detectó alertas pendientes de dependencias, incluidas dependencias de producción del backend. Preparar el repositorio para GitHub no resuelve esas alertas ni certifica la seguridad del despliegue. Consulta npm audit desde backend y frontend para obtener el estado actual; ese comando se ejecuta manualmente.

Para informar una vulnerabilidad, utiliza un canal privado con el propietario del proyecto. No abras una incidencia pública con contraseñas, datos personales ni instrucciones que expongan una instalación real. El repositorio no declara un canal de reporte privado ya habilitado: debe configurarlo su propietario.
