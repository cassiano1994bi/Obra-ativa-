// Interface ATUAL, fixtures em memória e rede externa bloqueada. Não usa backups.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {startPreview,root} from './helpers/premium-workspace-preview.mjs';
const {chromium}=createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const {server,origin}=await startPreview();
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({serviceWorkers:'block'});
await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
const page=await context.newPage(),errors=[],assistantRequests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(/assistant-.*\.js|\/functions\/assistant-/.test(r.url()))assistantRequests.push(r.url())});
page.on('dialog',dialog=>dialog.accept());
const output=path.join(root,'tmp/assistant-removal-20260911');
await fs.mkdir(output,{recursive:true});
async function noAssistant(){
  assert.equal(await page.locator('#assistantDigitalEmployee,#assistantEmployeeButton,#assistantHomeShortcut,#assistantObraPhase1,#assistantPerformancePhase5,#welcomeAssistantOverlay,.obraativa-reception-ai').count(),0);
  assert.doesNotMatch(await page.locator('body').innerText(),/Assistente IA|ASSISTENTE INTELIGENTE|Eu sou a Ana|ANA ·/);
}
try {
  for(const [width,height] of [[1440,900],[844,390],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.goto(origin+'/index.html?produto=1');
    await page.waitForSelector('.oa-public-site');
    assert.equal(await page.locator('.oa-module-card').count(),8);
    assert.equal(await page.locator('.oa-price-card').count(),1);
    await noAssistant();
    await page.screenshot({path:path.join(output,'public-'+width+'.png')});
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&screen=login');
    await page.waitForSelector('input[name="email"]');
    await page.waitForSelector('#obraAtivaSplash',{state:'hidden'});
    await page.waitForSelector('.obraativa-reception-story');
    await noAssistant();
    assert.ok(await page.locator('input[name="password"]').count());
    await page.screenshot({path:path.join(output,'login-'+width+'.png')});
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&scenario=busy');
    await page.waitForSelector('.home-operational');
    await noAssistant();
    const snapshot=await page.evaluate(()=>JSON.stringify(db));
    for(const module of ['works','planning','attendance','payments','financial','team','estimates','reports','routine','home']) {
      await page.evaluate(name=>go(name),module);
      await noAssistant();
    }
    await page.evaluate(()=>go('assistant'));
    await noAssistant();
    assert.equal(await page.evaluate(()=>JSON.stringify(db)),snapshot,'navegação não modifica dados FICTÍCIOS');
    await page.evaluate(()=>go('home'));
    await page.screenshot({path:path.join(output,'home-'+width+'.png')});
    console.log('SEM_IA_UI_OK '+width+'x'+height);
  }
  await page.evaluate(()=>{
    db.reminders=[{id:'LEMBRETE-FICTICIO-MANUAL',title:'LEMBRETE MANUAL FICTÍCIO',date:today(),time:'23:00',status:'pending'},
      {id:'LEMBRETE-FICTICIO-ANTERIOR',title:'LEMBRETE ANTERIOR FICTÍCIO',date:today(),time:'23:00',status:'pending',source:'assistant-confirmed'}];
    go('routine');
  });
  assert.match(await page.locator('body').innerText(),/LEMBRETE MANUAL FICTÍCIO/);
  assert.match(await page.locator('body').innerText(),/LEMBRETE ANTERIOR FICTÍCIO/);
  await page.evaluate(()=>routineComplete('LEMBRETE-FICTICIO-ANTERIOR'));
  assert.equal(await page.evaluate(()=>db.reminders.find(r=>r.id==='LEMBRETE-FICTICIO-ANTERIOR').status),'done');
  await page.evaluate(()=>{go('team');showEmployeePerformance()});
  await page.waitForSelector('.employee-performance');
  await noAssistant();
  assert.deepEqual(assistantRequests,[],'nenhum script ou endpoint IA chamado');
  assert.deepEqual(errors,[]);
  console.log('ASSISTANT_REMOVAL_UI_OK: atual; desktop/paisagem/retrato; módulos e lembretes preservados; zero IA; zero erros');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
