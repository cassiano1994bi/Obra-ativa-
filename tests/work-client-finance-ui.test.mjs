// Cenários integralmente FICTÍCIOS. Sem conta real, armazenamento real ou rede externa.
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixture = await fs.readFile(path.join(root, 'tests/work-control-harness.html'), 'utf8');
const data = fixture.slice(fixture.indexOf('let db='), fixture.indexOf('let persisted=')).replace('let db=', 'db=');
const server = http.createServer(async (req, res) => {
  try {
    const target = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!target.startsWith(root + path.sep)) throw Error('path');
    res.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : target.endsWith('.svg') ? 'image/svg+xml' : target.endsWith('.png') ? 'image/png' : target.endsWith('.webp') ? 'image/webp' : 'text/html');
    res.setHeader('Cache-Control', 'no-store'); res.end(await fs.readFile(target));
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
const page = await context.newPage(), errors = [], externalWrites = [];
page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => {
  const data = new Map(), memory = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), clear: () => data.clear(), key: i => [...data.keys()][i] || null, get length() { return data.size; } };
  Object.defineProperty(window, 'localStorage', { value: memory }); Object.defineProperty(window, 'sessionStorage', { value: memory });
  const Native = Date; window.Date = class extends Native { constructor(...args) { super(...(args.length ? args : ['2031-01-15T12:00:00Z'])); } static now() { return Native.parse('2031-01-15T12:00:00Z'); } };
});
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.pathname.includes('save_company_app_state')) externalWrites.push(url.pathname);
  if (url.pathname.startsWith('/rest/v1/company_app_state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ work_control_revision: 1 }]) });
  if (url.pathname === '/rest/v1/rpc/read_work_control_history') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  if (url.origin === origin && !url.pathname.startsWith('/.netlify/')) return route.continue();
  return route.abort();
});
const tab = name => page.getByRole('tab', { name, exact: true }).click();
const field = name => page.locator(`#oaCostForm [name="${name}"]`);
const close = () => page.evaluate(() => closeModal());
const save = async () => { await page.locator('#oaCostForm [type=submit]').click(); await page.waitForFunction(() => !document.querySelector('#modal').classList.contains('show')); };
const received = () => page.evaluate(() => ObraAtivaWorkCosts.snapshot('OBRA-TESTE').received);
try {
  await page.goto(origin + '/index.html?app=1'); await page.waitForFunction(() => !!window.ObraAtivaWorkCosts);
  await page.evaluate(async source => {
    const keys = Object.entries(db).filter(([, value]) => Array.isArray(value)).map(([key]) => key); (0, eval)(source);
    for (const key of [...keys, 'workClients', 'clients', 'vehicles', 'receivableDiscounts', 'advances', 'discounts', 'licenses', 'workPermissions']) db[key] ??= [];
    db.workClosings = []; db.receivables = [{ id: 'CONTRATO-FICTICIO', workId: 'OBRA-TESTE', total: 2347, startDate: '2031-01-01' }];
    db.settings = { cycleStart: '2030-12-20', paymentInitialStart: '2030-12-07' };
    CompanyWorkspace.current = { id: 'EMPRESA-TESTE', name: 'EMPRESA FICTÍCIA', role: 'owner', permissionProfile: 'gerente' };
    CloudSync.session = { access_token: 'TOKEN-FICTICIO', user: { id: 'USUARIO-TESTE', email: 'teste@example.invalid', user_metadata: { full_name: 'GESTOR FICTÍCIO' } } };
    CloudSync.schedule = () => {}; CloudSync.showAuth = () => {};
    await CloudSync.request('/rest/v1/company_app_state?company_id=eq.EMPRESA-TESTE&select=data', {}, CloudSync.session.access_token);
    document.querySelectorAll('#cloudGate,#obraAtivaSplash,.cloud-auth-overlay,.cloud-session-retry-overlay').forEach(el => el.remove());
    document.body.classList.remove('cloud-auth-required', 'public-mode', 'auth-mode'); openWorkTracker('OBRA-TESTE');
  }, data);
  const preserved = await page.evaluate(() => JSON.stringify({ attendance: db.attendance, distributions: db.distributions, phases: db.workPhases, payments: db.payments, expenses: db.otherExpenses, photos: db.workMedia }));
  await tab('Financeiro da obra'); assert.equal(await received(), 113);
  await page.getByRole('button', { name: '+ Aditivo', exact: true }).click();
  assert.match(await page.locator('.oa-cost-hint').innerText(), /Não registra dinheiro recebido/);
  await field('description').fill('SERVIÇO EXTRA FICTÍCIO'); await field('value').fill('153.27');
  assert.match(await page.locator('#oaAddendumTotal').innerText(), /2.500,27/); await save();
  assert.equal(await received(), 113); assert.equal(await page.evaluate(() => db.receivables[0].total), 2500.27);
  await page.getByRole('button', { name: 'Editar contrato', exact: true }).click(); assert.equal(await field('total').inputValue(), '2347'); await close();
  await page.getByRole('button', { name: 'Informar previsão', exact: true }).click();
  await field('value').fill('431'); await field('expectedDate').fill('2031-01-17'); await field('note').fill('PARCELA FICTÍCIA DA QUINZENA'); await save();
  assert.equal(await received(), 113); assert.equal(await page.evaluate(() => db.receivables[0].total), 2500.27);
  const closingId = await page.evaluate(() => db.workClosings[0].id);
  await page.locator('[data-oa-period-action="fortnight"]').click();
  assert.match(await page.locator('[data-oa-client-planned]').innerText(), /431,00/);
  assert.match(await page.locator('[data-oa-period-received]').innerText(), /113,00/);
  await page.locator('.oa-work-hub-finance-actions').getByRole('button', { name: 'Registrar recebimento', exact: true }).click();
  await field('closingId').selectOption(closingId); await field('value').fill('79'); await save();
  assert.equal(await received(), 192); assert.match(await page.locator('[data-oa-client-pending]').innerText(), /352,00/);
  assert.match(await page.locator('[data-oa-period-result]').innerText(), /149,50/);
  assert.equal(await page.evaluate(() => db.receipts.length), 1); assert.equal(await page.evaluate(() => db.workClosings[0].receipts.length), 1);
  assert.equal(await page.evaluate(() => JSON.stringify({ attendance: db.attendance, distributions: db.distributions, phases: db.workPhases, payments: db.payments, expenses: db.otherExpenses, photos: db.workMedia })), preserved);
  await page.locator('[data-oa-period-action="total"]').click();
  await page.locator('[data-oa-finance-history]>summary').click();
  assert.equal(await page.locator('[data-oa-finance-history]>div').filter({ hasText: 'Recebimento do cliente' }).count(), 2, 'sem duplicar recibo com evento de auditoria');
  // Formatos de recebimento antigos de uma segunda obra, só em memória.
  await page.evaluate(() => { db.receipts.push({ id: 'ANTIGO-SEM-DATA-FICTICIO', workId: 'LEGADO-TESTE', value: 37 }); openWorkTracker('LEGADO-TESTE'); });
  await tab('Financeiro da obra'); assert.equal(await page.evaluate(() => ObraAtivaWorkCosts.snapshot('LEGADO-TESTE').received), 37);
  assert.match(await page.locator('.oa-work-hub-finance-grid article').nth(1).innerText(), /37,00/);
  await page.evaluate(() => openWorkTracker('OBRA-TESTE')); await tab('Financeiro da obra');
  await fs.mkdir(path.join(root, 'tmp/work-client-finance-qa'), { recursive: true });
  for (const [width, height] of [[1920, 1080], [1440, 1000], [1024, 768], [768, 1024], [844, 390], [667, 375], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.locator('[data-oa-period-action="total"]').click();
    await page.locator('.oa-work-hub-financial').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `total ${width}`);
    await page.screenshot({ path: path.join(root, `tmp/work-client-finance-qa/${width}-total.png`) });
    await page.locator('[data-oa-period-action="fortnight"]').click();
    await page.locator('.oa-cost-client-forecast').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `previsão ${width}`);
    const metrics = await page.locator('.oa-cost-client-forecast .oa-work-hub-cost-composition b').evaluateAll(nodes => nodes.map(el => ({ width: el.clientWidth, scroll: el.scrollWidth, font: parseFloat(getComputedStyle(el).fontSize), weight: parseInt(getComputedStyle(el).fontWeight) })));
    assert.ok(metrics.every(item => item.width + 1 >= item.scroll && item.font >= 20 && item.weight >= 700), JSON.stringify({ width, metrics }));
    await page.screenshot({ path: path.join(root, `tmp/work-client-finance-qa/${width}-previsao.png`) });
    for (const [method, label] of [['addendumForm', 'aditivo'], ['forecastForm', 'previsao'], ['receiptForm', 'recebimento'], ['clientContractForm', 'contrato']]) {
      await page.evaluate(method => ObraAtivaWorkCosts[method]('OBRA-TESTE'), method);
      const invalid = await page.locator('#oaCostForm input,#oaCostForm select').evaluateAll(nodes => nodes.map(el => { const rect = el.getBoundingClientRect(); return { name: el.name, width: rect.width, right: rect.right, height: rect.height, font: parseFloat(getComputedStyle(el).fontSize), viewport: innerWidth }; }).filter(el => el.width < 100 || el.right > el.viewport || el.height < 44 || el.font < 16));
      assert.deepEqual(invalid, [], `${label} ${width}: campos legíveis e proporcionais`);
      assert.equal(await page.locator('#dialog').evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `${label} ${width}: sem estouro`);
      if (label === 'recebimento') await page.screenshot({ path: path.join(root, `tmp/work-client-finance-qa/${width}-form.png`) });
      await close();
    }
  }
  // Exclusão real pela interface, mas somente sobre fases FICTÍCIAS em memória.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => { db.workPhases = [{ id: 'CONCLUIDA-FICTICIA', workId: 'OBRA-TESTE', name: 'CONCLUÍDA FICTÍCIA', percent: 100, status: 'Concluída', controlVersion: 1, endDate: '2031-01-10' }, { id: 'PENDENTE-FICTICIA', workId: 'OBRA-TESTE', name: 'PENDENTE FICTÍCIA', percent: 0, status: 'Não iniciada', controlVersion: 1 }]; render(); });
  await tab('Fases da obra'); assert.match(await page.locator('.oa-work-hub-progress').innerText(), /50%/);
  const beforeDelete = await page.evaluate(() => JSON.stringify(db));
  page.once('dialog', dialog => dialog.dismiss()); await page.evaluate(() => deleteWorkPhase('OBRA-TESTE', 'PENDENTE-FICTICIA'));
  assert.equal(await page.evaluate(() => JSON.stringify(db)), beforeDelete);
  page.once('dialog', dialog => dialog.accept()); await page.evaluate(() => deleteWorkPhase('OBRA-TESTE', 'PENDENTE-FICTICIA'));
  assert.equal(await page.evaluate(() => db.workPhases.length), 1); assert.match(await page.locator('.oa-work-hub-progress').innerText(), /50%/);
  assert.equal(await page.getByRole('button', { name: 'Conferir fases restantes', exact: true }).count(), 1);
  await page.locator('.oa-work-phase-review').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(root, 'tmp/work-client-finance-qa/fase-excluida.png') });
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Conferir fases restantes', exact: true }).click(); assert.match(await page.locator('.oa-work-hub-progress').innerText(), /50%/);
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Conferir fases restantes', exact: true }).click(); assert.match(await page.locator('.oa-work-hub-progress').innerText(), /100%/);
  assert.equal(await page.evaluate(() => db.workUpdates.at(-1).scopeChange), true);
  await page.evaluate(() => { Object.assign(CompanyWorkspace.current, { role: 'viewer', permissionProfile: 'visualizador', permissionModules: ['works', 'financial'] }); render(); });
  await tab('Financeiro da obra'); assert.equal(await page.locator('[data-oa-cost-action="forecast"],[data-oa-cost-action="addendum"],[data-oa-cost-action="client-receipt"]').count(), 0);
  assert.deepEqual(errors, []); assert.deepEqual(externalWrites, []);
  console.log('CLIENT_FINANCE_UI_OK: contrato/aditivo/previsão/recebimento sem dupla contagem, histórico, dados antigos, falta zero preservada, cancelamento/exclusão/revisão de fase, permissões e 7 formatos de tela; 4 formulários por formato. Somente dados FICTÍCIOS e rede externa bloqueada.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
