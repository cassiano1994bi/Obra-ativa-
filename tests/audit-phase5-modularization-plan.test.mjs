import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const plan = fs.readFileSync(path.join(root, 'docs', 'audits', 'index-modularization-plan.md'), 'utf8');

test('plan inventory matches the current monolith', () => {
  const styles = [...source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)];
  const inlineScripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/.test(match[0].slice(0, match[0].indexOf('>') + 1)));
  const externalScripts = [...source.matchAll(/<script[^>]+\bsrc\s*=/gi)];
  assert.equal(styles.length, 97);
  assert.equal(inlineScripts.length, 16);
  assert.equal(externalScripts.length, 46);
  assert.equal((source.match(/\son[a-z]+=/gi) || []).length, 803);
  assert.match(plan, /aproximadamente 1,15 MB/i);
  assert.match(plan, /CSS escrito diretamente no cabeçalho: 20 blocos/i);
  assert.match(plan, /CSS adicional criado em tempo de execução: 77 blocos/i);
  assert.match(plan, /15 blocos funcionais e um bloco de abertura/i);
  assert.match(plan, /Eventos HTML[^\n]+803 ocorrências/i);
});

test('plan protects load order, global handlers, data and rollback', () => {
  for (const rule of [
    /mesma ordem de execução/i,/não devem receber `defer`, `async` ou `type=module`/i,
    /nomes globais/i,/não deve existir migração ou transformação de dados/i,
    /retorno imediato/i,/dados estritamente fictícios/i,/nenhum lote é publicado/i
  ]) assert.match(plan, rule);
});

test('phase 5 remains planning-only', () => {
  assert.equal(fs.existsSync(path.join(root, 'public-assets', 'app')), false,
    'the proposed module tree must not be created during the planning phase');
});
