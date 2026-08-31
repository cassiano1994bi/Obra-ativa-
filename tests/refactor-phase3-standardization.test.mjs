import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assistantJsonResponse } from '../netlify/functions/_assistant/assistant-http.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

test('resposta HTTP compartilhada preserva contrato JSON e segurança', async () => {
  const response = assistantJsonResponse(202, { status: 'TESTE_FICTICIO' });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { status: 'TESTE_FICTICIO' });
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});

test('funções da assistente usam somente o helper HTTP compartilhado', () => {
  const endpoints = [
    'assistant-obras-actions.mjs',
    'assistant-obras-chat.mjs',
    'assistant-obras-insights.mjs',
    'assistant-obras-performance.mjs',
    'assistant-obras-report.mjs',
    'assistant-obras.mjs'
  ];

  for (const fileName of endpoints) {
    const source = read(`netlify/functions/${fileName}`);
    assert.match(source, /assistantJsonResponse as json/);
    assert.doesNotMatch(source, /const json\s*=/);
  }
});

test('configurações de texto e Git documentam o padrão adotado', () => {
  assert.match(read('.editorconfig'), /charset = utf-8/);
  assert.match(read('.editorconfig'), /end_of_line = lf/);
  assert.match(read('.gitattributes'), /\* text=auto eol=lf/);
  assert.match(read('docs/standards/project-conventions.md'), /sem alterar comportamento, dados ou regras de negócio/);
});
