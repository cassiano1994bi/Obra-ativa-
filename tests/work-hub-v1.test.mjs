import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const server = http.createServer(async (request, response) => {
  try {
    const target = path.resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error('invalid path');
    const body = await fs.readFile(target);
    response.setHeader('Content-Type', target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : 'text/html');
    response.setHeader('Cache-Control', 'no-store');
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.end('Not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await context.route('**/*', (route) => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());

try {
  await page.goto(`${origin}/tests/work-control-harness.html?hub=1`);
  await page.waitForFunction(() => document.documentElement.dataset.ready === '1');
  assert.deepEqual(errors, []);

  const initialSnapshot = await page.evaluate(() => JSON.stringify(db));
  assert.equal(await page.locator('.oa-work-hub-tab').count(), 4, 'A central mantém resumo, fases, empreitas e financeiro');
  assert.equal(await page.getByRole('tab', { name: 'Equipe e escala', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: /Escalar equipe/ }).count(), 0);
  assert.match(await page.locator('.oa-work-hub-head').textContent(), /CENTRAL DA OBRA/);
  assert.match(await page.locator('.oa-work-hub-summary').textContent(), /FASE ATUAL/);
  assert.match(await page.locator('.oa-work-hub-summary').textContent(), /EQUIPE DE HOJE/);
  assert.match(await page.locator('.oa-work-hub-summary').textContent(), /R\$\s*42,50/);
  assert.match(await page.locator('.oa-work-hub-summary').textContent(), /R\$\s*113,00/);
  assert.doesNotMatch(await page.locator('.oa-work-hub-tabs').textContent(), /Fotos/i, 'Não deve existir aba de fotos');

  await page.getByRole('tab', { name: /Fases da obra/ }).click();
  assert.equal(await page.locator('.oa-work-hub-phase-card').count(), 6);
  assert.equal(await page.locator('[data-work-phase-action="add-photo"]').count(), 0, 'Adicionar fotos foi removido');
  assert.equal(await page.locator('[data-work-phase-action="open-folder"]').count(), 0, 'Galeria de fotos foi removida');
  assert.equal(await page.locator('.work-phase-folder-preview,.work-phase-folder-empty').count(), 0, 'Prévia de fotos foi removida');
  assert.doesNotMatch(await page.locator('.oa-work-hub-phases').textContent(), /foto/i);
  assert.match(await page.locator('[data-wc-phase="FASE-TESTE-1"]').textContent(), /40% pronto/);
  assert.match(await page.locator('[data-wc-phase="FASE-TESTE-1"]').textContent(), /Mão de obra/);
  assert.match(await page.locator('[data-wc-phase="FASE-TESTE-1"]').textContent(), /Definir prazo|Editar prazo/);

  await page.getByRole('tab', { name: /Financeiro da obra/ }).click();
  const financeText = await page.locator('.oa-work-hub-financial').textContent();
  assert.match(financeText, /CONTRATO DA OBRA/);
  assert.match(financeText, /RECEBIDO/);
  assert.match(financeText, /A RECEBER/);
  assert.match(financeText, /MÃO DE OBRA/);
  assert.match(financeText, /CUSTOS EXTRAS/);
  assert.match(financeText, /SALDO ATUAL/);
  assert.equal(await page.evaluate(() => JSON.stringify(db)), initialSnapshot, 'Abrir as áreas não pode alterar nenhum dado');
  assert.equal(await page.evaluate(() => db.workMedia.length), 1, 'A foto antiga permanece preservada nos dados');

  await page.evaluate(() => { activeWorkTrackerTab = 'team'; render(); });
  assert.equal(await page.getByRole('tab', { name: 'Visão geral', exact: true }).getAttribute('aria-selected'), 'true');
  await page.evaluate(() => ObraAtivaWorkHub.openTab('team'));
  assert.equal(await page.locator('.oa-work-hub-schedule').count(), 0, 'A área removida não reaparece por pedido antigo');
  assert.equal(await page.evaluate(() => JSON.stringify(db)), initialSnapshot, 'Remover o acesso duplicado não apaga escala, equipe ou outros dados');

  await page.evaluate(() => {
    CompanyWorkspace.current.role = 'supervisor';
    AccessControl.allowedModules = () => ['works', 'planning'];
    activeWorkTrackerTab = 'summary';
    render();
  });
  assert.equal(await page.locator('.oa-work-hub-tab').count(), 2);
  assert.doesNotMatch(await page.locator('.oa-work-hub-tabs').textContent(), /Financeiro/);
  assert.equal(await page.locator('.oa-work-hub-summary').getByText('MÃO DE OBRA', { exact: true }).count(), 0);

  await page.evaluate(() => {
    CompanyWorkspace.current.role = 'owner';
    AccessControl.allowedModules = () => ['works', 'planning', 'financial', 'attendance', 'reports'];
    activeWorkTrackerTab = 'summary';
    render();
  });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 844, height: 390 },
    { width: 667, height: 375 },
    { width: 390, height: 844 }
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => { activeWorkTrackerTab = 'phases'; render(); });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 1, `A central não deve criar rolagem horizontal em ${viewport.width}x${viewport.height}; excedeu ${overflow}px`);
    assert.ok(await page.locator('.oa-work-hub-tab').first().isVisible());
    assert.ok(await page.locator('.oa-work-hub-phase-card').first().isVisible());
  }

  assert.deepEqual(errors, []);
  console.log('WORK_HUB_V1_OK: quatro áreas, equipe/escala duplicada removida, pedidos antigos seguros, fases e finanças mantidas; dados FICTÍCIOS preservados e responsividade validada.');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
