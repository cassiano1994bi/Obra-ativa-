import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const historical = new Map([
  ['assistant-bubble-release-integrity.test.mjs', 'Compara pacotes fixos de 29/30-08 ausentes; não representa o pacote atual.'],
  ['assistant-complete-capabilities-release-integrity.test.mjs', 'Compara hashes e listas de pacotes fixos de 30-08 ausentes.'],
  ['assistant-employee-experience-release-integrity.test.mjs', 'Compara hashes e listas de pacotes fixos de 30-08 ausentes.'],
  ['assistant-phase4.test.mjs', 'Inclui invariância contra backup assistant-phase4-before-20260829 ausente.'],
  ['assistant-phase5.test.mjs', 'Inclui invariância contra backup assistant-phase5-before-20260829 ausente.'],
  ['assistant-phase6.test.mjs', 'Inclui invariância contra backup assistant-phase6-before-20260829 ausente.'],
  ['team-xss-isolated.test.mjs', 'Exige pacote histórico ausente; as mesmas verificações da fonte atual estão em team-xss-current-release.test.mjs.']
]);
const concise = (text) => String(text || '').split(/\r?\n/).filter(l => /^\s*not ok|^\s*error:|ENOENT|^# (tests|pass|fail)/.test(l)).map(l => l.slice(0, 220)).slice(0, 20);
function run(args, label) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
  if (r.error) throw r.error;
  const output = r.stdout + '\n' + r.stderr;
  if (r.status !== 0) throw new Error(label + ': ' + concise(output).join('\n'));
  return output;
}
for (const checker of ['check-project-conventions.mjs', 'check-public-performance.mjs', 'check-release-assets.mjs']) {
  run(['scripts/quality/' + checker], checker);
  console.log('CHECK_OK: ' + checker);
}
const runtime = [
  ...fs.readdirSync(path.join(root, 'public-assets')).filter(n => n.endsWith('.js')).map(n => 'public-assets/' + n),
  ...fs.readdirSync(path.join(root, 'netlify/functions')).filter(n => n.endsWith('.mjs')).map(n => 'netlify/functions/' + n)
];
for (const file of runtime) run(['--check', file], 'Sintaxe ' + file);
const files = fs.readdirSync(path.join(root, 'tests')).filter(n => n.endsWith('.test.mjs')).sort();
for (const [file, reason] of historical) {
  if (!files.includes(file)) throw new Error('A suíte histórica precisa continuar disponível para revisão: ' + file);
  console.log('HISTORICAL_NOT_RUN: ' + file + ' — ' + reason);
}
let passed = 0, suites = 0;
for (const file of files.filter(n => !historical.has(n))) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/' + file], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
  if (r.error) throw r.error;
  const output = r.stdout + '\n' + r.stderr;
  const pass = Number(output.match(/^# pass (\d+)$/m)?.[1] || 0);
  const fail = Number(output.match(/^# fail (\d+)$/m)?.[1] || 0);
  if (r.status !== 0 || fail !== 0) {
    throw new Error('REGRESSION: ' + file + '\n' + concise(output).join('\n'));
  }
  passed += pass; suites++;
}
console.log(JSON.stringify({ status: 'OWNER_RELEASE_SCOPE_VERIFIED', runtimeFiles: runtime.length, executedSuiteFiles: suites, passedTests: passed, failedTests: 0, historicalSuiteFilesNotRun: historical.size, note: 'Todas as suítes atuais executáveis foram aprovadas; somente comparações históricas de pacotes ausentes permaneceram fora da execução.' }, null, 2));
