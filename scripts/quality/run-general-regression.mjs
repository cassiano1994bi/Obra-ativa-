import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function run(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} falhou.`);
}

for (const checker of [
  'scripts/quality/check-project-conventions.mjs',
  'scripts/quality/check-public-performance.mjs',
  'scripts/quality/check-release-assets.mjs'
]) run([checker], checker);
run(['scripts/assistant/generate-code-snapshot.mjs'], 'inventário técnico');

const syntaxFiles = [
  ...fs.readdirSync(path.join(projectRoot, 'public-assets'))
    .filter((name) => name.endsWith('.js'))
    .map((name) => `public-assets/${name}`),
  ...fs.readdirSync(path.join(projectRoot, 'netlify', 'functions'))
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => `netlify/functions/${name}`)
];
for (const fileName of syntaxFiles) run(['--check', fileName], `sintaxe de ${fileName}`);

const tests = fs.readdirSync(path.join(projectRoot, 'tests'))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => path.join(projectRoot, 'tests', name));
run(['--test', ...tests], 'regressão isolada');

console.log(`GENERAL_REGRESSION_OK: ${syntaxFiles.length} arquivos de execução e ${tests.length} suítes isoladas aprovados.`);
