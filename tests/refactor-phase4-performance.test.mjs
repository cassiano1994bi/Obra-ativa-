import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const assets = path.join(root, 'public-assets');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const budgets = {
  'obraativa-app-icon-v2-1024.png': 920_000,
  'obraativa-app-icon-v2-512.png': 245_000,
  'obraativa-app-icon-v2-192.png': 40_000,
  'obraativa-ui-works-v2.png': 230_000,
  'obraativa-ui-attendance-v2.png': 195_000,
  'obraativa-ui-financial-v2.png': 195_000,
  'assistant-avatar-v1.png': 160_000
};

test('PNG essenciais permanecem compatíveis e dentro do orçamento', () => {
  for (const [fileName, maximumBytes] of Object.entries(budgets)) {
    const source = fs.readFileSync(path.join(assets, fileName));
    assert.equal(source.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(source.length <= maximumBytes, `${fileName} excedeu ${maximumBytes} bytes`);
  }
});

test('conjunto público de PNG permanece abaixo do orçamento total', () => {
  const total = fs.readdirSync(assets)
    .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
    .reduce((sum, fileName) => sum + fs.statSync(path.join(assets, fileName)).size, 0);
  assert.ok(total <= 4_900_000, `PNG públicos somam ${total} bytes`);
});

test('cartões públicos abaixo da dobra carregam imagens sob demanda', () => {
  assert.match(html, /class="public-work-card"[\s\S]{0,180}<img[^>]+loading="lazy" decoding="async"/);
  assert.match(html, /class="portfolio-image"[^>]+loading="lazy" decoding="async"/);
});
