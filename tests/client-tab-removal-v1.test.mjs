import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const registry = readFileSync(new URL('../public-assets/assistant-command-registry-v1.js', import.meta.url), 'utf8');
const brandScript = readFileSync(new URL('../public-assets/app-brand-lock-v1.js', import.meta.url), 'utf8');
const brandStyle = readFileSync(new URL('../public-assets/app-brand-lock-v1.css', import.meta.url), 'utf8');
const admin = readFileSync(new URL('../public-assets/admin-navigation-v1.js', import.meta.url), 'utf8');

test('remove Clientes da navegação principal e móvel', () => {
  const navs = index.match(/const navs=\[(.*?)\];/s)?.[1] || '';
  const mobile = index.match(/const MOBILE_NAV_META=\{(.*?)\};/s)?.[1] || '';
  assert.doesNotMatch(navs, /['"]clients['"]/);
  assert.doesNotMatch(mobile, /clients\s*:/);
  assert.doesNotMatch(registry, /clients:\s*Object\.freeze/);
});

test('remove Clientes do editor de permissões sem apagar coleções históricas', () => {
  const permissions = index.match(/function permissionsPage\(\)\{(.*?)\nfunction/s)?.[1] || '';
  assert.doesNotMatch(permissions, /clients:'Clientes'/);
  assert.match(index, /\['clients','clientRequests','clientQuotes','clientVisits','clientHistory'\]/);
  assert.match(index, /ClientDataService/);
});

test('não carrega a Central de Clientes cancelada', () => {
  assert.doesNotMatch(index, /client-center-v2\.(?:css|js)/);
});

test('mantém somente a logo oficial no aplicativo sem apagar a antiga armazenada', () => {
  assert.match(index, /app-brand-lock-v1\.css\?v=20260906-single-mobile-brand/);
  assert.match(index, /app-brand-lock-v1\.js\?v=20260831/);
  assert.match(brandScript, /obraativa-app-icon-v2-192\.png/);
  assert.match(brandScript, /\.\.\.db\.settings/);
  assert.doesNotMatch(brandScript, /delete\s+db\.settings\.companyLogo/);
  assert.match(brandStyle, /\.brand-logo\{display:block/);
  assert.match(brandStyle, /\.obraativa-mobile-top-logo\{display:block/);
  assert.doesNotMatch(admin, /\['Logo da empresa'/);
});
