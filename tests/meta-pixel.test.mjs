import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const code = fs.readFileSync(new URL('../public-assets/meta-pixel-v1.js', import.meta.url), 'utf8');

function fixture({ consent = true, dynamic = false, signedIn = false, pathname = '/', search = '', page = 'home', storage = new Map() } = {}) {
  const scripts = [], documentHandlers = {}, windowHandlers = {}, logs = [];
  if (consent) storage.set('oa-optional-measurement-v1:device-allowed', 'allow');
  const scriptAnchor = { parentNode: { insertBefore: script => scripts.push(script) } };
  const document = {
    readyState: 'complete',
    currentScript: { hasAttribute: name => dynamic && name === 'data-meta-dynamic' },
    body: { classList: { contains: name => name === 'auth-mode' && !signedIn } },
    head: { appendChild: script => scripts.push(script) },
    createElement: tagName => ({ tagName }),
    getElementsByTagName: tagName => tagName === 'script' ? [scriptAnchor] : [],
    addEventListener: (name, handler) => { documentHandlers[name] = handler; }
  };
  const sandbox = {
    window: null,
    document,
    page,
    CloudSync: { session: signedIn ? { user: { id: 'USUARIO_FICTICIO' } } : null },
    location: { pathname, search, hash: '' },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    URLSearchParams,
    Date,
    console: { info: (...args) => logs.push(args) },
    requestAnimationFrame: callback => callback(),
    addEventListener: (name, handler) => { windowHandlers[name] = handler; }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox);
  return { sandbox, scripts, storage, logs, documentHandlers, windowHandlers };
}

const queued = sandbox => JSON.parse(JSON.stringify(Array.from(sandbox.fbq?.queue || [], entry => Array.from(entry))));

test('não carrega nem envia o Pixel antes da permissão de medição', () => {
  const f = fixture({ consent: false, pathname: '/privacidade.html' });
  assert.equal(f.scripts.length, 0);
  assert.equal(f.sandbox.fbq, undefined);
  assert.equal(f.sandbox.ObraAtivaMetaPixel.pageView(), false);
});

test('usa o Pixel correto e registra um PageView em cada página estática', () => {
  const f = fixture({ pathname: '/privacidade.html', search: '?meta_pixel_test=1' });
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.deepEqual(queued(f.sandbox), [
    ['init', '1474857467999986'],
    ['consent', 'grant'],
    ['track', 'PageView', { page_name: 'privacidade' }]
  ]);
  assert.equal(f.sandbox.ObraAtivaMetaPixel.testMode, true);
  assert.equal(f.sandbox.ObraAtivaMetaPixel.testEvents().length, 1);
  assert.equal(f.logs.length, 1);
});

test('registra páginas virtuais da SPA e evita PageView duplicado no mesmo módulo', () => {
  const f = fixture({ dynamic: true, signedIn: true, search: '?app=1', page: 'works' });
  assert.equal(f.sandbox.ObraAtivaMetaPixel.pageView(), true);
  assert.equal(f.sandbox.ObraAtivaMetaPixel.pageView(), false);
  f.sandbox.page = 'financial';
  assert.equal(f.sandbox.ObraAtivaMetaPixel.pageView(), true);
  const views = queued(f.sandbox).filter(entry => entry[0] === 'track' && entry[1] === 'PageView');
  assert.deepEqual(views.map(entry => entry[2].page_name), ['aplicativo-works', 'aplicativo-financial']);
});

test('CompleteRegistration e StartTrial são únicos inclusive após recarregar', () => {
  const storage = new Map();
  const first = fixture({ dynamic: true, signedIn: true, search: '?app=1&meta_pixel_test=1', storage });
  assert.equal(first.sandbox.ObraAtivaMetaPixel.track('CompleteRegistration', {}, 'USUARIO_FICTICIO'), true);
  assert.equal(first.sandbox.ObraAtivaMetaPixel.track('CompleteRegistration', {}, 'USUARIO_FICTICIO'), false);
  assert.equal(first.sandbox.ObraAtivaMetaPixel.track('StartTrial', { currency: 'BRL', value: 0 }, 'company:EMPRESA_FICTICIA'), true);
  assert.equal(first.sandbox.ObraAtivaMetaPixel.track('StartTrial', { currency: 'BRL', value: 0 }, 'company:EMPRESA_FICTICIA'), false);

  const reloaded = fixture({ dynamic: true, signedIn: true, search: '?app=1', storage });
  assert.equal(reloaded.sandbox.ObraAtivaMetaPixel.track('CompleteRegistration', {}, 'USUARIO_FICTICIO'), false);
  assert.equal(reloaded.sandbox.ObraAtivaMetaPixel.track('StartTrial', { currency: 'BRL', value: 0 }, 'company:EMPRESA_FICTICIA'), false);
  assert.equal(reloaded.sandbox.ObraAtivaMetaPixel.track('Purchase', { currency: 'BRL', value: 69 }, 'COMPRA_FICTICIA'), false);
  assert.equal(queued(reloaded.sandbox).some(entry => entry[1] === 'Purchase'), false);
});

test('não envia PageView enquanto a URL contém token de retorno', () => {
  const f = fixture({ dynamic: true, search: '?app=1&invite=TOKEN_FICTICIO' });
  assert.equal(f.sandbox.ObraAtivaMetaPixel.pageView(), false);
  assert.equal(f.sandbox.fbq, undefined);
});

test('eventos estão ligados apenas aos pontos de sucesso e o script está em todas as páginas', () => {
  const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const activity = fs.readFileSync(new URL('../public-assets/product-activity-v1.js', import.meta.url), 'utf8');
  const netlify = fs.readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
  assert.match(index, /Supabase confirmar que o cadastro foi criado[\s\S]{0,220}track\('CompleteRegistration'/);
  assert.match(index, /teste grátis de 30 dias iniciarem com sucesso[\s\S]{0,220}track\('StartTrial'/);
  assert.match(activity, /ObraAtivaMetaPixel\?\.pageView\(\)/);
  assert.doesNotMatch(`${index}\n${activity}\n${code}`, /track\('Purchase'/);
  for (const fileName of ['index.html', 'privacidade.html', 'exclusao-de-conta.html', 'proposta.html']) {
    const html = fs.readFileSync(new URL(`../${fileName}`, import.meta.url), 'utf8');
    assert.match(html, /public-assets\/meta-pixel-v1\.js/);
  }
  assert.match(netlify, /script-src[^\n]+https:\/\/connect\.facebook\.net/);
  assert.match(netlify, /img-src[^\n]+https:\/\/www\.facebook\.com/);
});
