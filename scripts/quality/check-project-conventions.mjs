import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
const failures = [];

function requireText(relativePath, patterns) {
  const source = read(relativePath);
  for (const [pattern, message] of patterns) {
    if (!pattern.test(source)) failures.push(`${relativePath}: ${message}`);
  }
  return source;
}

requireText('.editorconfig', [
  [/^root = true$/m, 'deve definir o arquivo como raiz'],
  [/^charset = utf-8$/m, 'deve usar UTF-8'],
  [/^end_of_line = lf$/m, 'deve usar LF'],
  [/^indent_size = 2$/m, 'deve definir indentação padrão de dois espaços']
]);

requireText('.gitattributes', [
  [/^\* text=auto eol=lf$/m, 'deve normalizar texto com LF'],
  [/^\*\.png binary$/m, 'deve preservar PNG como binário'],
  [/^\*\.apk binary$/m, 'deve preservar APK como binário']
]);

const helper = requireText('netlify/functions/_assistant/assistant-http.mjs', [
  [/'content-type': 'application\/json; charset=utf-8'/, 'deve definir content-type JSON UTF-8'],
  [/'cache-control': 'no-store'/, 'deve impedir cache de respostas privadas'],
  [/'x-content-type-options': 'nosniff'/, 'deve impedir detecção incorreta de conteúdo']
]);
if (!/export function assistantJsonResponse\(status, body\)/.test(helper)) {
  failures.push('assistant-http.mjs: deve exportar assistantJsonResponse');
}

const assistantEndpoints = [
  'assistant-obras-actions.mjs',
  'assistant-obras-chat.mjs',
  'assistant-obras-insights.mjs',
  'assistant-obras-performance.mjs',
  'assistant-obras-report.mjs',
  'assistant-obras.mjs'
];

for (const fileName of assistantEndpoints) {
  const relativePath = `netlify/functions/${fileName}`;
  const source = read(relativePath);
  if (!/import \{ assistantJsonResponse as json \} from '\.\/_assistant\/assistant-http\.mjs';/.test(source)) {
    failures.push(`${relativePath}: deve usar o helper HTTP compartilhado`);
  }
  if (/const json\s*=/.test(source)) {
    failures.push(`${relativePath}: não deve redefinir o helper JSON localmente`);
  }
}

if (failures.length) {
  console.error('PROJECT_CONVENTIONS_FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PROJECT_CONVENTIONS_OK: ${assistantEndpoints.length} funções padronizadas e arquivos de configuração válidos.`);
