import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'public-assets', 'obraativa-product-site-v2.js'), 'utf8');
const style = fs.readFileSync(path.join(root, 'public-assets', 'obraativa-product-site-v2.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const creatorLogo = fs.readFileSync(path.join(root, 'public-assets', 'aplicativo-studio-logo-v1.svg'), 'utf8');

test('landing pública segue a referência sem substituir login ou cadastro', () => {
  assert.match(source, /Sua obra já dá/);
  assert.match(source, /controle não/);
  assert.match(source, /\?app=1&onboarding=1/);
  assert.match(source, /\?app=1/);
  assert.match(source, /Falar no WhatsApp/);
  assert.match(source, /isolatePublicPageRenderers/);
  assert.doesNotMatch(source, /CloudSync\.(signIn|signUp|recover|saveSession)\s*\(/);
});

test('módulos, dispositivos, públicos, etapas, planos e FAQ permanecem completos', () => {
  for (const text of ['Tudo que sua obra precisa', 'CONTROLE NA PALMA DA MÃO', 'Feito para quem vive a obra', 'Como funciona', 'Um plano completo', 'Perguntas frequentes']) assert.match(source, new RegExp(text));
  for (const module of ['Equipe', 'Presença', 'Obras', 'Pagamentos', 'Financeiro', 'Veículos', 'Relatórios', 'Orçamentos', 'Assistente IA']) assert.match(source, new RegExp(module));
  assert.match(source, /ObraAtiva completo/);
  assert.match(source, /R\$ 69\/mês/);
  assert.match(source, /30 dias grátis/);
  assert.doesNotMatch(source, /14 dias|R\$ 49\/mês|R\$ 97\/mês|R\$ 197\/mês/);
  assert.doesNotMatch(source, /R\$\s*59,90|R\$\s*119,90/);
});

test('AplicAtivo aparece somente como crédito secundário com contato oficial', () => {
  assert.match(source, /APLICATIVO DESENVOLVIDO POR/);
  assert.match(source, /AplicAtivo Tecnologia/);
  assert.match(source, /PRODUCT_SALES_WHATSAPP_DEFAULT/);
  assert.match(creatorLogo, /AplicAtivo Tecnologia/);
  const publicHeader = source.match(/<nav class="oa-public-nav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.doesNotMatch(publicHeader, /aplicativo-studio-logo/i);
});

test('visual escuro é responsivo e mantém a navegação acessível', () => {
  assert.match(style, /--oa-night:#020b18/);
  assert.match(style, /@media\(max-width:900px\)/);
  assert.match(style, /@media\(max-width:720px\)/);
  assert.match(style, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(style, /\.oa-public-links a:focus-visible/);
  assert.match(style, /\.oa-module-grid\{display:grid/);
});

test('novos ativos carregam no aplicativo e ficam disponíveis offline', () => {
  for (const file of ['obraativa-product-site-v2.css', 'obraativa-product-site-v2.js']) assert.match(index, new RegExp(file.replaceAll('.', '\\.')));
  for (const file of ['obraativa-product-site-v2.css', 'obraativa-product-site-v2.js', 'aplicativo-studio-logo-v1.svg']) assert.match(worker, new RegExp(file.replaceAll('.', '\\.')));
  const version = worker.match(/CACHE_VERSION\s*=\s*'(v\d+)'/)?.[1];
  assert.match(version || '', /^v[1-9]\d*$/, 'o cache precisa ter uma versão numérica explícita');
});

test('camada pública não lê dados operacionais nem cria persistência paralela', () => {
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(source, /db\.(works|employees|attendance|payments|receivables)/);
});
