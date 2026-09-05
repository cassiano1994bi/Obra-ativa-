import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'));
const server=http.createServer(async(req,res)=>{try{const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!target.startsWith(root+path.sep))throw Error('path');const body=await fs.readFile(target);res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html');res.end(body)}catch{res.statusCode=404;res.end('Not found')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
try{
await page.goto(origin+'/tests/work-control-harness.html');await page.waitForFunction(()=>document.documentElement.dataset.ready==='1');
assert.deepEqual(errors,[]);
const costs=await page.evaluate(()=>ObraAtivaWorkControl.model('OBRA-TESTE').finance);
assert.equal(costs.labor,11.5);assert.equal(costs.received.total,113);assert.equal(costs.costs.total,42.5);
assert.equal(costs.phaseCosts[1].personDays,.5);assert.equal(costs.phaseCosts[1].people,1);
const original=await page.evaluate(()=>JSON.stringify({attendance:db.attendance,payments:db.payments,photos:db.workMedia}));
await page.evaluate(()=>openInternalWorkModal('LEGADO-TESTE'));await page.locator('[name=name]').fill('OBRA FICTÍCIA — Renomeada');await page.locator('#wc-form [type=submit]').click();
assert.equal(await page.evaluate(()=>db.works.find(w=>w.id==='LEGADO-TESTE').control),undefined);
await page.evaluate(()=>openInternalWorkModal('LEGADO-TESTE'));await page.locator('[name=registerBaseline]').check();await page.locator('[name=entry]').selectOption('ongoing');await page.locator('[name=priorCost]').fill('');await page.locator('[name=priorReceived]').fill('0');await page.locator('#wc-form [type=submit]').click();
assert.equal(await page.evaluate(()=>db.works.find(w=>w.id==='LEGADO-TESTE').control.baseline.priorCost),null);
await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));await page.locator('[data-wc-action=progress]').click();await page.locator('[name=phaseId]').selectOption('FASE-TESTE-1');await page.locator('[name=percent]').fill('55');await page.locator('[name=photoAfter]').check();await page.locator('#wc-form [type=submit]').click();
assert.equal(await page.evaluate(()=>db.workUpdates.at(-1).delta),15);assert.equal(await page.evaluate(()=>legacyPhotoUploads),1);
await page.locator('[data-wc-action=progress]').click();await page.locator('[name=phaseId]').selectOption('FASE-TESTE-1');await page.locator('[name=percent]').fill('20');await page.locator('#wc-form [type=submit]').click();assert.match(await page.locator('#wc-message').textContent(),/corrigir/);await page.locator('[data-wc-action=close]').click();
await page.locator('nav [data-section=phases]').click();await page.locator('[data-wc-action=photos]').first().click();assert.equal(await page.evaluate(()=>legacyPhotos),1);
await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));await page.locator('nav [data-section=phases]').click();await page.locator('[data-wc-action=phase]').first().click();await page.locator('[name=name]').fill('ETAPA FICTÍCIA NOVA');await page.locator('#wc-form [type=submit]').click();assert.equal(await page.evaluate(()=>db.workPhases.length),7);
await page.evaluate(()=>go('planning'));await page.locator('[data-plan-employee="PESSOA-TESTE-B"]').check();await page.locator('[data-wc-plan-person="PESSOA-TESTE-B"]').selectOption('FASE-TESTE-2');await page.getByText('Salvar distribuição',{exact:true}).click();assert.equal(await page.evaluate(()=>db.distributions.find(d=>d.employeeId==='PESSOA-TESTE-B').phaseId),'FASE-TESTE-2');
assert.equal(await page.evaluate(()=>JSON.stringify({attendance:db.attendance,payments:db.payments,photos:db.workMedia})),original);
await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));await page.locator('nav [data-section=finance]').click();await page.locator('[data-wc-action=expense-link]').click();await page.locator('[name=phaseId]').selectOption('FASE-TESTE-1');await page.locator('#wc-form [type=submit]').click();assert.equal(await page.evaluate(()=>db.otherExpenses.length),1);assert.equal(await page.evaluate(()=>ObraAtivaWorkControl.model('OBRA-TESTE').finance.costs.total),42.5);
await page.evaluate(()=>{CompanyWorkspace.current.role='viewer';AccessControl.isReadOnly=()=>true;render()});assert.equal(await page.locator('[data-wc-action=progress]').count(),0);
await page.evaluate(()=>{CompanyWorkspace.current.role='supervisor';AccessControl.isReadOnly=()=>false;AccessControl.allowedModules=()=>['works','planning'];render()});assert.equal(await page.locator('[data-section=finance]').count(),0);assert.equal(await page.evaluate(()=>ObraAtivaWorkControl.model('OBRA-TESTE').finance),null);
await page.evaluate(()=>{CompanyWorkspace.current.role='owner';openWorkTracker('OBRA-TESTE')});
await fs.mkdir(path.join(root,'tmp/work-control-qa'),{recursive:true});
for(const [label,width,height] of [['desktop',1440,900],['tablet',1024,768],['phone-horizontal',844,390],['phone-small',667,375],['portrait',390,844]]){
 await page.setViewportSize({width,height});
 for(const section of ['panel','phases','finance','operation','history']){
  await page.locator(`nav [data-section=${section}]`).click();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,`${label}/${section}: overflow`);
  if(section==='phases'||section==='panel')await page.screenshot({path:path.join(root,`tmp/work-control-qa/${label}-${section}.png`),fullPage:true});
 }
 await page.evaluate(()=>openInternalWorkModal());
 assert.equal(await page.evaluate(()=>document.querySelector('#dialog').scrollWidth>document.querySelector('#dialog').clientWidth+1),false,`${label}: modal overflow`);
 await page.locator('[data-wc-action=close]').click();
}
assert.deepEqual(errors,[]);console.log('WORK_CONTROL_UI_OK: cadastro, marco, fases, progresso, foto delegada, escala, despesas, permissões e 25 telas responsivas.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
