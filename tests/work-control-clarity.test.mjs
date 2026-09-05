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
const shots = path.join(root, 'tmp/work-control-clarity');
try {
  await fs.mkdir(shots, {recursive: true});
  await fresh();
  const protectedData = await page.evaluate(() => JSON.stringify({employees: db.employees, attendance: db.attendance, payments: db.payments, media: db.workMedia}));
  await page.evaluate(() => openInternalWorkModal());
  assert.deepEqual(await names(), ['name'], 'Cadastro só pede o nome');
  await page.locator('[name=name]').fill('OBRA FICTÍCIA — cadastro simples');
  await page.getByRole('button', {name: 'Salvar obra', exact: true}).click();
  assert.equal(await page.locator('#modal.show').count(), 0);
  assert.equal(await page.evaluate(() => db.works.at(-1).control), undefined, 'Não cria marcos financeiros ao cadastrar nome');
  await page.locator('[data-work-phase-action=new-phase]').click();
  assert.deepEqual(await names(), ['name','percent']);
  await page.locator('[name=name]').fill('FASE FICTÍCIA — primeiro passo');
  await page.getByRole('button', {name: 'Salvar fase', exact: true}).click();
  await page.locator('[data-wc-action=progress]').click();
  assert.deepEqual(await names(), ['percent']);
  await page.locator('[name=percent]').fill('100');
  await page.getByRole('button', {name: 'Salvar fase', exact: true}).click();
  assert.equal(await page.evaluate(() => db.workPhases.at(-1).status), 'Concluída');
  await page.locator('[data-wc-action=progress]').click();
  await page.locator('[name=percent]').fill('0');
  await page.getByRole('button', {name: 'Salvar fase', exact: true}).click();
  assert.equal(await page.evaluate(() => db.workPhases.at(-1).status), 'Não iniciada');
  assert.equal(await page.evaluate(() => db.workUpdates.at(-1).before.percent), 100, 'Redução registrada sem perder histórico');
  assert.equal(await page.evaluate(() => JSON.stringify({employees: db.employees, attendance: db.attendance, payments: db.payments, media: db.workMedia})), protectedData);
  // Editar só nome e percentual não apaga planejamento, notas ou campos legados.
  await page.evaluate(() => openWorkTracker('OBRA-TESTE'));
  const planningBefore=await page.evaluate(()=>JSON.stringify({plannedStart:db.workPhases[1].plannedStart,plannedEnd:db.workPhases[1].plannedEnd,plannedPersonDays:db.workPhases[1].plannedPersonDays,weight:db.workPhases[1].weight,control:db.works[0].control}));
  await page.evaluate(()=>openWorkPhaseModal('OBRA-TESTE','FASE-TESTE-1'));
  await page.locator('[name=name]').fill('FASE FICTÍCIA — nome atualizado');
  await page.locator('[name=percent]').fill('73');
  await page.getByRole('button', {name: 'Salvar fase', exact: true}).click();
  assert.equal(await page.evaluate(()=>JSON.stringify({plannedStart:db.workPhases[1].plannedStart,plannedEnd:db.workPhases[1].plannedEnd,plannedPersonDays:db.workPhases[1].plannedPersonDays,weight:db.workPhases[1].weight,control:db.works[0].control})),planningBefore);
  // Sugestões não são selecionadas sozinhas; alternar tipo mantém escolhas explícitas.
  await page.locator('[data-wc-action=template]').click();
  assert.equal(await page.locator('[data-wc-suggestion]:checked').count(),0);
  await page.locator('[data-wc-suggestion="Pintura"]').check();
  await page.locator('[data-wc-suggestion-percent="Pintura"]').fill('27');
  await page.locator('[name=template]').selectOption('renovation');
  assert.equal(await page.locator('[data-wc-suggestion-percent="Pintura"]').inputValue(),'27');
  await page.locator('[data-wc-suggestion="Demolição"]').check();
  await page.locator('[data-wc-action=close]').click();
  assert.equal(await page.evaluate(()=>db.workPhases.length),7,'Cancelar sugestões não cria fases');

  for (const [label, width, height] of [['desktop',1440,900], ['tablet',1024,768], ['phone',844,390], ['small',667,375], ['portrait',390,844]]) {
    await page.setViewportSize({width,height}); await fresh();
    assert.equal(await page.locator('.wc-tabs,.wc-health,.wc-metric').count(), 0, 'Sem painéis extras');
    assert.equal(await page.locator('.simple-phase-folder').count(),6,'Todas as fases, inclusive zeradas');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({path: path.join(shots, label + '-phases.png'), fullPage: true});
    for (const form of ['create','progress','suggestions']) {
      if (form === 'create') await page.evaluate(() => openInternalWorkModal());
      else if (form === 'progress') await page.locator('[data-wc-action=progress]').first().click();
      else await page.locator('[data-wc-action=template]').click();
      if(form==='create') assert.deepEqual(await names(),['name']);
      if(form==='progress') assert.deepEqual(await names(),['percent']);
      assert.equal(await page.evaluate(() => document.querySelector('#dialog').scrollWidth > document.querySelector('#dialog').clientWidth + 1), false, label + '/' + form);
      const save = await page.locator('#wc-form [type=submit]').boundingBox();
      const fields = await page.locator('.wc-form-body').boundingBox(), footer = await page.locator('#wc-form footer').boundingBox();
      assert.ok(save && save.y >= 0 && save.y + save.height <= height, label+'/'+form+': salvar visível');
      assert.ok(fields.y + fields.height <= footer.y + 1, label+'/'+form+': rodapé não cobre campos');
      assert.ok(save.height >= 44, 'Área de toque de pelo menos 44px');
      await page.screenshot({path: path.join(shots, label+'-'+form+'.png')});
      await page.locator('[data-wc-action=close]').click();
    }
  }
  assert.deepEqual(errors, []);
  console.log('WORK_CONTROL_CLARITY_OK: só nome/percentual, sugestões opcionais, cancelamento, dados preservados e 5 tamanhos; somente FICTÍCIOS.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
