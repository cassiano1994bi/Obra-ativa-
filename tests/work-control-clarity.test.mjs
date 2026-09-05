import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium} = require('playwright');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const allowed = new Set(['/tests/work-control-harness.html', '/index.html', ...['work-control-core-v1.js', 'work-control-sync-v1.js', 'work-control-v1.js', 'work-control-v1.css'].map(name => '/public-assets/' + name)]);
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (!allowed.has(pathname)) { res.writeHead(404); return res.end(); }
  try {
    res.setHeader('Content-Type', pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(await fs.readFile(path.join(root, pathname)));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({serviceWorkers: 'block'});
await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
const fresh = async () => {
  await page.goto(origin + '/tests/work-control-harness.html');
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
};
const names = () => page.locator('#wc-form [name]').evaluateAll(fields => [...new Set(fields.map(f => f.name))].sort());
const newFields = ['name', 'entry', 'asOfDate', 'startedAt', 'approximateStart', 'plannedEnd', 'contractValue', 'budgetValue', 'priorReceived', 'priorCost', 'initialPhase', 'initialPercent', 'teamIds', 'notes', 'photoAfter'].sort();
const shots = path.join(root, 'tmp/work-control-clarity');
try {
  await fs.mkdir(shots, {recursive: true});
  await fresh();
  const protectedData = await page.evaluate(() => JSON.stringify({employees: db.employees, attendance: db.attendance, payments: db.payments, media: db.workMedia}));
  await page.evaluate(() => openInternalWorkModal());
  assert.deepEqual(await names(), newFields, 'Nenhum campo do cadastro desapareceu');
  assert.deepEqual(await page.locator('#wc-form [required]').evaluateAll(fields => fields.map(f => f.name).sort()), ['asOfDate', 'name']);
  assert.equal(await page.locator('[name=asOfDate]').inputValue(), '2031-01-15');
  await page.locator('[name=name]').fill('OBRA FICTÍCIA — cadastro mínimo');
  await page.getByRole('button', {name: 'Salvar obra', exact: true}).click();
  assert.equal(await page.locator('#modal.show').count(), 0);
  const minimal = await page.evaluate(() => db.works.at(-1));
  assert.equal(minimal.control.baseline.contractValue, null);
  assert.equal(minimal.control.baseline.budgetValue, null);
  assert.equal(await page.locator('[data-wc-action=progress]').textContent(), '+ Adicionar primeira fase');
  await page.locator('[data-wc-action=progress]').click();
  await page.locator('[name=name]').fill('FASE FICTÍCIA — primeiro passo');
  await page.getByRole('button', {name: 'Salvar fase', exact: true}).click();
  assert.equal(await page.locator('[data-wc-action=progress]').textContent(), 'Atualizar andamento');
  await page.locator('[data-wc-action=progress]').click();
  assert.deepEqual(await names(), ['correction', 'note', 'percent', 'phaseId', 'photoAfter']);
  assert.match(await page.locator('#wc-hint-percent').textContent(), /50% = metade pronta/);
  await page.locator('[name=percent]').fill('50');
  await page.getByRole('button', {name: 'Salvar andamento', exact: true}).click();
  assert.equal(await page.evaluate(() => db.workPhases.at(-1).percent), 50);
  assert.equal(await page.evaluate(() => db.workPhases.at(-1).status), 'Em andamento');
  assert.equal(await page.evaluate(() => JSON.stringify({employees: db.employees, attendance: db.attendance, payments: db.payments, media: db.workMedia})), protectedData);
  // Obra já iniciada: os mesmos campos opcionais e totais continuam salvando.
  await page.evaluate(() => openInternalWorkModal());
  await page.locator('[name=name]').fill('OBRA FICTÍCIA — já iniciada');
  await page.locator('[name=entry]').selectOption('ongoing');
  assert.equal(await page.locator('[name=priorCost]').isVisible(), true);
  await page.locator('[name=initialPhase]').fill('ETAPA FICTÍCIA — inicial');
  await page.locator('[name=initialPercent]').fill('35');
  await page.locator('[name=priorCost]').fill('43');
  await page.locator('[name=priorReceived]').fill('0');
  await page.locator('[name=contractValue]').fill('773');
  await page.locator('[name=budgetValue]').fill('661');
  await page.locator('[name=startedAt]').fill('2031-01-03');
  await page.locator('[name=approximateStart]').check();
  await page.locator('[name=plannedEnd]').fill('2031-03-09');
  await page.locator('summary').filter({hasText: /^Equipe prevista \(opcional\)$/}).click();
  await page.locator('[name=teamIds]').first().check();
  await page.locator('[name=notes]').fill('OBSERVAÇÃO FICTÍCIA');
  await page.getByRole('button', {name: 'Salvar obra', exact: true}).click();
  const baseline = await page.evaluate(() => db.works.at(-1).control.baseline);
  assert.equal(baseline.priorCost, 43); assert.equal(baseline.priorReceived, 0);
  assert.equal(baseline.contractValue, 773); assert.equal(baseline.budgetValue, 661);
  assert.equal(baseline.approximateStart, true); assert.equal(baseline.plannedEnd, '2031-03-09');
  assert.deepEqual(baseline.teamIds, ['PESSOA-TESTE-A']); assert.equal(baseline.notes, 'OBSERVAÇÃO FICTÍCIA');
  await page.evaluate(() => openWorkTracker('OBRA-TESTE'));
  await page.locator('[data-wc-action=progress]').click();
  await page.locator('[name=phaseId]').selectOption('FASE-TESTE-1');
  await page.locator('[name=percent]').fill('5');
  await page.getByRole('button', {name: 'Salvar andamento', exact: true}).click();
  assert.equal(await page.locator('#wc-message').getAttribute('role'), 'alert');
  assert.match(await page.locator('#wc-message').textContent(), /corrigir/);
  const alertBox = await page.locator('#wc-message').boundingBox();
  const bodyBox = await page.locator('.wc-form-body').boundingBox();
  assert.ok(alertBox.y >= bodyBox.y && alertBox.y + alertBox.height <= bodyBox.y + bodyBox.height + 1, 'Erro aparece na área de preenchimento');
  for (const [label, width, height] of [['desktop',1440,900], ['tablet',1024,768], ['phone',844,390], ['small',667,375], ['portrait',390,844]]) {
    await page.setViewportSize({width,height}); await fresh();
    assert.equal(await page.locator('nav[aria-label="Áreas da obra"] button').count(), 5);
    assert.equal(await page.locator('.wc-health').count(), 4, 'As avaliações continuam disponíveis');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({path: path.join(shots, label + '-summary.png'), fullPage: true});
    for (const form of ['create','progress']) {
      if (form === 'create') await page.evaluate(() => openInternalWorkModal());
      else await page.locator('[data-wc-action=progress]').click();
      if (form === 'create') assert.deepEqual(await names(), newFields);
      assert.equal(await page.evaluate(() => document.querySelector('#dialog').scrollWidth > document.querySelector('#dialog').clientWidth + 1), false, label + '/' + form);
      const save = await page.locator('#wc-form [type=submit]').boundingBox();
      const fields = await page.locator('.wc-form-body').boundingBox(), footer = await page.locator('#wc-form footer').boundingBox();
      assert.ok(save && save.y >= 0 && save.y + save.height <= height, `${label}/${form}: salvar acessível sem procurar no fim`);
      assert.ok(fields.y + fields.height <= footer.y + 1, `${label}/${form}: rodapé não cobre os campos`);
      assert.ok(save.height >= 44, 'Área de toque de pelo menos 44px');
      await page.screenshot({path: path.join(shots, `${label}-${form}.png`)});
      await page.locator('[data-wc-action=close]').click();
    }
  }
  assert.deepEqual(errors, []);
  console.log('WORK_CONTROL_CLARITY_OK: cadastro mínimo, obra iniciada, campos preservados, primeira fase, atualização, 5 tamanhos, salvar visível; somente dados FICTÍCIOS em memória.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
