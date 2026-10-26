# Pruebas y cobertura del backend

## Perfil equilibrado: npm run test

```powershell
npm run test
Start-Process ./coverage/index.html
```

Este comando compila el backend, ejecuta los 15 casos previos de regresión y la selección equilibrada de Jest. Al terminar, test/verify-balanced-coverage.cjs lee el resumen generado y verifica:

- Las cuatro métricas globales deben estar entre 85 % y 89 %.
- Los módulos audit, reports y upload deben alcanzar al menos 60 % en sentencias, ramas, funciones y líneas.

Los mínimos por módulo son agregados entre sus archivos; no implican que cada archivo individual supere ese porcentaje. El verificador no modifica el HTML, los colores ni los contadores de Jest.

Resultado verificado: 368 casos Jest y 15 de regresión aprobados, sin fallos. Entre los archivos seleccionados, 35 casos complementarios se omiten explícitamente mediante testNamePattern. Los archivos extendidos archivos.spec.js e infraestructura.spec.js tampoco se ejecutan en este perfil.

| Métrica global | Cobertura |
|---|---:|
| Sentencias | 88,45 % |
| Ramas | 85,79 % |
| Funciones | 88,06 % |
| Líneas | 88,72 % |

| Módulo | Sentencias | Ramas | Funciones | Líneas |
|---|---:|---:|---:|---:|
| Auditoría | 69,23 % | 90 % | 66,66 % | 72,72 % |
| Reportes | 65,02 % | 68,07 % | 70 % | 66,49 % |
| Carga de imágenes | 75 % | 63,63 % | 83,33 % | 73,91 % |

Los colores estándar clasifican las coberturas entre 50 % y menos de 80 % en amarillo. Estos tres módulos muestran ahora sentencias y líneas en ese intervalo. Las demás columnas conservan sus colores según su valor real.

La selección mantiene los ocho escenarios originales y los casos principales de inventario, ventas, transferencias, roles, caja, producción y clientes. Los casos completos de Google, variantes, notificaciones e indicadores complementarios permanecen disponibles en la batería completa. Las reglas de selección están declaradas en jest.config.cjs.

## Perfil completo: npm run test:full

```powershell
npm run test:full
Start-Process ./coverage-full/index.html
```

Ejecuta todos los archivos y casos disponibles, sin los filtros del perfil equilibrado. Conserva el mínimo del 85 % en las cuatro métricas y no aplica un máximo. El informe está separado para no sobrescribir coverage/index.html.

## Otros comandos

- npm run test:unit: batería completa sin HTTP; informe en coverage-unit.
- npm run test:http: caso HTTP de permisos de creación de usuarios.
- npm run test:regression: los 15 casos previos; requiere compilación.
- npm run build: compila el backend.

## Alcance

Ambos perfiles miden dist/src/**/*.js con las mismas exclusiones de arranque (main.js) y registro de módulos (*.module.js). Los mapas de origen muestran los archivos TypeScript. Las ejecuciones separadas con node:test no se suman a la cobertura Jest. Prisma, notificaciones y llamadas externas están simulados; no se acredita con estas métricas el comportamiento de una base de datos real, concurrencia, rendimiento o interfaz React.

Requisitos: Node.js 24.9 o posterior y dependencias instaladas. Se conserva experimental-vm-modules para las dependencias ESM de NestJS 12.

Verificación adicional: npm run test:full terminó con 442 casos Jest y 15 de regresión aprobados, sin omisiones ni fallos. Este perfil completo conserva su cobertura de líneas del 99,56 % en coverage-full; no sobrescribe el informe equilibrado de coverage.
