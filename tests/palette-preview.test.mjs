import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {root,startPreview} from './helpers/premium-workspace-preview.mjs';
const require=createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const assets=['obraativa-design-system-v1.css','obraativa-product-site-v2.css','obraativa-home-v1.js'];
// Referência imutável anterior à paleta; o próximo commit não pode mover a comparação.
const paletteBaseline='3eb18f93bcbe14241b4842890bfe508b643dfee8';
const before=new Map(assets.map(file=>['/public-assets/'+file,execFileSync('git',['show',paletteBaseline+':public-assets/'+file],{cwd:root,encoding:'utf8'})]));
const formats=[['large',1920,1080],['desktop',1440,1000],['notebook',1366,768],['tablet',1024,768],['tablet-portrait',768,1024],['phone-landscape',844,390],['small-landscape',667,375],['phone-portrait',390,844]];
const dir=path.join(root,'tmp/palette-qa');
const navy='rgb(15, 45, 74)',green='rgb(22, 163, 74)',white='rgb(255, 255, 255)';
async function fixture(fn){
  const {server,origin}=await startPreview();
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const errors=[];
  const newPage=async(old=false,options={})=>{
    const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000},...options});
    await ctx.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin!==origin)return route.abort();
      if(old&&before.has(url.pathname))return route.fulfill({body:before.get(url.pathname),contentType:url.pathname.endsWith('.css')?'text/css':'text/javascript'});
      return route.continue();
    });
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));return page;
  };
  try{await fs.mkdir(dir,{recursive:true});await fn({origin,newPage});assert.deepEqual(errors,[]);}finally{await browser.close();await new Promise(r=>server.close(r));}
}
const style=(page,selector,prop)=>page.locator(selector).first().evaluate((e,p)=>getComputedStyle(e)[p],prop);
const controls=page=>page.evaluate(()=>[...document.querySelectorAll('#nav button,#view button,#view a,#view input,#view select')].map(e=>({tag:e.tagName,text:e.textContent.trim(),onclick:e.getAttribute('onclick'),href:e.getAttribute('href'),type:e.getAttribute('type'),hidden:e.hidden,disabled:e.disabled})));
const content=page=>page.locator('#view').textContent();
const go=async(page,module)=>{await page.evaluate(m=>{planningDate='2031-01-15';attendanceDate='2031-01-15';go(m)},module);await page.waitForTimeout(120);};
async function fit(page,label){
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label+': sem overflow global');
  const clipped=await page.locator('#view :is(button,input,select,textarea):visible').evaluateAll(es=>es.filter(e=>e.scrollWidth>e.clientWidth+3&&getComputedStyle(e).overflowX==='hidden').map(e=>e.textContent.trim()));
  assert.deepEqual(clipped,[],label+': controles não cortados');
}
async function contrast(page,selector){
  return page.locator(selector).first().evaluate(element=>{
    const rgba=v=>v.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];
    const over=(a,b)=>a.slice(0,3).map((v,i)=>v*(a[3]??1)+b[i]*(1-(a[3]??1)));
    const luminance=c=>c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
    const chain=[];for(let e=element;e;e=e.parentElement)chain.unshift(e);
    let bg=[255,255,255],gradients=[];
    for(const e of chain){const s=getComputedStyle(e);const c=rgba(s.backgroundColor);bg=over(c,bg);if(c[3]!==0)gradients=[];const stops=s.backgroundImage.match(/rgba?\([^)]+\)/g);if(stops)gradients=stops.map(v=>over(rgba(v),bg));}
    const fg=rgba(getComputedStyle(element).color);
    return Math.min(...(gradients.length?gradients:[bg]).map(b=>ratio(over(fg,b),b)));
  });
}

test('página pública: conflito reproduzido, contraste corrigido e acesso ao login preservado', {timeout:90000},()=>fixture(async({origin,newPage})=>{
  const old=await newPage(true),page=await newPage();
  for(const p of [old,page]){await p.goto(origin+'/index.html?produto=1');await p.waitForSelector('.oa-login-button');}
  assert.ok(await contrast(old,'.oa-login-button')<2,'reproduz Entrar escuro sobre escuro antes da correção');
  for(const [label,width,height] of formats){
    for(const p of [old,page])await p.setViewportSize({width,height});
    assert.equal(await page.locator('.oa-public-site').textContent(),await old.locator('.oa-public-site').textContent(),'nenhum conteúdo público removido');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,label);
    for(const selector of ['.oa-login-button','.oa-dashboard-top>b','.oa-module-card h3','.oa-audience-grid h3','.oa-security-card h2','.oa-price-card h3','.oa-faq-grid summary','.oa-final-cta h2'])assert.ok(await contrast(page,selector)>=4.5,`${label}: ${selector} legível`);
    const button=page.locator('.oa-login-button');
    const originalBox=await old.locator('.oa-login-button').boundingBox();
    assert.deepEqual(await button.boundingBox(),originalBox,label+': mesmo tamanho e posição do botão');
    for(const state of ['hover','focus']){
      if(state==='hover')await button.hover();else await button.focus();
      await page.waitForTimeout(200);
      assert.ok(await contrast(page,'.oa-login-button')>=4.5,label+'/'+state);
    }
    if(['desktop','phone-landscape','phone-portrait'].includes(label))await page.screenshot({path:path.join(dir,'public-'+label+'.png'),fullPage:true});
    await page.mouse.move(0,0);
  }
  await page.locator('.oa-login-button').click();await page.waitForSelector('#cloudGate .obraativa-auth-primary');
  assert.match(page.url(),/app=1/,'Entrar abre a mesma rota de acesso');
  assert.ok(await contrast(page,'#cloudGate .obraativa-auth-primary')>=4.5,'submit do login legível');
  await page.locator('#cloudGate [data-access-mode="signup"]').click();
  await page.waitForSelector('#cloudGate [data-access-mode="signin"]');
  assert.ok(await contrast(page,'#cloudGate [data-access-mode="signin"]')>=4.5,'voltar para Entrar legível no cadastro');
  assert.ok(await contrast(page,'#cloudGate .obraativa-auth-primary')>=4.5,'criar conta legível');
  await page.locator('#cloudGate [data-access-mode="signin"]').click();
  await page.waitForSelector('#cloudGate [data-access-mode="signup"]');
}));

test('amostra Home/menu: oito formatos, conteúdo e dados idênticos antes/depois', {timeout:120000},()=>fixture(async({origin,newPage})=>{
  const old=await newPage(true),page=await newPage();
  for(const p of [old,page]){await p.goto(origin+'/tests/premium-workspace-preview.html?app=1&scenario=busy&weather=1');await p.waitForSelector('.obraativa-home-premium');await p.waitForTimeout(250);}
  const baseline=await old.evaluate(()=>JSON.stringify(db));
  for(const [label,width,height] of formats){
    for(const p of [old,page]){await p.setViewportSize({width,height});await p.waitForTimeout(180);}
    assert.equal(await content(page),await content(old),label+': mesmos textos, indicadores e valores');
    assert.deepEqual(await controls(page),await controls(old),label+': mesmos controles e destinos');
    assert.equal(await page.evaluate(()=>JSON.stringify(db)),baseline,label+': dados fictícios intocados');
    await fit(page,label);
    assert.equal(await style(page,'.side','backgroundColor'),navy);
    assert.equal(await style(page,'.home-operational-head','backgroundColor'),navy);
    assert.equal(await style(page,'#nav button.active','backgroundColor'),green);
    assert.equal(await style(page,'.obraativa-metric','backgroundColor'),white);
    assert.equal(await style(page,'.obraativa-finance-total b','color'),'rgb(185, 28, 28)','saldo negativo vermelho');
    assert.equal(await style(page,'.obraativa-finance-total article:last-child b','color'),navy,'previsão não é receita realizada');
    for(const [tone,color] of [['income',green],['expense','rgb(239, 68, 68)'],['forecast','rgb(37, 99, 235)']])assert.equal(await style(page,`[data-oa-finance-bar="${tone}"] i`,'backgroundColor'),color);
    for(const selector of ['#nav button.active','.home-operational-head h1','.obraativa-metric strong','.obraativa-metric small','.obraativa-panel-head h2','.obraativa-panel-head p','.obraativa-schedule-panel .obraativa-panel-link','.obraativa-work-open','.home-insight-link','.obraativa-finance-total b','.obraativa-work-copy small'])assert.ok(await contrast(page,selector)>=4.5,label+': contraste '+selector);
    assert.equal(await style(page,'.obraativa-metric strong','fontWeight'),'800');
    for(const button of await page.locator('#nav button:visible').all()){
      const key=await button.getAttribute('data-obraativa-nav');
      if(key)assert.ok(await contrast(page,`#nav button[data-obraativa-nav="${key}"]`)>=4.5,label+': menu legível '+key);
    }
    await page.screenshot({path:path.join(dir,'home-'+label+'.png'),fullPage:true});
  }
  await page.getByRole('button',{name:'Abrir escala completa',exact:true}).click();await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.page??eval('page')),'planning');
  await go(page,'home');await page.getByRole('button',{name:'Abrir financeiro',exact:true}).click();await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.page??eval('page')),'financial');
  assert.equal(await page.evaluate(()=>JSON.stringify(db)),baseline,'navegar não modifica dados');
}));

test('celular com toque e movimento reduzido: menu e controles mantêm contraste', {timeout:60000},()=>fixture(async({origin,newPage})=>{
  for(const [label,width,height] of [['android-landscape',844,390],['android-portrait',390,844]]){
    const page=await newPage(false,{viewport:{width,height},screen:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:2,reducedMotion:'reduce'});
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&scenario=busy&weather=1');await page.waitForSelector('.obraativa-home-premium');await page.waitForTimeout(250);
    await fit(page,label);
    assert.equal(await style(page,'#nav','backgroundColor'),navy);
    assert.ok(await contrast(page,'#nav button[data-obraativa-nav="works"]')>=4.5);
    await page.screenshot({path:path.join(dir,'home-'+label+'.png')});
    await page.locator('.obraativa-finance-total').scrollIntoViewIfNeeded();
    assert.equal(await style(page,'.obraativa-finance-total b','color'),'rgb(185, 28, 28)');
    await page.screenshot({path:path.join(dir,'home-'+label+'-finance.png')});
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&screen=login');await page.waitForSelector('.obraativa-reception-shell');
    for(const selector of ['#cloudGate .obraativa-auth-primary','#cloudGate [data-access-mode="signup"]'])assert.ok(await contrast(page,selector)>=4.5,label+': acesso legível');
  }
}));

test('demais módulos e login mantêm cores, fontes, controles e geometria anteriores', {timeout:120000},()=>fixture(async({origin,newPage})=>{
  const old=await newPage(true),page=await newPage();
  for(const p of [old,page]){await p.goto(origin+'/tests/premium-workspace-preview.html?app=1&scenario=busy');await p.waitForSelector('.obraativa-home-premium');}
  const appearance=p=>p.locator('#view :is(h1,h2,h3,p,b,strong,small,button,input,select,article,.card)').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {text:e.textContent,color:s.color,background:s.background,border:s.borderColor,font:s.font,fontWeight:s.fontWeight,x:r.x,y:r.y,w:r.width,h:r.height};}));
  for(const [label,width,height] of formats.filter(([label])=>['desktop','phone-landscape','phone-portrait'].includes(label))){
    for(const p of [old,page])await p.setViewportSize({width,height});
    for(const module of ['works','team','planning','attendance','payments','financial','vehicles','reports','permissions']){
      for(const p of [old,page])await go(p,module);
      assert.deepEqual(await controls(page),await controls(old),label+'/'+module+': ações preservadas');
      assert.deepEqual(await appearance(page),await appearance(old),label+'/'+module+': aparência anterior preservada fora da Home');
      await fit(page,label+'/'+module);
    }
  }
  for(const p of [old,page]){await p.goto(origin+'/tests/premium-workspace-preview.html?app=1&screen=login');await p.waitForSelector('.obraativa-reception-shell');}
  const auth=p=>p.locator('#cloudGate :is(h1,p,button,input,label)').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {text:e.textContent,color:s.color,bg:s.background,font:s.font,w:r.width,h:r.height};}));
  assert.deepEqual(await auth(page),await auth(old),'formulário de login sem mudança de layout ou paleta');
}));

test('semântica do saldo positivo, zero e negativo sem modificar o cálculo original', {timeout:60000},()=>fixture(async({origin,newPage})=>{
  const old=await newPage(true),page=await newPage();
  for(const p of [old,page]){await p.goto(origin+'/tests/premium-workspace-preview.html?app=1');await p.waitForSelector('.obraativa-home-premium');}
  const baseline=await page.evaluate(()=>JSON.stringify(db));
  for(const [received,tone,color] of [[0,'negative','rgb(185, 28, 28)'],[43.51,'neutral',navy],[100,'positive','rgb(22, 101, 52)']]){
    // Cenários artificiais somente na memória isolada, nunca dados ou contas reais.
    for(const p of [old,page])await p.evaluate(n=>{window.__OBRAATIVA_PREVIEW_DATA__={...db,received:n,labor:43.51,expected:99,balance:n-43.51};render();},received);
    await page.waitForTimeout(150);await old.waitForTimeout(150);
    const metric=page.locator('.obraativa-metric[data-oa-finance-tone]');
    assert.equal(await metric.getAttribute('data-oa-finance-tone'),tone);
    assert.equal(await style(page,'.obraativa-metric[data-oa-finance-tone] strong','color'),color);
    assert.equal(await style(page,'.obraativa-finance-total article:first-child b','color'),color);
    // Os mesmos valores de entrada continuam resultando nos mesmos números e comprimentos de barras.
    assert.equal(await content(page),await content(old));
    assert.deepEqual(await page.locator('.obraativa-bar-track i').evaluateAll(es=>es.map(e=>e.style.width)),await old.locator('.obraativa-bar-track i').evaluateAll(es=>es.map(e=>e.style.width)));
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(db)),baseline,'variação de apresentação não grava dados');
}));
