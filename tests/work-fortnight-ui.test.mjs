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
const server = http.createServer(async (req, res) => {
  try {
    const target = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!target.startsWith(root + path.sep)) throw Error('path');
    res.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : target.endsWith('.svg') ? 'image/svg+xml' : target.endsWith('.png') ? 'image/png' : target.endsWith('.webp') ? 'image/webp' : 'text/html');
    res.setHeader('Cache-Control', 'no-store'); res.end(await fs.readFile(target));
  } catch { res.statusCode = 404; res.end('not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
const page = await context.newPage(), errors = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => {
  const data = new Map(), memory = { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), clear: () => data.clear(), key: i => [...data.keys()][i] || null, get length() { return data.size; } };
  Object.defineProperty(window, 'localStorage', { value: memory }); Object.defineProperty(window, 'sessionStorage', { value: memory });
  const Native = Date; window.Date = class extends Native { constructor(...args) { super(...(args.length ? args : ['2031-01-15T12:00:00Z'])); } static now() { return Native.parse('2031-01-15T12:00:00Z'); } };
});
// Todas as chamadas externas são bloqueadas ou respondidas com simulação local.
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.pathname.includes('save_company_app_state')) writes.push(url.pathname);
  if (url.pathname.startsWith('/rest/v1/company_app_state')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ work_control_revision: 1 }]) });
  if (url.pathname === '/rest/v1/rpc/read_work_control_history') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  if (url.origin === origin && !url.pathname.startsWith('/.netlify/')) return route.continue();
  return route.abort();
});
const tab = name => page.getByRole('tab', { name, exact: true }).click();
const action = name => page.locator(`[data-oa-period-action="${name}"]`).click();
const total = async () => Number((await page.locator('[data-oa-period-total]').innerText()).replace(/[^\d,-]/g, '').replace(',', '.'));
const range = () => page.locator('.oa-work-period').evaluate(el => ({ from: el.dataset.from, to: el.dataset.to }));
const detailOpen = () => page.locator('.oa-work-period-details').evaluate(el => el.open);
try {
  await page.goto(origin + '/index.html?app=1'); await page.waitForFunction(() => !!window.ObraAtivaWorkCosts);
  await page.evaluate(async source => {
    const keys = Object.entries(db).filter(([, value]) => Array.isArray(value)).map(([key]) => key); (0, eval)(source);
    for (const key of [...keys, 'workClients', 'clients', 'vehicles', 'receivableDiscounts', 'advances', 'discounts', 'licenses', 'workPermissions']) db[key] ??= [];
    db.settings = { cycleStart: '2030-12-20', paymentInitialStart: '2030-12-07' };
    // Seleção antiga na aba global não deve virar a "quinzena atual" da obra.
    paymentCycleDate = '2030-12-20'; financeComparisonDate = '2030-12-27';
    db.receivables = [{ id: 'CONTRATO-QUINZENA-FICTICIO', workId: 'OBRA-TESTE', total: 2317, startDate: '2031-01-01' }];
    db.receipts.push({ id: 'ENTRADA-ANTERIOR-TESTE', workId: 'OBRA-TESTE', date: '2031-01-03', value: 127 });
    db.works[0].control.empreitas = [{ id: 'EMPREITA-QUINZENA-TESTE', workId: 'OBRA-TESTE', total: 229, name: 'SERVIÇO FICTÍCIO', responsible: 'EMPREITEIRO FICTÍCIO', mode: 'fixed' }];
    db.employees.push({ id: 'PESSOA-EMPREITA-TESTE', name: 'EMPREITEIRO FICTÍCIO SEM DIÁRIA', daily: 41, startDate: '2030-01-01', status: 'Ativo' }, { id: 'PESSOA-ESCALA-TESTE', name: 'PESSOA FICTÍCIA SÓ ESCALADA', daily: 37, startDate: '2030-01-01', status: 'Ativo' });
    for (const [id, date, phaseId] of [['ANTES', '2031-01-02', 'FASE-TESTE-0'], ['INICIO', '2031-01-04', 'FASE-TESTE-0'], ['MEIO', '2031-01-05', 'FASE-TESTE-1']]) {
      db.attendance.push({ id: `PRESENCA-QUINZENA-TESTE-${id}`, employeeId: 'PESSOA-TESTE-A', workId: 'OBRA-TESTE', date, status: 'Trabalhou', phaseId });
    }
    db.attendance.push({ id: 'PRESENCA-EMPREITA-TESTE', employeeId: 'PESSOA-EMPREITA-TESTE', workId: 'OBRA-TESTE', date: '2031-01-10', status: 'Trabalhou', paymentMode: 'contract', contractId: 'EMPREITA-QUINZENA-TESTE' });
    db.distributions.push({ id: 'ESCALA-SEM-PRESENCA-TESTE', employeeId: 'PESSOA-ESCALA-TESTE', workId: 'OBRA-TESTE', date: '2031-01-12' });
    db.otherExpenses.push({ id: 'PARCELA-QUINZENA-TESTE', workId: 'OBRA-TESTE', date: '2031-01-12', value: 79, costType: 'contractPayment', contractId: 'EMPREITA-QUINZENA-TESTE', phaseId: 'FASE-TESTE-2', description: 'PARCELA FICTÍCIA' }, { id: 'EXTRA-ANTERIOR-TESTE', workId: 'OBRA-TESTE', date: '2031-01-03', value: 7, description: 'EXTRA FICTÍCIO ANTERIOR' }, { id: 'EXTRA-FUTURO-TESTE', workId: 'OBRA-TESTE', date: '2031-01-16', value: 2, description: 'EXTRA FICTÍCIO FUTURO' }, { id: 'CUSTO-OUTRA-OBRA-TESTE', workId: 'LEGADO-TESTE', date: '2031-01-15', value: 53, description: 'OUTRA OBRA FICTÍCIA' });
    db.otherExpenses.push({ ...db.otherExpenses[1] }); // Mesma identidade: não contar duas vezes.
    CompanyWorkspace.current = { id: 'EMPRESA-TESTE', name: 'EMPRESA FICTÍCIA', role: 'owner', permissionProfile: 'gerente' };
    CloudSync.session = { access_token: 'TOKEN-FICTICIO', user: { id: 'USUARIO-TESTE', email: 'teste@example.invalid', user_metadata: { full_name: 'GESTOR FICTÍCIO' } } };
    CloudSync.schedule = () => {}; CloudSync.showAuth = () => {};
    await CloudSync.request('/rest/v1/company_app_state?company_id=eq.EMPRESA-TESTE&select=data', {}, CloudSync.session.access_token);
    document.querySelectorAll('#cloudGate,#obraAtivaSplash,.cloud-auth-overlay,.cloud-session-retry-overlay').forEach(el => el.remove());
    document.body.classList.remove('cloud-auth-required', 'public-mode', 'auth-mode');
    openWorkTracker('OBRA-TESTE');
  }, data);
  await tab('Financeiro da obra');
  const original = await page.evaluate(() => JSON.stringify(db));
  const general = await page.evaluate(() => ({ selection: selectedPaymentCycle(), comparison: financeComparisonDate, markup: financeFortnightComparisonMarkup() }));
  assert.equal(await page.locator('[data-oa-period-action="total"]').getAttribute('aria-pressed'), 'true');
  const accumulated = await page.locator('.oa-work-hub-finance-grid').innerText();
  await action('fortnight');
  assert.deepEqual(await range(), { from: '2031-01-04', to: '2031-01-17' });
  assert.equal(await total(), 155.5);
  assert.match(await page.locator('[data-oa-period-received]').innerText(), /113,00/);
  assert.match(await page.locator('[data-oa-period-result]').innerText(), /-R\$\s*42,50/);
  assert.match(await page.locator('.oa-work-period-result').innerText(), /NEGATIVO/);
  assert.match(await page.locator('[data-oa-period-daily]').innerText(), /45,50/);
  assert.match(await page.locator('[data-oa-period-contract]').innerText(), /79,00/);
  assert.match(await page.locator('[data-oa-period-extras]').innerText(), /31,00/);
  assert.match(await page.locator('.oa-work-period-status').innerText(), /Parcial até 15\/01\/2031/);
  assert.match(await page.locator('.oa-work-period-commitment').innerText(), /150,00/);
  assert.equal(await detailOpen(), false);
  await page.locator('.oa-work-period-details>summary').click();
  assert.equal(await detailOpen(), true);
  const employees = page.locator('.oa-work-period-detail-body>section').nth(2);
  assert.match(await employees.innerText(), /FUNCIONÁRIO FICTÍCIO A/); assert.match(await employees.innerText(), /3 dias com presença · 2,5 diárias equivalentes/);
  assert.doesNotMatch(await employees.innerText(), /FUNCIONÁRIO FICTÍCIO B|EMPREITEIRO FICTÍCIO SEM DIÁRIA|PESSOA FICTÍCIA SÓ ESCALADA/);
  assert.match(await page.locator('.oa-work-period-detail-body>section').nth(1).innerText(), /Entrega FICTÍCIA/);
  assert.equal(await page.locator('.oa-work-period-detail-body>section').first().locator('li').count(), 1, 'recebimento do fechamento não duplica');
  await action('previous'); assert.equal(await total(), 24); assert.equal(await detailOpen(), true);
  assert.match(await page.locator('[data-oa-period-received]').innerText(), /127,00/);
  assert.match(await page.locator('[data-oa-period-result]').innerText(), /103,00/); assert.match(await page.locator('.oa-work-period-result').innerText(), /POSITIVO/);
  assert.deepEqual(await range(), { from: '2030-12-21', to: '2031-01-03' });
  await action('previous'); assert.deepEqual(await range(), { from: '2030-12-07', to: '2030-12-20' });
  assert.equal(await page.locator('[data-oa-period-action="previous"]').isDisabled(), true);
  await action('next'); await action('next'); assert.equal(await total(), 155.5); assert.equal(await detailOpen(), true);
  await action('next'); assert.equal(await total(), 0); assert.match(await page.locator('.oa-work-period-status').innerText(), /futura/);
  assert.match(await page.locator('.oa-work-period-result').innerText(), /SEM DIFERENÇA/);
  await action('current'); assert.equal(await total(), 155.5);
  await tab('Equipe e escala'); await tab('Financeiro da obra'); assert.equal(await total(), 155.5); assert.equal(await detailOpen(), true);
  await tab('Fases da obra'); await page.getByRole('button', { name: 'Ver gastos por fase', exact: true }).click();
  assert.equal(await page.locator('.oa-cost-phase-breakdown').evaluate(el => el.open), true);
  assert.equal(await page.locator('.oa-work-hub-finance-grid').innerText(), accumulated);
  await action('fortnight');
  await page.evaluate(() => openWorkTracker('LEGADO-TESTE')); await tab('Financeiro da obra');
  assert.equal(await page.locator('[data-oa-period-action="total"]').getAttribute('aria-pressed'), 'true');
  await action('fortnight'); assert.equal(await total(), 53);
  await page.evaluate(() => openWorkTracker('OBRA-TESTE')); await tab('Financeiro da obra'); assert.equal(await total(), 155.5);
  assert.equal(await page.evaluate(() => JSON.stringify(db)), original, 'consultar não modifica dados');
  assert.deepEqual(await page.evaluate(() => ({ selection: selectedPaymentCycle(), comparison: financeComparisonDate, markup: financeFortnightComparisonMarkup() })), general, 'Financeiro e Pagamentos gerais preservados');

  // Capturas e medições em desktop, tablet, celular deitado e em pé.
  await fs.mkdir(path.join(root, 'tmp/work-fortnight-qa'), { recursive: true });
  for (const [width, height] of [[1920, 1080], [1440, 1000], [1024, 768], [768, 1024], [844, 390], [667, 375], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await action('total');
    const numberStyle = await page.locator('.oa-work-hub-finance-grid b').first().evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight, font: getComputedStyle(el).fontFamily }));
    const secondaryStyle = await page.locator('.oa-work-hub-cost-composition b').first().evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight, font: getComputedStyle(el).fontFamily }));
    await action('fortnight');
    assert.deepEqual(await page.locator('[data-oa-period-total]').evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight, font: getComputedStyle(el).fontFamily })), numberStyle, `${width}: números no mesmo padrão do total da obra`);
    assert.deepEqual(await page.locator('[data-oa-period-daily]').evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight, font: getComputedStyle(el).fontFamily })), secondaryStyle, `${width}: detalhamento com o mesmo padrão dos custos acumulados`);
    if (await detailOpen()) await page.locator('.oa-work-period-details>summary').click();
    await page.locator('.oa-work-cost-view').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}: sem rolagem lateral`);
    const measures = await page.locator('.oa-work-period-metrics b').evaluateAll(nodes => nodes.map(el => ({ font: parseFloat(getComputedStyle(el).fontSize), weight: parseInt(getComputedStyle(el).fontWeight), overflow: el.scrollWidth > el.clientWidth + 1 })));
    assert.ok(measures.every(v => v.font >= 20 && v.weight >= 700 && !v.overflow), `${width}: valores legíveis ${JSON.stringify(measures)}`);
    assert.ok(await page.locator('.oa-work-cost-view button,.oa-work-period-navigation button').evaluateAll(nodes => nodes.every(el => el.getBoundingClientRect().height >= 44)), `${width}: alvos de toque`);
    await page.screenshot({ path: path.join(root, `tmp/work-fortnight-qa/${width}-periodo.png`) });
    await page.locator('.oa-work-period-metrics').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(root, `tmp/work-fortnight-qa/${width}-custos.png`) });
    await page.locator('.oa-work-period-details>summary').click();
    await page.locator('.oa-work-period-detail-body').scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: path.join(root, `tmp/work-fortnight-qa/${width}-detalhes.png`) });
    await action('previous'); assert.equal(await detailOpen(), true); await action('current');
  }
  await page.evaluate(() => { db.otherExpenses.find(r => r.id === 'DESPESA-TESTE').value = 9123456.78; render(); });
  for (const [width, height] of [[1440, 1000], [844, 390], [667, 375], [390, 844]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}: valor grande sem estouro`);
    const overflow = await page.locator('.oa-work-period-metrics b,.oa-work-period-costs b').evaluateAll(nodes => nodes.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
    assert.deepEqual(overflow, [], `${width}: valores grandes inteiros, sem cortar ou quebrar os dígitos`);
  }
  await page.evaluate(() => { db.otherExpenses.find(r => r.id === 'DESPESA-TESTE').value = 31; render(); });
  // Alternância de falta/presença só na memória fictícia. Diário histórico preservado.
  await page.evaluate(() => { db.attendance.find(r => r.id === 'FALTA-TESTE').status = 'Trabalhou'; render(); }); assert.equal(await total(), 174.5);
  await page.evaluate(() => { db.attendance.find(r => r.id === 'FALTA-TESTE').status = 'Faltou'; render(); }); assert.equal(await total(), 155.5);
  await page.evaluate(() => { db.works[0].control.baseline.priorCost = 101; render(); }); assert.equal(await total(), 155.5);
  assert.match(await page.locator('.oa-work-period-notice').first().innerText(), /101,00.*custo anterior/);
  await page.evaluate(() => { Object.assign(CompanyWorkspace.current, { role: 'viewer', permissionProfile: 'visualizador', permissionModules: ['works', 'financial'] }); render(); });
  assert.equal(await total(), 155.5); assert.equal(await page.locator('.oa-work-hub-finance-actions button').count(), 0);
  await action('previous'); assert.equal(await total(), 24); await action('current');
  await page.evaluate(() => { CompanyWorkspace.current.permissionModules = ['works']; render(); });
  assert.equal(await page.getByRole('tab', { name: 'Financeiro da obra', exact: true }).count(), 0); assert.equal(await page.locator('.oa-work-period').count(), 0);
  assert.deepEqual(writes, []); assert.deepEqual(errors, []);
  console.log('FORTNIGHT_UI_OK: recebido, custo, resultado positivo/negativo/zero, datas, falta zero, empreita sem diária, histórico de diária, duplicatas, fases/funcionários, parcial, futuro, navegação sem fechar, escopo por obra, permissões, preservação e 7 tamanhos de tela com números no mesmo padrão. Rede externa bloqueada; somente dados FICTÍCIOS.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
