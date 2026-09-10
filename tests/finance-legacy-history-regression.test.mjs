import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {root,startPreview} from './helpers/premium-workspace-preview.mjs';
const require=createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');

test('histórico financeiro antigo sem título abre sem alterar valores nem registros', {timeout:90000}, async()=>{
  const {server,origin}=await startPreview();
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:900}});
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&scenario=busy');await page.waitForSelector('.obraativa-home-premium');
    const moneyBefore=await page.evaluate(()=>JSON.stringify(ObraAtivaWorkCosts.snapshot('OBRA-TESTE')));
    const baseline=await page.evaluate(()=>{
      db.workUpdates.push(
        {id:'SEM-TITULO-TESTE',workId:'OBRA-TESTE',date:'2031-01-10',description:'ACORDO FICTÍCIO SEM TÍTULO',financialEvent:true,value:11},
        {id:'NULO-TITULO-TESTE',workId:'OBRA-TESTE',date:'2031-01-11',title:null,description:'REGISTRO FICTÍCIO NULO',financialEvent:true,value:12},
        {id:'NUMERICO-TITULO-TESTE',workId:'OBRA-TESTE',date:'2031-01-12',title:731,description:914,financialEvent:true,value:13},
        {id:'KIND-TITULO-TESTE',workId:'OBRA-TESTE',date:'2031-01-13',kind:'ACORDO FICTÍCIO ANTERIOR',description:'DESCRIÇÃO FICTÍCIA PRESERVADA',financialEvent:true,value:14},
        {id:'VAZIO-TITULO-TESTE',workId:'OBRA-TESTE',date:'2031-01-14',title:'',description:'TÍTULO VAZIO FICTÍCIO',financialEvent:true,value:0},
        {id:'HTML-TITULO-TESTE',workId:'OBRA-TESTE',date:'2031-01-15',title:'<img src=x onerror=alert(1)>',description:'<b>TESTE FICTÍCIO</b>',financialEvent:true,value:15}
      );return JSON.stringify(db);
    });
    for(const [label,width,height] of [['desktop',1440,900],['notebook',1366,768],['tablet',1024,768],['phone-landscape',844,390],['small-landscape',667,375],['portrait',390,844]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>go('home'));
      await page.locator('#nav button[data-obraativa-nav="financial"]').click();await page.waitForTimeout(100);
      assert.equal(await page.evaluate(()=>window.page??eval('page')),'financial',label+': menu financeiro');
      await page.evaluate(()=>openFinanceWorkGuide('OBRA-TESTE'));await page.waitForSelector('.finance-work-guide-panel');
      assert.ok(await page.locator('[data-oa-finance-history]').count()>0,label+': guia financeira com histórico');
      await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));
      await page.getByRole('tab',{name:'Financeiro da obra',exact:true}).click();await page.waitForSelector('.oa-work-hub-financial');
      await page.locator('[data-oa-finance-history]>summary').click();
      const history=page.locator('[data-oa-finance-history]');
      for(const text of ['ACORDO FICTÍCIO SEM TÍTULO','REGISTRO FICTÍCIO NULO','731','914','ACORDO FICTÍCIO ANTERIOR','DESCRIÇÃO FICTÍCIA PRESERVADA','TÍTULO VAZIO FICTÍCIO','Registro financeiro','R$ 0,00'])assert.ok((await history.innerText()).replaceAll('\u00a0',' ').includes(text),label+': mantém '+text);
      assert.equal(await history.locator('img').count(),0,'título anterior continua escapado');
      assert.equal(await page.evaluate(()=>JSON.stringify(ObraAtivaWorkCosts.snapshot('OBRA-TESTE'))),moneyBefore,'evento de histórico não vira despesa');
      await page.locator('[data-oa-period-action="fortnight"]').click();await page.waitForSelector('[data-oa-period-result]');
      await page.locator('[data-oa-period-action="total"]').click();await page.waitForSelector('[data-oa-finance-history]');
      assert.equal(await page.evaluate(()=>JSON.stringify(db)),baseline,'consulta não grava nem remove registros');
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});

test('cartões de fases mantêm geometria e conteúdo antes/depois da amostra de cores', {timeout:90000},async()=>{
  const {server,origin}=await startPreview(),browser=await chromium.launch({channel:'chrome',headless:true});
  const beforeCss=execFileSync('git',['show','3eb18f93bcbe14241b4842890bfe508b643dfee8:public-assets/obraativa-design-system-v1.css'],{cwd:root,encoding:'utf8'});
  const pages=[];const errors=[];
  try{
    for(const old of [true,false]){
      const ctx=await browser.newContext({serviceWorkers:'block'});
      await ctx.route('**/*',r=>{const url=new URL(r.request().url());if(url.origin!==origin)return r.abort();if(old&&url.pathname==='/public-assets/obraativa-design-system-v1.css')return r.fulfill({body:beforeCss,contentType:'text/css'});return r.continue();});
      const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));pages.push(page);
      await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&scenario=busy');await page.waitForSelector('.obraativa-home-premium');
      await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));await page.getByRole('tab',{name:'Fases da obra',exact:true}).click();
    }
    for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[844,390],[667,375],[390,844]]){
      // Cada comparação começa na mesma posição de rolagem e após o resize.
      // Foco/scroll anchoring do navegador não é uma mudança de geometria do cartão.
      for(const p of pages){
        await p.setViewportSize({width,height});
        await p.evaluate(async()=>{await document.fonts.ready;window.scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
        await p.waitForTimeout(120);
        assert.equal(await p.evaluate(()=>window.scrollY),0,'comparação começa no topo');
      }
      const cards=p=>p.locator('.simple-phase-folder').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {id:e.dataset.wcPhase,text:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height,bg:s.backgroundColor,border:s.border,radius:s.borderRadius,display:s.display};}));
      const old=await cards(pages[0]),current=await cards(pages[1]);
      assert.deepEqual(current,old,'cartões sem mudanças pela paleta '+width);
      assert.equal(current.length,6,'todas as fases fictícias mantidas');
      assert.ok(current.every(c=>c.display==='grid'&&parseFloat(c.radius)>0&&c.border.startsWith('1px solid')),'cartões com caixas preservadas');
      for(const action of ['progress','template'])assert.ok(await pages[1].locator(`[data-wc-action="${action}"]`).count()>0);
      assert.equal(await pages[1].locator('[data-ws-action="deadline"]').count(),6,'prazos preservados');
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
