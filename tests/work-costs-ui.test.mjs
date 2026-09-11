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
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(), errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await context.addInitScript(() => {
  const data = new Map(), memory = { getItem: (k) => data.get(k) || null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), clear: () => data.clear(), key: (i) => [...data.keys()][i] || null, get length() { return data.size; } };
  Object.defineProperty(window, 'localStorage', { value: memory }); Object.defineProperty(window, 'sessionStorage', { value: memory });
  const Native = Date; window.Date = class extends Native { constructor(...args) { super(...(args.length ? args : ['2031-01-15T12:00:00Z'])); } static now() { return Native.parse('2031-01-15T12:00:00Z'); } };
});
await context.route('**/*', (route) => { const url = new URL(route.request().url());
  if (url.pathname.startsWith('/rest/v1/company_app_state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ work_control_revision: 1 }]) });
  if (url.pathname === '/rest/v1/rpc/read_work_control_history') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  if (url.origin === origin && !url.pathname.startsWith('/.netlify/')) return route.continue();
  return route.abort();
});
const form = () => page.locator('#oaCostForm');
const fill = async (name, value) => form().locator(`[name="${name}"]`).fill(String(value));
const select = async (name, value) => form().locator(`[name="${name}"]`).selectOption(value);
const submit = async () => { await form().locator('[type=submit]').click(); await page.waitForFunction(() => !document.querySelector('#modal').classList.contains('show')); };
const tab = async (name) => page.getByRole('tab', { name, exact: true }).click();
try {
  await page.goto(origin + '/index.html?app=1'); await page.waitForFunction(() => !!window.ObraAtivaWorkCosts);
  await page.evaluate(async (source) => {
    (0, eval)(source);
    for (const key of ['workClients', 'clients', 'vehicles', 'receivableDiscounts', 'advances', 'discounts', 'licenses', 'workPermissions']) db[key] ??= [];
    CompanyWorkspace.current = { id: 'EMPRESA-TESTE', name: 'EMPRESA FICTÍCIA', role: 'owner', permissionProfile: 'gerente' };
    CloudSync.session = { access_token: 'TOKEN-FICTICIO', user: { id: 'USUARIO-TESTE', email: 'teste@example.invalid', user_metadata: { full_name: 'GESTOR FICTÍCIO' } } };
    CloudSync.schedule = () => {}; CloudSync.showAuth = () => {};
    await CloudSync.request('/rest/v1/company_app_state?company_id=eq.EMPRESA-TESTE&select=data', {}, CloudSync.session.access_token);
    document.querySelectorAll('#cloudGate,#obraAtivaSplash,.cloud-auth-overlay,.cloud-session-retry-overlay').forEach((el) => el.remove());
    document.body.classList.remove('cloud-auth-required', 'public-mode', 'auth-mode');
    openWorkTracker('OBRA-TESTE');
  }, data);
  const untouched = await page.evaluate(() => JSON.stringify({ payments: db.payments, workMedia: db.workMedia, receipts: db.receipts, workClosings: db.workClosings, phases: db.workPhases, legacy: db.works.find((w) => w.id === 'LEGADO-TESTE') }));
  assert.equal(await page.evaluate(() => ObraAtivaWorkCosts.snapshot('OBRA-TESTE').labor), 11.5);
  await page.evaluate(() => { db.receivables = [{ id: 'VALOR-FICTICIO', workId: 'OBRA-TESTE', total: 7513 }]; render(); });
  assert.match(await page.locator('.oa-work-hub-contract-value').textContent(), /7.513,00/);
  await tab('Empreitas'); await page.getByRole('button', { name: 'Nova empreita', exact: true }).click();
  await fill('name', 'ALVENARIA FICTÍCIA'); await select('employeeId', 'PESSOA-TESTE-A'); await select('phaseId', 'FASE-TESTE-1'); await select('mode', 'meters'); await select('unit', 'm²');
  await fill('quantity', 13.5); await fill('unitPrice', 17.3);
  assert.match(await page.locator('#oaContractTotal').textContent(), /233,55/);
  await submit();
  const contractId = await page.evaluate(() => db.works.find((w) => w.id === 'OBRA-TESTE').control.empreitas[0].id);
  await page.getByRole('button', { name: 'Nova empreita', exact: true }).click(); await fill('name', 'SERVIÇO FECHADO FICTÍCIO'); await fill('responsible', 'EMPREITEIRO FICTÍCIO'); await fill('total', 431); await submit();
  assert.equal(await page.locator('.oa-cost-contract').count(), 2);
  for (const value of [31.05, 41.5]) {
    await page.locator(`[data-contract-id="${contractId}"]`).getByRole('button', { name: 'Registrar pagamento' }).click();
    await fill('value', value); await fill('note', 'PAGAMENTO QUINZENAL FICTÍCIO'); await submit();
  }
  assert.deepEqual(await page.evaluate((id) => ObraAtivaWorkCostCore.totals(db, 'OBRA-TESTE', id), contractId), { contracted: 233.55, paid: 72.55, outstanding: 161 });
  await page.evaluate(() => { planningDate = '2031-01-15'; planningWorkId = 'OBRA-TESTE'; go('planning'); });
  await page.locator('[data-wc-plan-person="PESSOA-TESTE-A"]').selectOption('FASE-TESTE-1');
  await page.locator('[data-oa-contract-person="PESSOA-TESTE-A"]').selectOption(contractId); await page.getByRole('button', { name: 'Salvar escala', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => { const row = db.distributions.find((row) => row.employeeId === 'PESSOA-TESTE-A' && row.date === '2031-01-15'); return { phaseId: row.phaseId, contractId: row.contractId }; }), { phaseId: 'FASE-TESTE-1', contractId }, 'Escala diária global salva fase e empreita');
  assert.equal(await page.evaluate(() => ObraAtivaWorkCosts.snapshot('OBRA-TESTE').labor), 0, 'presença da empreita não gera diária');
  assert.equal(await page.evaluate(() => amountForPresence(db.attendance.find((row) => row.employeeId === 'PESSOA-TESTE-A'))), 0, 'folha também não gera diária');
  assert.equal(await page.evaluate(() => db.attendance.find((row) => row.employeeId === 'PESSOA-TESTE-A').status), 'Meio período');
  await page.locator('[data-plan-employee="PESSOA-TESTE-B"]').check(); await page.getByRole('button', { name: 'Salvar escala', exact: true }).click();
  assert.equal(await page.evaluate(() => ObraAtivaWorkCosts.snapshot('OBRA-TESTE').labor), 0, 'diarista escalado com falta não gera custo');
  await page.evaluate(() => { attendanceDate='2031-01-15'; go('attendance'); });
  await page.locator('button[data-e="PESSOA-TESTE-B"][data-s="Trabalhou"]').click();
  page.once('dialog', (dialog) => dialog.accept()); await page.evaluate(() => saveAttendanceGlobal());
  assert.equal(await page.evaluate(() => ObraAtivaWorkCosts.snapshot('OBRA-TESTE').labor), 19, 'presença de diarista gera somente a diária válida');
  await page.locator('button[data-e="PESSOA-TESTE-B"][data-s="Faltou"]').click();
  page.once('dialog', (dialog) => dialog.accept()); await page.evaluate(() => saveAttendanceGlobal());
  assert.equal(await page.evaluate(() => ObraAtivaWorkCosts.snapshot('OBRA-TESTE').labor), 0, 'corrigir Trabalhou para Faltou zera o custo sem remover a escala');
  assert.equal(await page.evaluate(() => db.distributions.some((r) => r.employeeId==='PESSOA-TESTE-B' && r.workId==='OBRA-TESTE' && r.date==='2031-01-15')), true);
  await page.evaluate(() => openWorkTracker('OBRA-TESTE'));
  await tab('Financeiro da obra'); await page.getByRole('button', { name: 'Registrar custo extra', exact: true }).click();
  await select('category', 'Combustível'); await fill('value', 13.7); await select('phaseId', 'FASE-TESTE-1'); await fill('description', 'DESLOCAMENTO FICTÍCIO'); await submit();
  await page.getByRole('button', { name: 'Registrar custo extra', exact: true }).click(); await select('category', 'Outro'); await fill('customCategory', 'CUSTO PERSONALIZADO FICTÍCIO'); await fill('value', 7.9);
  await page.locator('.oa-cost-proof-field summary').click();
  await form().locator('[name=proofFile]').setInputFiles({ name: 'COMPROVANTE-FICTICIO.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0yoAAAAASUVORK5CYII=', 'base64') });
  await submit();
  const numbers = await page.evaluate(() => { const costs = ObraAtivaWorkCosts.snapshot('OBRA-TESTE'), row = workCashRows().find((r) => r.work.id === 'OBRA-TESTE'); return { daily: costs.labor, contractPaid: costs.contractPaid, extras: costs.extras, total: costs.totalCost, generalTotal: row.totalCost, generalCash: row.cash, balance: costs.balanceAfterCosts, committed: costs.commitment, client: costs.contract, perPhase: costs.byPhase.reduce((sum, phase) => sum + phase.total, 0), expenseTotal: ObraAtivaWorkCosts.expenses().filter((r) => r.workId === 'OBRA-TESTE').reduce((sum, r) => sum + r.value, 0) }; });
  assert.equal(numbers.total, 125.15); assert.equal(numbers.contractPaid, 72.55); assert.equal(numbers.extras, 52.6); assert.equal(numbers.committed, 592); assert.equal(numbers.client, 7513);
  assert.equal(numbers.generalTotal, numbers.total); assert.equal(numbers.generalCash, numbers.balance); assert.equal(Math.round(numbers.expenseTotal * 100) / 100, numbers.total); assert.equal(Math.round(numbers.perPhase * 100) / 100, numbers.total);
  assert.equal(await page.evaluate(() => ObraAtivaWorkCosts.snapshot('LEGADO-TESTE').totalCost), 0);
  assert.equal(await page.evaluate(() => JSON.stringify({ payments: db.payments, workMedia: db.workMedia, receipts: db.receipts, workClosings: db.workClosings, phases: db.workPhases, legacy: db.works.find((w) => w.id === 'LEGADO-TESTE') })), untouched);
  const financial = await page.locator('.oa-work-hub-financial').textContent(); assert.match(financial, /CONTRATO DA OBRA/); assert.match(financial, /7.513,00/); assert.match(financial, /EMPREITAS A PAGAR/);
  assert.equal(await page.locator('[data-oa-finance-history]').count(), 1, 'somente um histórico financeiro na Central');
  await page.locator('[data-oa-finance-history]>summary').click();
  assert.equal(await page.locator('[data-oa-finance-history]>div').filter({hasText:'CUSTO PERSONALIZADO FICTÍCIO'}).count(), 1, 'despesa e evento de auditoria não duplicam o lançamento na tela');
  assert.equal(await page.locator('[data-oa-finance-history]>div').filter({hasText:'Pagamento de empreita'}).count(), 2, 'exatamente dois pagamentos, sem repetições');
  await page.getByRole('button', {name:'Ver comprovante',exact:true}).click(); assert.equal(await page.locator('.oa-cost-proof').isVisible(),true); await page.evaluate(()=>closeModal());
  await page.evaluate(() => go('financial'));
  assert.match(await page.locator('.finance-executive-summary').textContent(), /125,15/);
  await page.evaluate(() => { db = JSON.parse(JSON.stringify(db)); openWorkTracker('OBRA-TESTE'); });
  assert.equal(await page.evaluate(() => ObraAtivaWorkCosts.snapshot('OBRA-TESTE').totalCost), 125.15, 'serialização preserva dados e cálculo');
  await fs.mkdir(path.join(root, 'tmp/work-costs-qa'), { recursive: true });
  for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 1024, 768], ['android-horizontal', 844, 390], ['android-menor', 667, 375], ['portrait', 390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const area of ['Empreitas', 'Financeiro da obra', 'Visão geral']) {
      await tab(area);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${name}/${area}: sem rolagem lateral global`);
      const clips = await page.locator('.oa-work-hub').evaluate((root) => [...root.querySelectorAll('button,select')].filter((e) => e.getClientRects().length).filter((e) => { const r = e.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth + 1; }).map((e) => e.textContent.slice(0, 50)));
      assert.deepEqual(clips, [], `${name}/${area}: controles dentro da tela`);
      await page.screenshot({ path: path.join(root, `tmp/work-costs-qa/${name}-${area === 'Empreitas' ? 'empreitas' : area === 'Financeiro da obra' ? 'financeiro' : 'visao-geral'}.png`) });
    }
    await tab('Empreitas'); await page.getByRole('button', { name: 'Nova empreita', exact: true }).click();
    for (const mode of ['fixed', 'meters']) {
      await select('mode', mode); await form().locator('[type=submit]').scrollIntoViewIfNeeded();
      const bounds = await form().evaluate((form) => { const button = form.querySelector('[type=submit]'), r = button.getBoundingClientRect(); return { outside: form.scrollWidth > form.clientWidth + 1, visible: r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, hit: button.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; });
      assert.deepEqual(bounds, { outside: false, visible: true, hit: true }, `${name}/${mode}: formulário utilizável`);
    }
    await form().locator('[name=name]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(root, `tmp/work-costs-qa/${name}-form.png`) }); await page.evaluate(() => closeModal());
  }
  await page.evaluate(() => { CompanyWorkspace.current.role = 'viewer'; CompanyWorkspace.current.permissionProfile = 'visualizador'; openWorkTracker('OBRA-TESTE'); });
  if (await page.getByRole('tab', { name: 'Empreitas', exact: true }).count()) { await tab('Empreitas'); assert.equal(await page.getByRole('button', { name: 'Nova empreita', exact: true }).count(), 0); }
  assert.deepEqual(errors, []);
  console.log('WORK_COSTS_UI_OK: aplicação completa, somente dados FICTÍCIOS em memória, fluxos completos, paridade financeira, contrato visível, cinco dispositivos, sem rede real.');
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
