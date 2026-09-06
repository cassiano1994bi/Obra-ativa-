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
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const out=path.join(root,'tmp/billing-qa');await fs.mkdir(out,{recursive:true});
try {
  for(const [device,width,height] of [['desktop',1440,900],['tablet',1024,768],['phone',844,390],['portrait',390,844]]) {
    await page.setViewportSize({width,height});
    await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&billingtest=expired');
    await page.waitForSelector('#oaBillingDialog[open]');
    assert.equal(await page.evaluate(()=>ObraAtivaBilling.canWrite()),false);
    const sizes=await page.locator('#oaBillingDialog').evaluate(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height,scroll:el.scrollWidth,client:el.clientWidth}));
    assert.ok(sizes.w<=width&&sizes.h<=height,device+' dialog viewport');assert.ok(sizes.scroll<=sizes.client+1,device+' no dialog overflow');
    const payButton=await page.locator('[data-billing-action="checkout"]').boundingBox();
    assert.ok(payButton.y+payButton.height<=height,device+' subscribe action visible on opening');
    await page.screenshot({path:path.join(out,`${device}-expired.png`)});
    await page.click('[data-billing-action="close"]');
    const before=await page.evaluate(()=>JSON.stringify(db));
    const error=await page.evaluate(()=>{try{deleteWork('LEGADO-TESTE');return null}catch(e){return e.code}});
    assert.equal(error,'OB069');assert.equal(await page.evaluate(()=>JSON.stringify(db)),before);
    await page.click('[data-billing-action="close"]');
    for(const module of ['home','works','planning','attendance','payments','financial','team','reports']){
      await page.evaluate(module=>go(module),module);assert.ok((await page.locator('#view').innerText()).length>10,module+' still readable');
    }
    await page.evaluate(()=>openPermissionHub('billing'));await page.waitForSelector('#oaBillingAdmin tbody tr');
    await page.waitForFunction(()=>document.querySelector('#oaBillingAdmin')?.textContent.includes('CONTA FICTÍCIA'));
    await page.screenshot({path:path.join(out,`${device}-admin.png`)});
    await page.evaluate(async()=>{window.billingFixtureMode='active';await ObraAtivaBilling.refresh()});
    assert.equal(await page.evaluate(()=>ObraAtivaBilling.canWrite()),true);
    await page.evaluate(()=>{go('home');ObraAtivaBilling.open()});
    await page.screenshot({path:path.join(out,`${device}-active.png`)});
  }
  await page.setViewportSize({width:844,height:390});
  await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&billingtest=trial');
  await page.waitForFunction(()=>ObraAtivaBilling.access?.mode==='trial');
  await page.evaluate(()=>ObraAtivaBilling.open());
  await page.click('[data-billing-action="checkout"]');
  assert.match(await page.locator('.oa-billing-message').innerText(),/Marque a autorização/);
  await page.check('[data-billing-consent]');await page.click('[data-billing-action="checkout"]');
  await page.waitForFunction(()=>document.querySelector('.oa-billing-message')?.textContent.includes('PRÉVIA FICTÍCIA'));
  assert.equal(new URL(page.url()).origin,origin,'no actual checkout');
  const guarded=await page.evaluate(()=>Object.keys(window).filter(k=>typeof window[k]==='function'&&window[k].__billingGuard));
  console.log(JSON.stringify({guarded}));
  await page.evaluate(async()=>{CloudSync.request=async()=>{throw Error('OFFLINE FICTÍCIO')};await ObraAtivaBilling.refresh();CloudSync.ready=false});
  assert.equal(await page.evaluate(()=>ObraAtivaBilling.canWrite()),false,'known subscription stays read-only when connectivity is lost');
  await page.goto(origin+'/tests/billing-subscriptions-review.html');
  const preview=page.frameLocator('#preview');
  await preview.locator('#oaBillingBanner').waitFor();
  await page.selectOption('#mode','expired');await preview.locator('#oaBillingDialog[open]').waitFor();
  await page.screenshot({path:path.join(out,'review.png')});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'BILLING_VISUAL_OK',devices:4,modules:8,errors,output:out}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
