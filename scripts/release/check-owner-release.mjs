import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
const knownFile = 'work-phase-photo-session-guard.test.mjs';
const knownFailures = [
  'falha temporária ao retomar sessão não remove a sessão do dispositivo',
  'falha temporária depois da renovação preserva o token mais recente',
  'sessão comprovadamente inválida é removida e exige autenticação'
];
const knownAuthHash = '2e982198c1811587002eb6687180ee91c48e83af1082c501ab857ce28ed68894';
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
let passed = 0, failures = 0, suites = 0;
for (const file of files.filter(n => !historical.has(n))) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/' + file], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
  if (r.error) throw r.error;
  const output = r.stdout + '\n' + r.stderr;
  const pass = Number(output.match(/^# pass (\d+)$/m)?.[1] || 0);
  const fail = Number(output.match(/^# fail (\d+)$/m)?.[1] || 0);
  const names = [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(m => m[1]);
  if (file === knownFile) {
    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'public-assets/obraativa-social-auth-v1.js'))).digest('hex');
    if (actualHash !== knownAuthHash || fail !== knownFailures.length || names.length !== knownFailures.length || names.some(n => !knownFailures.includes(n))) {
      throw new Error('A base ou as falhas conhecidas mudaram; revisar sem ignorar: ' + JSON.stringify(concise(output)));
    }
    console.log('KNOWN_BASELINE_FAILURES: ' + file + ' — ' + JSON.stringify(names));
    failures += fail;
  } else if (r.status !== 0 || fail !== 0) {
    throw new Error('REGRESSION: ' + file + '\n' + concise(output).join('\n'));
  }
  passed += pass; suites++;
}
console.log(JSON.stringify({ status: 'OWNER_RELEASE_SCOPE_VERIFIED_WITH_KNOWN_BASELINE_FAILURES', runtimeFiles: runtime.length, executedSuiteFiles: suites, passedTests: passed, knownFailedTests: failures, historicalSuiteFilesNotRun: historical.size, note: 'Não equivale a regressão geral totalmente aprovada. Falhas conhecidas continuam executadas e não foram corrigidas nem ocultadas.' }, null, 2));
