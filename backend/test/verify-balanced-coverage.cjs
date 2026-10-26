// Valida el informe producido por Jest, sin modificarlo.
const fs = require('node:fs');
const path = require('node:path');
const summary = JSON.parse(fs.readFileSync(path.join(__dirname, '../coverage/coverage-summary.json'), 'utf8'));
const metrics = ['statements', 'branches', 'functions', 'lines'];
const failures = [];
for (const metric of metrics) {
  const value = summary.total[metric].pct;
  if (value < 85 || value > 89) failures.push(`${metric}: ${value}% (intervalo global esperado: 85-89%)`);
}
for (const moduleName of ['audit', 'reports', 'upload']) {
  const entries = Object.entries(summary).filter(([file]) => file.replace(/\\/g, '/').includes(`/src/modules/${moduleName}/`));
  if (!entries.length) { failures.push(`No se midió el módulo ${moduleName}`); continue; }
  const result = {};
  for (const metric of metrics) {
    const total = entries.reduce((sum, [, data]) => sum + data[metric].total, 0);
    const covered = entries.reduce((sum, [, data]) => sum + data[metric].covered, 0);
    const pct = total ? Math.floor(covered / total * 10000) / 100 : 100;
    result[metric] = pct;
    if (pct < 60) failures.push(`${moduleName}.${metric}: ${pct}% (mínimo del módulo: 60%)`);
  }
  console.log(`${moduleName}: ${result.lines}% líneas; ${result.statements}% sentencias; ${result.branches}% ramas; ${result.functions}% funciones`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Perfil equilibrado verificado: métricas globales entre 85% y 89%; módulos seleccionados con mínimo 60%.');
}
