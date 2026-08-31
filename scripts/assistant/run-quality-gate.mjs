import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tests = [
  'tests/assistant-quality-auditor.test.mjs',
  'tests/assistant-technical-expert.test.mjs',
  'tests/assistant-digital-employee.test.mjs',
  'tests/assistant-command-layer.test.mjs',
  'tests/assistant-phase1.test.mjs',
  'tests/assistant-phase2.test.mjs',
  'tests/assistant-phase3.test.mjs',
  'tests/assistant-phase4.test.mjs',
  'tests/assistant-phase5.test.mjs',
  'tests/assistant-phase6.test.mjs',
  'tests/assistant-employee-experience-release-integrity.test.mjs',
  'tests/source-syntax.test.mjs'
];

function run(relative) {
  const result = spawnSync(process.execPath, [path.join(projectRoot, relative)], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`A verificação falhou em ${relative}.`);
}

run('scripts/quality/check-project-conventions.mjs');
run('scripts/quality/check-public-performance.mjs');
run('scripts/assistant/generate-code-snapshot.mjs');
for (const test of tests) run(test);
console.log(`ASSISTANT_QUALITY_GATE_OK: snapshot atualizado e ${tests.length} suítes isoladas aprovadas; nenhuma publicação ou dado empresarial foi alterado.`);
