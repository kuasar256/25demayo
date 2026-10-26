// Selección equilibrada. test:full ejecuta también los casos complementarios.
const full = require('./jest.full.config.cjs');
const complementaryCases = [
  'Autenticación:.*Google',
  'Reportes:.*(?:dashboard|ranking productos|auditoría filtra)',
  'Catálogo: identidad, disponibilidad y sincronización de variantes (?:sincroniz|sin cambios|rechaza variantes ajenas)',
  'Notificaciones: destinatarios y propiedad (?:consulta y marcado|lectura individual|recepción notifica|anulación incluye)',
];
module.exports = {
  ...full,
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/extended/archivos.spec.js',
    '/test/extended/infraestructura.spec.js',
  ],
  testNamePattern: '^' + complementaryCases.map((pattern) => '(?!.*' + pattern + ')').join(''),
  coverageThreshold: {
    global: { statements: 85, branches: 85, functions: 85, lines: 85 },
  },
};
