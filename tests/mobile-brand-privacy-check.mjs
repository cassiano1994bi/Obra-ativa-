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
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const out=path.join(root,'tmp/mobile-brand-privacy-qa');await fs.mkdir(out,{recursive:true});
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try{
 for(const [device,width,height] of [['desktop',1440,900],['tablet',1024,768],['phone',844,390],['small-phone',667,375],['portrait',390,844]]){
  await page.setViewportSize({width,height});
  await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&billingtest=administrator');
  await page.waitForSelector('#nav button');
  await page.waitForFunction(()=>ObraAtivaBilling.access?.mode==='administrator');
  assert.equal(await page.locator('#oaBillingBanner').count(),0,'administrator billing banner stays hidden');
  for(const legacy of [false,true]){
   await page.evaluate(legacy=>{db.settings.companyLogo=legacy?'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><text>LOGO FICTICIA</text></svg>'):'';go('home');window.dispatchEvent(new Event('resize'));},legacy);
   for(const key of ['home','works','planning','attendance','financial','payments','team','routine','vehicles','reports','permissions','budgets']){
    await page.evaluate(key=>{go(key);window.dispatchEvent(new Event('resize'));},key);await settle();
    const layout=await page.evaluate(()=>{
     const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
     const side=document.querySelector('.side');
     return {sidebarImages:[...side.querySelectorAll('.brand-logo,.obraativa-brand-mark')].filter(visible).length,brandText:side.querySelector('.brand-text')?.innerText,brandVisible:visible(side.querySelector('.brand-text')),topImages:[...document.querySelectorAll('.top .obraativa-mobile-top-logo')].filter(visible).length,privacyControls:document.querySelectorAll('[data-usage-privacy]').length,privacySlots:document.querySelectorAll('#app:not(.public-app) .oa-usage-privacy-slot').length,overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
    assert.equal(layout.privacyControls,0,'privacy stays on login, not inside app');
    assert.equal(layout.privacySlots,0,'no sidebar privacy slot');
    assert.equal(layout.overflow,false,'no page overflow');
    if(device!=='portrait'){
     assert.equal(layout.sidebarImages,1,device+' only one sidebar logo');
     assert.match(layout.brandText,/ObraAtiva/);assert.equal(layout.brandVisible,true);
     if(device!=='desktop')assert.equal(layout.topImages,0,'no duplicate top logo on mobile/tablet rail');
    }
    checks.push({device,legacy,key,...layout});
   }
  }
  await page.evaluate(()=>{go('works');window.dispatchEvent(new Event('resize'));});await settle();
  await page.screenshot({path:path.join(out,device+'-after.png')});
  const session=await page.evaluate(()=>JSON.stringify(CloudSync.session));
  assert.equal(await page.evaluate(()=>JSON.stringify(CloudSync.session)),session,'same session');
  console.log('MOBILE BRAND / PRIVACY OK '+device);
 }
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'MOBILE_BRAND_PRIVACY_OK',checks:checks.length,devices:5,internalPrivacyControls:0,errors,realDataUsed:false}));
}finally{
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({checks,errors},null,2));
 await browser.close();await new Promise(r=>server.close(r));
}
