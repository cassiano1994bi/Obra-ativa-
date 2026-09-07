import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code = fs.readFileSync(new URL('../public-assets/product-activity-v1.js', import.meta.url), 'utf8');
async function fixture(permit = null, unavailable = false, signedIn = true) {
  let time = new Date('2032-04-10T12:00:00Z').getTime(), focused = true, tick;
  const calls = [], handlers = {}, scripts = [], storage = new Map();
  if (permit) {
    storage.set('oa-optional-measurement-v1:USUARIO_FICTICIO', permit);
    if (!signedIn) storage.set('oa-optional-measurement-v1:device-allowed', permit);
  }
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [time])); } static now() { return time; } }
  const scriptAnchor = { parentNode: { insertBefore: (script) => scripts.push(script) } };
  const doc = { visibilityState: 'visible', hasFocus: () => focused, querySelector: () => null, getElementById: () => null,
    body: { classList: { contains: () => false } }, head: { appendChild: (script) => scripts.push(script) },
    createElement: (tagName) => ({ tagName }), getElementsByTagName: (tagName) => tagName === 'script' ? [scriptAnchor] : [],
    addEventListener: (name, handler) => { handlers[name] = handler; } };
  const cloud = { session: signedIn ? { user: { id: 'USUARIO_FICTICIO' }, access_token: 'TOKEN_FICTICIO' } : null, ready: true };
  const sandbox = { window: null, Date: FakeDate, document: doc, CloudSync: cloud, CLOUD_CONFIG: { url: 'https://qa.example.invalid', anonKey: 'PUBLIC_FICTICIO' }, page: 'works', crypto: { randomUUID: () => '30000000-0000-4000-8000-000000000001' },
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) }, URLSearchParams,
    location: { search: '' }, AbortSignal, setInterval: (fn) => { tick = fn; },
    addEventListener: () => {}, requestAnimationFrame: fn => fn(),
    fetch: async (url, options) => { calls.push({ url, args: JSON.parse(options.body), options }); return { ok: !unavailable, json: async () => url.endsWith('preference') ? { enabled: true } : true }; } };
  sandbox.window = sandbox; vm.runInNewContext(code, sandbox);
  await new Promise((resolve) => setImmediate(resolve));
  return { calls, doc, cloud, scripts, storage, sandbox, input: () => handlers.pointerdown(), focus: (value) => { focused = value; }, advance: async (ms = 5000) => { time += ms; await tick(); } };
}
test('não mede antes de escolher e não altera a autenticação', async () => {
  const f = await fixture(); await f.advance(60000);
  assert.equal(f.calls.length, 0); assert.equal(f.cloud.ready, true); assert.equal(f.cloud.session.access_token, 'TOKEN_FICTICIO');
});
test('mede em lote; aba oculta, inativa e sem foco não geram batimentos de presença', async () => {
  const f = await fixture('allow');
  assert.equal(f.calls.filter((c) => c.url.endsWith('tick')).length, 1);
  for (let i = 0; i < 12; i++) { f.input(); await f.advance(); }
  const beats = f.calls.filter((c) => c.url.endsWith('tick'));
  assert.equal(beats.length, 2); assert.ok(beats[1].args.p_seconds <= 60 && beats[1].args.p_seconds > 0);
  assert.equal(beats[1].args.p_module, 'works');
  f.doc.visibilityState = 'hidden'; for (let i = 0; i < 15; i++) await f.advance();
  f.doc.visibilityState = 'visible'; f.focus(false); for (let i = 0; i < 15; i++) await f.advance();
  f.focus(true); for (let i = 0; i < 15; i++) await f.advance();
  assert.equal(f.calls.filter((c) => c.url.endsWith('tick')).length, 2);
});
test('saída confirmada envia encerramento sem bloquear; permissão permanece neste dispositivo', async () => {
  const f = await fixture('allow'); f.sandbox.ObraAtivaUsage.end();
  assert.equal(f.calls.at(-1).args.p_end, true); assert.equal(f.calls.at(-1).options.keepalive, true);
  f.cloud.session = { user: { id: 'OUTRO_USUARIO_FICTICIO' }, access_token: 'OUTRO_TOKEN_FICTICIO' };
  const count = f.calls.length; await f.advance(60000); assert.ok(f.calls.length > count);
  assert.ok(f.calls.slice(count).some(call => call.options.headers.authorization === 'Bearer OUTRO_TOKEN_FICTICIO'));
});
test('erros da medição usam espera progressiva e nunca encerram a sessão', async () => {
  const f = await fixture('allow', true), count = f.calls.length;
  for (let i = 0; i < 12; i++) await f.advance();
  assert.equal(f.calls.length, count); assert.equal(f.cloud.ready, true); assert.ok(f.cloud.session);
});
test('Pixel da Meta registra PageView somente após autorização e apenas na entrada pública', async () => {
  const withoutConsent = await fixture(null, false, false);
  assert.equal(withoutConsent.scripts.length, 0);
  assert.equal(withoutConsent.sandbox.fbq, undefined);

  const publicAllowed = await fixture('allow', false, false);
  assert.equal(publicAllowed.scripts.length, 1);
  assert.equal(publicAllowed.scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js');
  assert.deepEqual(Array.from(publicAllowed.sandbox.fbq.queue, (entry) => Array.from(entry)), [
    ['init', '1591172095715887'],
    ['track', 'PageView']
  ]);

  const signedIn = await fixture('allow');
  assert.equal(signedIn.scripts.length, 0);
  assert.equal(signedIn.sandbox.fbq, undefined);
});
