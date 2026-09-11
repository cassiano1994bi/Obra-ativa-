import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {root,startPreview} from './helpers/premium-workspace-preview.mjs';
const require = createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium} = require('playwright');
const asset = 'public-assets/obraativa-workspace-premium-v1.css';

test('tema interno: escopo, identidade, cache e pacote sem novos scripts ou imagens', async () => {
  const css = await fs.readFile(path.join(root,asset),'utf8');
  assert.match(css, /#app#app:not\(\.public-app\)/);
  for (const color of ['#020b18','#081828','#2bd466','#f4f8fc']) assert.ok(css.includes(color));
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /not\(\[hidden\]\)/);
  assert.doesNotMatch(css, /@import|url\(|@keyframes|animation:/);
  const html = await fs.readFile(path.join(root,'index.html'),'utf8');
  assert.ok(html.includes(asset));
  assert.ok((await fs.readFile(path.join(root,'service-worker.js'),'utf8')).includes('/'+asset));
  const manifest=JSON.parse(await fs.readFile(path.join(root,'scripts/release/public-files.json'),'utf8'));
  assert.ok(manifest.staticFiles.includes(asset));
  assert.ok(manifest.staticFiles.every(file=>!file.startsWith('tests/')&&!file.startsWith('tmp/')));
});

test('Home e módulos: cinco tamanhos, navegação, preferências e sessão fictícia preservados', {timeout:100000}, async () => {
  const {server,origin}=await startPreview();
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const dimensions=[['desktop',1440,900],['tablet',1024,768],['phone',844,390],['small',667,375],['portrait',390,844]];
  const contract=()=>[...document.querySelectorAll('#view button,#view a,#nav button')].map(el=>({text:el.textContent.trim(),onclick:el.getAttribute('onclick'),href:el.getAttribute('href'),hidden:el.hidden,disabled:el.disabled}));
  const records=[];
  try {
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1');
    await page.waitForSelector('.obraativa-home-premium');
    await page.waitForTimeout(400);
    await page.evaluate(()=>ObraAtivaUsage.openPrivacy());
    assert.equal(await page.locator('[data-measurement]').count(),0,'medição opcional permanece somente na recepção pública/login');
    for (const [device,width,height] of dimensions) {
      await page.setViewportSize({width,height});
      for (const module of ['home','works','planning','attendance','payments','financial','team','reports','permissions']) {
        await page.evaluate(module=>{planningDate='2031-01-15';attendanceDate='2031-01-15';planningWorkId='OBRA-TESTE';go(module)},module);
        await page.waitForTimeout(100);
        await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
        const actual=await page.evaluate(contract);
        const dataBefore=await page.evaluate(()=>JSON.stringify(db));
        await page.evaluate(asset=>{document.querySelector(`link[href^="${asset}"]`).disabled=true},asset);
        await page.waitForTimeout(40);
        assert.deepEqual(await page.evaluate(contract),actual,`${device}/${module}: mesmos controles e destinos com/sem tema`);
        await page.evaluate(asset=>{document.querySelector(`link[href^="${asset}"]`).disabled=false},asset);
        await page.waitForTimeout(40);
        assert.equal(await page.evaluate(()=>JSON.stringify(db)),dataBefore,`${device}/${module}: CSS não altera registros`);
        const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,scroll:document.documentElement.scrollWidth,width:innerWidth}));
        assert.equal(layout.overflow,false,`${device}/${module}: overflow ${layout.scroll}/${layout.width}`);
        if (module==='home') {
          const cards=await page.locator('.home-shortcut:visible').count();
          const cardLabels=await page.locator('.home-shortcut:visible').evaluateAll(elements=>elements.map(element=>element.textContent.replace(/\s+/g,' ').trim()));
          assert.equal(cards,4,`${device}: quantidade padrão de atalhos (${cardLabels.join(' | ')})`);
          const fits=await page.evaluate(()=>[...document.querySelectorAll('.home-shortcut:not([hidden])')].every(el=>el.scrollWidth<=el.clientWidth+2&&el.scrollHeight<=el.clientHeight+2));
          assert.ok(fits,`${device}: conteúdo do atalho dentro do cartão`);
          const order=await page.locator('.obraativa-home-premium > *').evaluateAll(els=>els.map(el=>el.className));
          const position=name=>order.findIndex(classes=>classes.split(' ').includes(name));
          assert.ok(position('home-insights')<position('obraativa-overview-grid'),'Avisos precedem detalhamento na ordem de leitura');
          if(width<=1180) assert.ok(position('obraativa-schedule-panel')<position('home-weather-card'),'Rotina antes do clima no tablet/celular');
          if(width>=height) {
            const tops=await page.locator('.home-shortcut:visible').evaluateAll(els=>els.map(el=>Math.round(el.getBoundingClientRect().top)));
            assert.equal(new Set(tops).size,1,`${device}: quatro atalhos visíveis por linha`);
          }
        }
        records.push(`${device}/${module}`);
      }
    }
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{db.distributions=[];db.attendance=[];go('home')});
    await page.waitForTimeout(100);
    const emptyHomeLayout=await page.evaluate(()=>{
      const schedule=document.querySelector('.obraativa-schedule-panel');
      const insights=document.querySelector('.home-insights');
      const scheduleRect=schedule.getBoundingClientRect();
      const insightsRect=insights.getBoundingClientRect();
      return {
        scheduleLeft:Math.round(scheduleRect.left),
        scheduleRight:Math.round(scheduleRect.right),
        scheduleBottom:Math.round(scheduleRect.bottom),
        insightsLeft:Math.round(insightsRect.left),
        insightsRight:Math.round(insightsRect.right),
        insightsTop:Math.round(insightsRect.top),
        insightColumns:getComputedStyle(insights).gridTemplateColumns.split(' ').length
      };
    });
    assert.equal(emptyHomeLayout.scheduleLeft,emptyHomeLayout.insightsLeft,'Home vazia alinha rotina e avisos pela esquerda');
    assert.equal(emptyHomeLayout.scheduleRight,emptyHomeLayout.insightsRight,'Home vazia usa a largura inteira sem buraco lateral');
    assert.ok(emptyHomeLayout.insightsTop>=emptyHomeLayout.scheduleBottom,'Avisos começam logo abaixo da rotina vazia');
    assert.equal(emptyHomeLayout.insightColumns,2,'Avisos usam duas colunas na tela grande');
    await fs.mkdir(path.join(root,'tmp/premium-workspace-qa'),{recursive:true});
    await page.screenshot({path:path.join(root,'tmp/premium-workspace-qa/home-empty-no-gap.png'),fullPage:true});
    for(const module of ['works','planning','attendance','payments']) {
      await page.evaluate(()=>go('home'));
      await page.locator(`.home-shortcut[onclick="go('${module}')"]`).click();
      assert.equal(await page.evaluate(()=>window.eval('page')),module);
    }
    await page.evaluate(()=>go('home'));
    await page.locator('.obraativa-shortcut-editor-button').click();
    await page.locator('[data-editor-size]').selectOption('compact');
    await page.locator('[data-editor-columns]').selectOption('2');
    await page.locator('[data-editor-count]').selectOption('3');
    await page.locator('[data-editor-apply]').click();
    assert.equal(await page.locator('.home-shortcut:visible').count(),3);
    assert.equal(await page.locator('.home-shortcuts').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
    const compact=await page.locator('.home-shortcut:visible').first().evaluate(el=>el.getBoundingClientRect().height);
    await page.locator('.obraativa-shortcut-editor-button').click();
    await page.locator('[data-editor-size]').selectOption('spacious');
    await page.locator('[data-editor-apply]').click();
    const spacious=await page.locator('.home-shortcut:visible').first().evaluate(el=>el.getBoundingClientRect().height);
    assert.ok(spacious>compact,'Preferência de tamanho continua efetiva');
    await page.locator('.obraativa-shortcut-editor-button').click();
    await page.locator('[data-editor-reset]').click();
    await page.locator('[data-editor-apply]').click();
    assert.equal(await page.locator('.home-shortcut:visible').count(),4);
    await page.keyboard.press('Tab');
    await page.locator('.home-shortcut').first().focus();
    assert.equal(await page.locator('.home-shortcut').first().evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
    await page.locator('[data-home-weather-location]').click();
    await page.waitForTimeout(150);
    assert.ok(await page.locator('.home-weather-idle small').isVisible(),'Orientação de clima continua visível quando não há permissão');
    assert.equal(await page.locator('#assistantEmployeeButton,#assistantHomeShortcut').count(),0,'A assistente removida não retorna ao editar a Home');
    assert.equal(await page.evaluate(()=>CloudSync.session.user.id),'USUARIO-TESTE');
    assert.deepEqual(errors,[]);
    await fs.mkdir(path.join(root,'tmp/premium-workspace-qa'),{recursive:true});
    await fs.writeFile(path.join(root,'tmp/premium-workspace-qa/checks.json'),JSON.stringify({status:'PASS',layouts:records,errors,compact,spacious,network:'Bloqueada; fixtures em memória'},null,2));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('Home moderna: registros preenchidos, clima completo, números zero e contraste', {timeout:60000}, async () => {
  const {server,origin}=await startPreview();
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&scenario=busy&weather=1');
    await page.waitForSelector('.home-weather-day');
    for(const [width,height] of [[1440,900],[1024,768],[844,390],[667,375],[390,844]]) {
      await page.setViewportSize({width,height});
      await page.waitForTimeout(150);
      assert.equal(await page.locator('.obraativa-schedule-row').count(),3);
      assert.equal(await page.locator('.obraativa-work-row').count(),3);
      assert.equal(await page.locator('.home-attention-item').count(),3,'Duas obras negativas e uma com contrato a receber nas fixtures atuais');
      assert.equal(await page.locator('.home-activity-item').count(),2);
      assert.equal(await page.locator('.home-weather-day').count(),3);
      assert.ok(await page.locator('.obraativa-work-percent').getByText('0%',{exact:true}).count()>=1,'Obra sem evolução permanece visível');
      const overflow=await page.evaluate(()=>[...document.querySelectorAll('.home-shortcut:not([hidden]),.home-weather-card,.home-weather-current,.home-weather-day,.obraativa-schedule-row,.obraativa-work-row,.home-attention-item,.home-activity-item')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.className));
      assert.deepEqual(overflow,[],`${width}: registros sem corte horizontal`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      if(width===1024 || width===844) {
        const heights=await page.locator('.obraativa-metric').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));
        assert.ok(heights.every(height=>height<130),'Clima não estica os cartões de indicadores em telas menores');
      }
      if(width===1440) {
        const desktopColumns=await page.evaluate(()=>({
          schedule:getComputedStyle(document.querySelector('.obraativa-schedule-panel')).gridColumn,
          insights:getComputedStyle(document.querySelector('.home-insights')).gridColumn
        }));
        assert.notEqual(desktopColumns.schedule,desktopColumns.insights,'Home preenchida preserva a divisão operacional em duas colunas');
      }
      if(width===667) {
        const title=page.locator('.home-shortcut').filter({hasText:'Pagamentos'}).locator('b');
        assert.ok(await title.evaluate(el=>el.getBoundingClientRect().height<=parseFloat(getComputedStyle(el).lineHeight)+1),'Pagamentos não quebra no meio da palavra');
      }
    }
    await page.setViewportSize({width:1440,height:900});
    await page.waitForTimeout(100);
    const colors=await page.locator('.home-shortcut').first().evaluate(el=>({fg:getComputedStyle(el.querySelector('b')).color,muted:getComputedStyle(el.querySelector('small')).color}));
    function luminance(rgb){return rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0)}
    for(const color of [colors.fg,colors.muted]) {
      const light=luminance([248,251,252]);
      const dark=luminance(color.match(/\d+/g).slice(0,3).map(Number));
      assert.ok((light+.05)/(dark+.05)>=4.5,'Contraste dos atalhos em superfície clara >= 4.5:1');
    }
    await page.locator('.home-shortcut').first().hover();
    assert.equal(await page.locator('.home-shortcut b').first().evaluate(el=>getComputedStyle(el).color),colors.fg,'Hover mantém o título legível');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.home-shortcut').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
