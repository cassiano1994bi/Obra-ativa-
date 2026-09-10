import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixture = await fs.readFile(path.join(root, 'tests/work-control-harness.html'), 'utf8');
const data = fixture.slice(fixture.indexOf('let db='), fixture.indexOf('let persisted=')).replace('let db=', 'db=');
const server = http.createServer(async (req, res) => { try { const target = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname); if (!target.startsWith(root + path.sep)) throw Error('path'); res.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : target.endsWith('.svg') ? 'image/svg+xml' : target.endsWith('.png') ? 'image/png' : target.endsWith('.webp') ? 'image/webp' : 'text/html'); res.end(await fs.readFile(target)); } catch { res.statusCode = 404; res.end('not found'); } });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => {
  const data = new Map(), memory = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), clear: () => data.clear(), key: i => [...data.keys()][i] || null, get length() { return data.size; } };
  Object.defineProperty(window, 'localStorage', { value: memory }); Object.defineProperty(window, 'sessionStorage', { value: memory });
  const Native = Date; window.Date = class extends Native { constructor(...args) { super(...(args.length ? args : ['2031-01-15T12:00:00Z'])); } static now() { return Native.parse('2031-01-15T12:00:00Z'); } };
});
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.pathname.startsWith('/rest/v1/company_app_state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ work_control_revision: 1 }]) });
  if (url.pathname === '/rest/v1/rpc/read_work_control_history') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  if (url.origin === origin && !url.pathname.startsWith('/.netlify/')) return route.continue();
  return route.abort();
});
const tab = name => page.getByRole('tab', { name, exact: true }).click();
const close = () => page.evaluate(() => closeModal());
const costField = name => page.locator(`#oaCostForm [name="${name}"]`);
const costSave = async () => { await page.locator('#oaCostForm [type=submit]').click(); await page.waitForFunction(() => !document.querySelector('#modal').classList.contains('show')); };
try {
  await page.goto(origin + '/index.html?app=1'); await page.waitForFunction(() => !!window.ObraAtivaWorkCosts);
  await page.evaluate(async source => {
    const keys = Object.entries(db).filter(([, v]) => Array.isArray(v)).map(([key]) => key); (0, eval)(source);
    for (const key of [...keys, 'workClients', 'clients', 'vehicles', 'receivableDiscounts', 'advances', 'discounts', 'licenses', 'workPermissions']) db[key] ??= [];
    db.workClosings = []; db.receivables = [{ id: 'CONTRATO-FICTICIO', workId: 'OBRA-TESTE', total: 2347, startDate: '2031-01-01' }];
    CompanyWorkspace.current = { id: 'EMPRESA-TESTE', name: 'EMPRESA FICTÍCIA', role: 'owner', permissionProfile: 'gerente' };
    CloudSync.session = { access_token: 'TOKEN-FICTICIO', user: { id: 'USUARIO-TESTE', email: 'teste@example.invalid', user_metadata: { full_name: 'GESTOR FICTÍCIO' } } };
    CloudSync.schedule = () => {}; CloudSync.showAuth = () => {};
    await CloudSync.request('/rest/v1/company_app_state?company_id=eq.EMPRESA-TESTE&select=data', {}, CloudSync.session.access_token);
    document.querySelectorAll('#cloudGate,#obraAtivaSplash,.cloud-auth-overlay,.cloud-session-retry-overlay').forEach(el => el.remove());
    document.body.classList.remove('cloud-auth-required', 'public-mode', 'auth-mode');
    openWorkTracker('OBRA-TESTE');
  }, data);
  const preserved = await page.evaluate(() => JSON.stringify({ photos: db.workMedia, receipts: db.receipts, payments: db.payments, phases: db.workPhases }));
  await page.evaluate(() => go('works')); assert.doesNotMatch(await page.locator('#view').innerText(), /foto/i);
  await page.evaluate(() => openWorkTracker('OBRA-TESTE')); await tab('Fases da obra');
  assert.equal(await page.locator('.oa-cost-phase-breakdown').count(), 0);
  await page.getByRole('button', { name: 'Ver gastos por fase', exact: true }).click();
  assert.equal(await page.locator('.oa-cost-phase-breakdown').getAttribute('open'), '');
  await page.getByRole('button', { name: /Definir valor|Valor do contrato|Editar contrato/ }).click();
  assert.equal(await costField('total').inputValue(), '2347');
  await costField('total').fill('2519'); assert.match(await page.locator('#oaClientRemaining').innerText(), /2.406,00/); await costSave();
  assert.equal(await page.evaluate(() => db.receivables[0].total), 2519);
  await page.getByRole('button', { name: 'Registrar recebimento', exact: true }).click(); assert.equal(await page.locator('#modal').isVisible(), true); await close();
  await tab('Equipe e escala'); assert.equal(await page.locator('.oa-work-hub-date input').inputValue(), '2031-01-15');
  await page.locator('[data-plan-employee="PESSOA-TESTE-B"]').check(); await page.locator('[data-wc-plan-person="PESSOA-TESTE-B"]').selectOption('FASE-TESTE-2');
  await tab('Visão geral'); await tab('Equipe e escala');
  assert.equal(await page.locator('[data-plan-employee="PESSOA-TESTE-B"]').isChecked(), true);
  assert.equal(await page.locator('[data-wc-plan-person="PESSOA-TESTE-B"]').inputValue(), 'FASE-TESTE-2');
  assert.match(await page.locator('[data-oa-draft-status]').innerText(), /não salvas/);
  assert.match(await page.locator('#planCount').innerText(), /2 pessoas/);
  await page.locator('.oa-work-hub-date input').fill('2031-01-16'); await page.locator('.oa-work-hub-date input').fill('2031-01-15');
  assert.equal(await page.locator('[data-plan-employee="PESSOA-TESTE-B"]').isChecked(), true);
  await page.getByRole('button', { name: 'Salvar escala', exact: true }).click();
  assert.equal(await page.evaluate(() => db.distributions.find(r => r.employeeId === 'PESSOA-TESTE-B')?.phaseId), 'FASE-TESTE-2');
  assert.equal(await page.locator('[data-oa-draft-status]').getAttribute('class').then(v => v.includes('pending')), false);
  assert.equal(await page.evaluate(() => ObraAtivaWorkCosts.snapshot('OBRA-TESTE').labor), 11.5, 'a falta continua sem custo');
  await tab('Empreitas'); await page.getByRole('button', { name: 'Nova empreita', exact: true }).click();
  await costField('name').fill('EMPREITA FICTICIA AUDITORIA'); await costField('responsible').fill('PESSOA FICTICIA AUDITORIA'); await costField('mode').selectOption('meters'); await costField('unit').selectOption('m²'); await costField('quantity').fill('11'); await costField('unitPrice').fill('17'); await costSave();
  assert.equal(await page.evaluate(() => db.works[0].control.empreitas[0].unit), 'm²');
  await page.getByRole('button', { name: 'Nova empreita', exact: true }).click(); await costField('name').fill('EMPREITA FICTICIA AUDITORIA'); await costField('responsible').fill('OUTRA PESSOA FICTICIA'); await costField('total').fill('187');
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#oaCostForm [type=submit]').click();
  assert.match(await page.locator('#oaCostError').innerText(), /Nenhum novo/); assert.equal(await page.evaluate(() => db.works[0].control.empreitas.length), 1); await close();
  await tab('Financeiro da obra'); await page.getByRole('button', { name: 'Registrar custo extra', exact: true }).click(); await costField('value').fill('31');
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#oaCostForm [type=submit]').click();
  assert.match(await page.locator('#oaCostError').innerText(), /Nenhum novo/); assert.equal(await page.evaluate(() => db.otherExpenses.length), 1); await close();
  assert.equal(await page.evaluate(() => JSON.stringify({ photos: db.workMedia, receipts: db.receipts, payments: db.payments, phases: db.workPhases })), preserved);
  await page.evaluate(() => openInternalWorkModal());
  await page.locator('#wc-form [name=name]').fill('OBRA FICTÍCIA — Centro de treinamento');
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#wc-form [type=submit]').click();
  assert.match(await page.locator('#wc-message').innerText(), /Nada foi salvo/); assert.equal(await page.evaluate(() => db.works.length), 2); await close();
  await tab('Fases da obra'); await page.locator('[data-work-phase-action="new-phase"]').click();
  await page.locator('#wc-form [name=name]').fill('Estrutura FICTÍCIA');
  page.once('dialog', dialog => dialog.dismiss()); await page.locator('#wc-form [type=submit]').click();
  assert.match(await page.locator('#wc-message').innerText(), /Nada foi salvo/); assert.equal(await page.evaluate(() => db.workPhases.length), 6); await close();
  await fs.mkdir(path.join(root, 'tmp/work-hub-audit-qa'), { recursive: true });
  for (const [width, height] of [[1440, 1000], [844, 390], [667, 375], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const [name, key] of [['Visão geral', 'resumo'], ['Fases da obra', 'fases'], ['Equipe e escala', 'equipe'], ['Empreitas', 'empreitas'], ['Financeiro da obra', 'financeiro']]) {
      await tab(name);
      await page.locator('.oa-work-hub-head').scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}/${name}: sem estouro lateral`);
      await page.screenshot({ path: path.join(root, `tmp/work-hub-audit-qa/${width}-${key}-topo.png`) });
      if (key === 'fases') {
        const names = await page.locator('.oa-work-hub-phase-card h3').evaluateAll(nodes => nodes.map(el => ({ font: parseFloat(getComputedStyle(el).fontSize), whiteSpace: getComputedStyle(el).whiteSpace, clipped: el.scrollWidth > el.clientWidth + 1 })));
        assert.ok(names.every(name => name.font >= 16 && name.whiteSpace !== 'nowrap' && !name.clipped), `${width}: nomes de fases legíveis e completos`);
      }
      await page.locator('.oa-work-hub-content').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(root, `tmp/work-hub-audit-qa/${width}-${key}-conteudo.png`) });
    }
  }
  assert.deepEqual(errors, []);
  console.log('AUDIT_UI_OK: contrato, relatório único, rascunho por data, falta, unidade e avisos de duplicidade; somente dados FICTÍCIOS e sem rede real.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
