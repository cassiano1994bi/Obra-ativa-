// Current index only; synthetic fixture, in-memory storage, zero external network.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startPreview} from './helpers/premium-workspace-preview.mjs';
const {chromium}=createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const {server,origin}=await startPreview();
const browser=await chromium.launch({headless:true,channel:'chrome'});
const outside=[],errors=[];
try {
  for(const [width,height] of [[1440,900],[844,390],[390,844]]) {
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height}});
    await context.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();outside.push(r.request().url());return r.abort()});
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
    await page.addInitScript(()=>{window.fixturePrintCalls=0;window.print=()=>window.fixturePrintCalls++});
    const load=async mode=>{
      await page.goto(origin+'/tests/premium-workspace-preview.html?app=1&billingtest='+mode);
      await page.waitForFunction(mode=>window.ObraAtivaBilling?.access?.mode===mode,mode);
    };
    await load('expired');
    await page.click('[data-billing-action="close"]');
    const before=await page.evaluate(()=>{
      const cycle=selectedPaymentCycle();db.employees[0].group=paymentPeriod(cycle).group;
      const employee=payroll(cycle)[0].e;
      db.payments.push({id:'ESTORNO-FICTICIO-REGRESSAO',employeeId:employee.id,date:today(),cycle,value:9000,method:'TESTE FICTICIO'});
      go('payments');return JSON.stringify(db);
    });
    await page.locator('button[onclick^="reverseLatestPayment"]').first().click();
    assert.equal(await page.evaluate(()=>JSON.stringify(db)),before,'expired click cannot mutate data');
    const direct=await page.evaluate(()=>{
      const p=db.payments.find(p=>p.id==='ESTORNO-FICTICIO-REGRESSAO');
      try{reverseLatestPayment(p.employeeId);return null}catch(e){return e.code}
    });
    assert.equal(direct,'OB069','direct invocation also guards before mutation');
    assert.equal(await page.evaluate(()=>JSON.stringify(db)),before);
    await page.evaluate(async()=>{billingFixtureMode='active';await ObraAtivaBilling.refresh()});
    assert.match(await page.locator('#oaBillingDialog h2').innerText(),/Assinatura ativa/);
    assert.equal(await page.locator('#oaBillingDialog [data-billing-action="checkout"]').count(),0);
    assert.equal(await page.locator('#oaBillingDialog a[href="https://www.mercadopago.com.br/subscriptions"]').count(),1);
    await page.evaluate(()=>{document.getElementById('oaBillingDialog').close();save('TESTE FICTICIO','Storage em memoria, sem nuvem')});
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('controleObraV1')).payments.some(p=>p.id==='ESTORNO-FICTICIO-REGRESSAO')),true);

    for(const mode of ['expired','trial']) {
      await load(mode);
      await page.evaluate(()=>{document.getElementById('oaBillingDialog')?.close();go('reports')});
      const initial=await page.evaluate(()=>({data:JSON.stringify(db),prints:fixturePrintCalls}));
      await page.locator('#view button[onclick="printGlobalReport()"]:visible').click();
      assert.equal(await page.evaluate(()=>fixturePrintCalls),initial.prints+1);
      if(mode==='expired')assert.equal(await page.evaluate(()=>JSON.stringify(db)),initial.data);
      const legacy=await page.evaluate(()=>{try{printReport();return null}catch(e){return e.code}});
      assert.equal(legacy,null);
      assert.equal(await page.evaluate(()=>fixturePrintCalls),initial.prints+2);
      if(mode==='expired')assert.equal(await page.evaluate(()=>JSON.stringify(db)),initial.data);
    }
    // Expiry during a pending action must not replace its busy button.
    await load('trial');
    await page.evaluate(()=>{ObraAtivaBilling.open();window.fetch=()=>new Promise((resolve,reject)=>{window.fixtureResolve=resolve;window.fixtureReject=reject})});
    await page.locator('#oaBillingDialog [data-billing-action="checkout"]').click();
    const busy=await page.locator('#oaBillingDialog [data-billing-action="checkout"]').elementHandle();
    await page.evaluate(async()=>{billingFixtureMode='expired';await ObraAtivaBilling.refresh()});
    assert.equal(await busy.evaluate(el=>el.isConnected&&el.disabled&&el.getAttribute('aria-busy')==='true'),true);
    await page.evaluate(()=>fixtureReject(Error('FALHA TEMPORARIA FICTICIA')));
    await page.waitForFunction(()=>document.querySelector('#oaBillingDialog [data-billing-action="checkout"]')?.disabled===false);
    assert.match(await page.locator('#oaBillingDialog h2').innerText(),/Seu teste terminou/);
    // Refresh preserves focused action, and a confirmation removes stale expiry.
    await page.locator('#oaBillingDialog [data-billing-action="refresh"]').focus();
    await page.evaluate(async()=>{billingFixtureMode='active';await ObraAtivaBilling.refresh()});
    assert.match(await page.locator('#oaBillingDialog h2').innerText(),/Assinatura ativa/);
    assert.equal(await page.evaluate(()=>document.activeElement?.dataset.billingAction),'refresh');

    // A late error from fictitious account A must not show up on account B.
    await load('trial');
    await page.evaluate(()=>{ObraAtivaBilling.open();window.fetch=()=>new Promise((resolve,reject)=>{window.fixtureReject=reject})});
    await page.locator('#oaBillingDialog [data-billing-action="checkout"]').click();
    await page.evaluate(async()=>{
      CloudSync.session.user.id='USUARIO-FICTICIO-B';CompanyWorkspace.current.id='EMPRESA-FICTICIA-B';
      billingFixtureMode='active';await ObraAtivaBilling.refresh();fixtureReject(Error('ERRO ANTIGO FICTICIO DA CONTA A'));
    });
    await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"][data-billing-action]'));
    assert.equal(await page.locator('#oaBillingDialog[open]').count(),0);
    await page.evaluate(()=>ObraAtivaBilling.open());
    assert.doesNotMatch(await page.locator('#oaBillingDialog').innerText(),/ERRO ANTIGO/);
    assert.equal(await page.evaluate(()=>ObraAtivaBilling.canWrite()),true);
    console.log('BILLING_CLIENT_REGRESSION_OK '+width+'x'+height+'; estorno, consulta/PDF, modal, busy, foco e identidade');
    await context.close();
  }
  assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);
  console.log('ZERO_EXTERNAL_NETWORK; ZERO_REAL_ACCOUNTS; ZERO_REAL_PAYMENTS');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve))}
