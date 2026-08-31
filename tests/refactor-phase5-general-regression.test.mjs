import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('dependências locais declaradas pela página existem', () => {
  const references = [...html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1].split(/[?#]/, 1)[0].replace(/^\//, ''))
    .filter((reference) => reference && !/^(?:data:|blob:|https?:|#)/i.test(reference));

  assert.ok(references.length >= 30, 'inventário de dependências ficou incompleto');
  for (const reference of references) assert.equal(fs.existsSync(path.join(root, reference)), true, reference);
});

test('manifesto e cache referenciam somente ativos existentes', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  const manifestAssets = [
    ...(manifest.icons || []).map((icon) => icon.src),
    ...(manifest.shortcuts || []).flatMap((shortcut) => (shortcut.icons || []).map((icon) => icon.src))
  ];
  const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const cachedAssets = [...serviceWorker.matchAll(/['"](\/(?:index\.html|manifest\.webmanifest|public-assets\/[^'"]+))['"]/g)]
    .map((match) => match[1]);

  for (const reference of [...manifestAssets, ...cachedAssets]) {
    assert.equal(fs.existsSync(path.join(root, reference.replace(/^\//, ''))), true, reference);
  }
});

test('scripts externos da página continuam adiados e sem duplicação', () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)src="([^"]+)"[^>]*><\/script>/g)]
    .map((match) => ({ attributes: match[1], source: match[2] }));
  assert.ok(scripts.length >= 30, 'lista de módulos externos ficou incompleta');
  assert.equal(new Set(scripts.map((item) => item.source)).size, scripts.length, 'script externo duplicado');
  for (const script of scripts) assert.match(script.attributes, /\bdefer\b/, `${script.source} deve usar defer`);
});
