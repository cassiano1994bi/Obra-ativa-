import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const {chromium}=require('playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const fixture=await fs.readFile(path.join(root,'tests/work-control-harness.html'),'utf8');
const data=fixture.slice(fixture.indexOf('let db='),fixture.indexOf('let persisted=')).replace('let db=','db=');
const server=http.createServer(async(req,res)=>{try{const target=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!target.startsWith(root+path.sep))throw Error('path');res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.png')?'image/png':target.endsWith('.svg')?'image/svg+xml':target.endsWith('.webp')?'image/webp':'text/html');res.end(await fs.readFile(target))}catch{res.statusCode=404;res.end('Not found')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'chrome'});const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await context.addInitScript(()=>{const data=new Map();const memory={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear(),key:i=>[...data.keys()][i]||null,get length(){return data.size}};Object.defineProperty(window,'localStorage',{value:memory});Object.defineProperty(window,'sessionStorage',{value:memory});});
await context.addInitScript(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2031-01-15T12:00:00Z']))}static now(){return NativeDate.parse('2031-01-15T12:00:00Z')}}});
let revision=1,saveCalls=0;
await context.route('**/*',route=>{
 const u=new URL(route.request().url());
 if(u.pathname.startsWith('/rest/v1/company_app_state'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{work_control_revision:revision}])});
 if(u.pathname==='/rest/v1/rpc/save_company_app_state_checked'){saveCalls++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({revision:++revision,updated_at:'2031-01-15T12:00:00Z'})})}
 if(u.pathname==='/rest/v1/rpc/read_work_control_history')return route.fulfill({status:200,contentType:'application/json',body:'[]'});
 if(u.origin===origin&&!u.pathname.startsWith('/.netlify/'))return route.continue();
 return route.abort();
});
try{
 await page.goto(origin+'/index.html?app=1');await page.waitForFunction(()=>!!window.ObraAtivaWorkControl);
 await page.evaluate(async source=>{
   (0,eval)(source);
   CompanyWorkspace.current={id:'EMPRESA-TESTE',name:'EMPRESA FICTÍCIA',role:'owner',permissionProfile:'gerente'};
   CloudSync.session={access_token:'TOKEN-FICTICIO-SEM-VALIDADE',user:{id:'USUARIO-TESTE',email:'teste@example.invalid',user_metadata:{full_name:'GESTOR FICTÍCIO'}}};
   CloudSync.schedule=()=>{};
   CloudSync.showAuth=()=>{};
   await CloudSync.request('/rest/v1/company_app_state?company_id=eq.EMPRESA-TESTE&select=data',{},CloudSync.session.access_token);
   document.querySelectorAll('#cloudGate,#obraAtivaSplash,.cloud-auth-overlay,.cloud-session-retry-overlay').forEach(e=>e.remove());
   document.body.classList.remove('cloud-auth-required','public-mode','auth-mode');
   page='works';renderTop();render();
 },data);
 const loaded=await page.evaluate(()=>({html:document.getElementById('view').innerHTML.slice(0,250),ready:ObraAtivaWorkSync.ready('EMPRESA-TESTE')}));
 assert.equal(loaded.ready,true);
 await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));
 assert.equal(await page.locator('.wc-root h1').textContent(),'OBRA FICTÍCIA — Centro de treinamento');
 await page.locator('nav [data-section=phases]').click();
 await page.locator('[data-wc-action=phase]').first().click();await page.locator('#wc-form [name=name]').fill('ETAPA FICTÍCIA INTEGRADA');await page.locator('#wc-form [type=submit]').click();
 assert.equal(await page.evaluate(()=>db.workPhases.length),7);
 await page.locator('[data-wc-action=photos]').first().click();assert.equal(await page.locator('.work-tracker-gallery').count(),1);
 await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));await page.locator('[data-wc-action=progress]').click();await page.locator('[name=phaseId]').selectOption('FASE-TESTE-1');await page.locator('[name=percent]').fill('51');await page.locator('[name=photoAfter]').check();await page.locator('#wc-form [type=submit]').click();assert.equal(await page.locator('#workPhasePhotoForm').count(),1);await page.locator('[data-phase-photo-cancel]').click();
 await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));await page.locator('[data-wc-action=progress]').click();await page.locator('[name=phaseId]').selectOption('FASE-TESTE-1');await page.locator('[name=percent]').fill('61');await page.locator('#wc-form [type=submit]').click();assert.equal(await page.evaluate(()=>db.workUpdates.at(-1).percent),61);
 await page.evaluate(()=>{planningDate='2031-01-15';planningWorkId='OBRA-TESTE';go('planning')});
 assert.ok(await page.locator('[data-wc-plan-person]').count()>0,'Fase disponível na escala real');
 await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));await page.locator('nav [data-section=phases]').click();
 const deleteId=await page.evaluate(()=>db.workPhases.at(-1).id);const oldPhotos=await page.evaluate(()=>db.workMedia.length);
 page.once('dialog',dialog=>dialog.accept());await page.evaluate(id=>deleteWorkPhase('OBRA-TESTE',id),deleteId);
 assert.equal(await page.evaluate(()=>db.workPhases.length),6);assert.equal(await page.evaluate(()=>db.workMedia.length),oldPhotos);assert.equal(await page.evaluate(()=>db.workUpdates.at(-1).kind),'Fase excluída');
 await page.evaluate(()=>go('works'));await page.locator('[data-collection=history]').click();assert.match(await page.locator('#view').textContent(),/Menor duração registrada/);await page.locator('[data-collection=radar]').click();assert.equal(await page.locator('.wc-radar .wc-card').count(),2);
 for(const [label,width,height] of [['desktop',1440,900],['tablet',1024,768],['phone',844,390],['small',667,375]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>openWorkTracker('OBRA-TESTE'));await page.locator('nav [data-section=phases]').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${label}: overflow no app completo`);
   await page.screenshot({path:path.join(root,`tmp/work-control-qa/full-${label}.png`),fullPage:true});
 }
 assert.deepEqual(errors,[]);console.log('WORK_CONTROL_FULL_APP_OK: fonte completa com todos os módulos, persistência em memória, fases/fotos/progresso/escala e quatro dispositivos; nenhuma conta ou rede real.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
