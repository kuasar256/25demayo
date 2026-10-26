# Subir el proyecto a GitHub sin publicar datos privados

## Antes de subir

1. Crea un repositorio vacío en GitHub; elige privado si solo necesitas compartirlo con tus docentes. No generes otro README desde GitHub si vas a publicar esta carpeta con su README.
2. Usa Node.js 24 y npm 11. Los comandos se ejecutan manualmente; no hay pipelines configurados en este proyecto.
3. Desde la raíz ejecuta `git status --short` y `git status --short --ignored`. Verifica que .env, node_modules, dist, coverage, bases .db y archivos subidos aparezcan ignorados, no preparados para commit.
4. Conserva package-lock.json de backend y frontend, schema.prisma, los tests, migraciones, archivos .env.example y el código fuente.
5. Si ya publicaste secretos en otro repositorio, el .gitignore no los elimina del historial: revoca/rota las claves y revisa ese historial antes de reutilizarlo. Nunca pegues tokens de acceso en una URL remota ni en el README.

## Publicación manual

El ZIP limpio no incluye metadatos .git. Extrae el ZIP en una carpeta nueva e inicializa Git con tu usuario de Windows. No se crearon commits ni se configuró un remoto. Comprueba tu nombre/correo Git y ejecuta desde esa carpeta:

```bash
git init -b main
git add .
git diff --cached --stat
git diff --cached --name-only
git commit -m "Preparar proyecto Colchones 25 de Mayo"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Reemplaza TU_USUARIO y TU_REPOSITORIO. Si origin ya existe, inspecciónalo con `git remote -v` en vez de añadirlo otra vez. Usa el administrador de credenciales de Git/GitHub para autenticarte. No uses `git add -f` para introducir archivos ignorados.

## Evitar ejecuciones automáticas y consumo no deseado

El repositorio se entrega sin .github/workflows, sin Dependabot/Renovate configurado y sin hooks de instalación que invoquen agentes. No se instalaron bots ni se configuraron claves de proveedores de IA. AGENTS.md expresa la política de trabajo manual; no es un interruptor de facturación.

Después de crear el repositorio, revisa en GitHub:

- En Settings → Actions → General, selecciona Disable actions si no deseas ejecutar workflows. La configuración debe guardarse en GitHub; ningún .gitignore puede hacerlo por ti.
- En Settings → Rules → Rulesets, revisa reglas que soliciten revisiones automáticas de Copilot y desactívalas si no las quieres. Revisa también las preferencias de revisión automática de tu cuenta y las políticas de la organización, si el repositorio pertenece a una.
- Revisa las aplicaciones instaladas y sus permisos sobre el nuevo repositorio. No habilites agentes de revisión o programación sin querer utilizarlos.
- Revisa los presupuestos y límites del proveedor de IA que uses. No se verificó ni modificó la configuración de tu cuenta, tus aplicaciones o tu facturación desde esta preparación local.

GitHub Actions utiliza sus propios recursos y no es lo mismo que tokens de una API de IA. El consumo depende de las herramientas autorizadas y de los comandos que ejecuten. No existe un archivo universal que impida a cualquier bot leer un repositorio público o consumir recursos de una cuenta.

Documentación oficial:
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-code-review

## Instalar desde una copia nueva

```bash
cd backend
npm ci
cp .env.example .env
# Editar .env con la conexión real local y una clave JWT privada
npm run prisma:generate
npm run build
npm start
```

PostgreSQL debe estar iniciado y la base existente debe tener la estructura compatible. No apliques migraciones ni seeds a una base real sin revisar el SQL y disponer de respaldo. Para una base NUEVA y vacía de desarrollo, consulta la sección de bases de datos del README; el historial de migraciones guardado es SQLite y el esquema activo es PostgreSQL.

En otra terminal:

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev
```

En Windows también puedes copiar los archivos con `Copy-Item .env.example .env`. No sobrescribas un .env existente con valores privados.

Pruebas manuales desde backend: `npm run test:full` para el conjunto completo; `npm test` para el perfil selectivo existente. El script start espera el backend compilado en dist/src/main.js. El frontend se compila con `npm run build` dentro de frontend.

## Archivos que no se publican

Los archivos cargados por usuarios en backend/public/uploads y la base local backend/prisma/dev.db permanecen en tu equipo. Solo se versiona .gitkeep para conservar la carpeta uploads vacía. Los cuatro scripts locales seed-catalog.ts, seed-dashboard.js, seed-day.ts y seed-sales.ts se excluyen por ser generadores ad hoc; el seed documentado backend/prisma/seed.ts se conserva como código de demostración. Ninguno se ejecuta al subir a GitHub.

No se añadió licencia automáticamente: el propietario debe decidir los permisos de reutilización del proyecto.

## Propiedad de la carpeta Git en Windows

Durante la verificación local se inicializó un repositorio vacío mediante el usuario aislado de la herramienta. No tiene commits ni remoto. Si Git muestra dubious ownership al usar la carpeta original, utiliza la copia del ZIP y ejecuta git init con tu usuario normal, como se indica arriba. El ZIP no contiene ese .git. No desactives la comprobación de propiedad globalmente ni agregues safe.directory=* para evitar el aviso.
