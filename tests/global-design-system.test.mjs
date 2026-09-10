import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {root,startPreview} from './helpers/premium-workspace-preview.mjs';

const require = createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium} = require('playwright');
const cssAsset = 'public-assets/obraativa-design-system-v1.css';
const jsAsset = 'public-assets/obraativa-design-system-v1.js';

test('design system global: tokens, semântica, isolamento e segurança', async () => {
  const [css,js,html,worker,manifestText] = await Promise.all([
    fs.readFile(path.join(root,cssAsset),'utf8'),
    fs.readFile(path.join(root,jsAsset),'utf8'),
    fs.readFile(path.join(root,'index.html'),'utf8'),
    fs.readFile(path.join(root,'service-worker.js'),'utf8'),
    fs.readFile(path.join(root,'scripts/release/public-files.json'),'utf8')
  ]);
  for (const token of ['--oa-type-page: 24px','--oa-type-section: 18px','--oa-type-card: 16px','--oa-type-body: 14px','--oa-type-control: 14px','--oa-type-secondary: 12px','--oa-type-value: 24px']) assert.ok(css.includes(token),token);
  for (const tone of ['green','blue','yellow','orange','red','gray']) assert.ok(css.includes(`data-oa-status-tone="${tone}"`),tone);
  assert.match(css,/#app#app:not\(\.public-app\)/);
  assert.match(css,/focus-visible/);
  assert.match(css,/prefers-reduced-motion/);
  assert.doesNotMatch(css,/@import|url\(/);
  assert.match(js,/MutationObserver/);
  assert.match(js,/data\.oaStatusTone|dataset\.oaStatusTone/);
  assert.doesNotMatch(js,/\bfetch\s*\(|localStorage|sessionStorage|CloudSync|\bdb\b|innerHTML\s*=|textContent\s*=/);
  assert.ok(html.includes(cssAsset));
  assert.ok(html.includes(jsAsset));
  assert.match(worker,/CACHE_VERSION = 'v63'/);
  assert.ok(worker.includes('/'+cssAsset));
  assert.ok(worker.includes('/'+jsAsset));
  const manifest=JSON.parse(manifestText);
  assert.ok(manifest.staticFiles.includes(cssAsset));
  assert.ok(manifest.staticFiles.includes(jsAsset));
  assert.ok(manifest.staticFiles.every(file=>!file.startsWith('tests/')&&!file.startsWith('tmp/')));
});

test('telas, modais e seis formatos preservam dados, controles e responsividade', {timeout:120000}, async () => {
  const {server,origin}=await startPreview();
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const formats=[['large',1920,1080],['notebook',1366,768],['desktop',1440,900],['tablet',1024,768],['phone-landscape',844,390],['phone-portrait',390,844]];
  const modules=['home','works','team','planning','attendance','payments','financial','vehicles','reports','permissions'];
  try {
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&scenario=busy');
    await page.waitForSelector('.obraativa-home-premium');
    await page.waitForFunction(()=>window.ObraAtivaDesignSystem?.version==='1.0.0');
    const baseline=await page.evaluate(()=>JSON.stringify(db));
    for (const [label,width,height] of formats) {
      await page.setViewportSize({width,height});
      for (const module of modules) {
        await page.evaluate(module=>{planningDate='2031-01-15';attendanceDate='2031-01-15';planningWorkId='OBRA-TESTE';go(module)},module);
        await page.waitForTimeout(80);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${label}/${module}: sem rolagem horizontal global`);
        const visibleControls=page.locator('#view :is(button,input,select,textarea):visible');
        const clipped=await visibleControls.evaluateAll(elements=>elements.filter(element=>element.scrollWidth>element.clientWidth+3&&getComputedStyle(element).overflowX==='hidden').map(element=>element.textContent.trim()).slice(0,5));
        assert.deepEqual(clipped,[],`${label}/${module}: controles sem texto cortado`);
        const font=await page.locator('#view').evaluate(element=>getComputedStyle(element).fontFamily);
        assert.match(font,/Segoe UI/);
        const title=page.locator('#view h1:visible').first();
        if(await title.count()) {
          const size=parseFloat(await title.evaluate(element=>getComputedStyle(element).fontSize));
          assert.ok(size>=21&&size<=24,`${label}/${module}: título de página proporcional (${size}px)`);
        }
      }
    }
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>go('team'));
    await page.waitForTimeout(100);
    const tokens=page.locator('#view .oa-status-token');
    assert.ok(await tokens.count()>0,'status reconhecidos como componente semântico');
    for(const token of await tokens.all()) {
      assert.ok(await token.getAttribute('data-oa-status-icon'),'status inclui ícone');
      assert.ok((await token.innerText()).trim().length>1,'status mantém texto');
    }
    await page.evaluate(()=>go('home'));
    await page.waitForTimeout(100);
    const progress=page.locator('#view [data-oa-progress-tone]');
    assert.ok(await progress.count()>0,'progresso recebe estado visual consistente');
    await page.evaluate(()=>{openWorkTracker('OBRA-TESTE');window.ObraAtivaWorkHub?.openTab('phases')});
    await page.waitForTimeout(100);
    assert.ok(await page.locator('#view .ws-state.oa-status-token').count()>=6,'estados das fases usam o mesmo componente semântico');
    const cardRadii=await page.locator('#view .oa-design-card:visible').evaluateAll(elements=>elements.map(element=>parseFloat(getComputedStyle(element).borderRadius)));
    assert.ok(cardRadii.length>=6,'cartões operacionais reconhecidos pela camada global');
    assert.ok(cardRadii.every(radius=>radius===14),'cartões operacionais com raio uniforme no desktop');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'detalhes das fases sem overflow global');
    for(const type of ['work','employee','settings']) {
      await page.evaluate(type=>openModal(type),type);
      await page.waitForSelector('#modal:not([hidden]) .dialog');
      const modal=page.locator('#modal .dialog');
      assert.equal(await modal.evaluate(element=>element.scrollWidth>element.clientWidth+2),false,`modal ${type} sem corte horizontal`);
      const controls=modal.locator(':is(button,input,select,textarea):visible');
      if(await controls.count()) {
        const size=parseFloat(await controls.first().evaluate(element=>getComputedStyle(element).fontSize));
        assert.ok(size>=13&&size<=14,`modal ${type}: controle padronizado`);
      }
      await page.evaluate(()=>closeModal());
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(db)),baseline,'camada visual não altera dados fictícios');
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});

test('subabas operacionais e estados internos mantêm leitura e navegação', {timeout:90000}, async () => {
  const {server,origin}=await startPreview();
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const check=async label=>{
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${label}: sem overflow global`);
    const fonts=await page.locator('#view :is(h1,h2,h3,p,button):visible').evaluateAll(elements=>[...new Set(elements.map(element=>getComputedStyle(element).fontFamily))]);
    assert.ok(fonts.every(font=>/Segoe UI/.test(font)),`${label}: família tipográfica única`);
  };
  try {
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&scenario=busy');
    await page.waitForFunction(()=>window.ObraAtivaDesignSystem?.version==='1.0.0');
    const baseline=await page.evaluate(()=>JSON.stringify(db));
    for(const [width,height,suffix] of [[1440,900,'desktop'],[844,390,'celular horizontal'],[390,844,'celular vertical']]) {
      await page.setViewportSize({width,height});
      await page.evaluate(()=>{go('team');showEmployeePerformance()});
      await check(`desempenho da equipe/${suffix}`);
      await page.evaluate(()=>{go('attendance');toggleAttendanceRanking()});
      await check(`ranking de presença/${suffix}`);
      await page.evaluate(()=>{go('payments');changePaymentCycle(-1)});
      await check(`ciclo anterior de pagamentos/${suffix}`);
      assert.ok(await page.getByText('Ciclo selecionado',{exact:false}).count()>0,`pagamentos/${suffix}: contexto do ciclo preservado`);
      await page.evaluate(()=>{go('financial');financeComparisonMove(-1)});
      await check(`comparação da quinzena/${suffix}`);
      assert.ok(await page.getByText('Comparação da quinzena',{exact:true}).count()>0,`financeiro/${suffix}: comparação continua aberta`);
      await page.evaluate(()=>openFinanceWorkGuide('OBRA-TESTE'));
      await check(`guia financeiro da obra/${suffix}`);
      await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));
      await check(`fases da obra/${suffix}`);
      await page.evaluate(()=>openWorkPhaseFolder('OBRA-TESTE','FASE-TESTE-1'));
      await check(`fotos da fase/${suffix}`);
      for(const tab of ['overview','access','company','subscription','security']) {
        await page.evaluate(tab=>{go('permissions');openPermissionHub(tab)},tab);
        await check(`administrador ${tab}/${suffix}`);
      }
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(db)),baseline,'navegação pelas subabas não altera dados fictícios');
    assert.deepEqual(errors,[]);
  } finally {
    await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
