// Integrated LOCAL test: production handlers + actual SQL migration + app UI.
// Mercado Pago responses and authenticated identities are synthetic fixtures.
// No Supabase/MP network calls, keys, real account data or remote migrations.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHmac} from 'node:crypto';
import {createHandler as webhook} from '../netlify/functions/billing-webhook.mjs';
import {createHandler as cancel} from '../netlify/functions/billing-cancel.mjs';
import {createHandler as reconcile} from '../netlify/functions/billing-reconcile.mjs';
import {createHandler as statusHandler} from '../netlify/functions/billing-status.mjs';
import {startPreview,root} from './helpers/premium-workspace-preview.mjs';

const {PGlite}=createRequire(new URL('../tmp/owner-qa-runtime/package.json',import.meta.url))('@electric-sql/pglite');
const {chromium}=createRequire('C:/Users/claud/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const owner='a1000000-0000-4000-8000-000000000001', other='a1000000-0000-4000-8000-000000000002';
const company='a2000000-0000-4000-8000-000000000001', companyOther='a2000000-0000-4000-8000-000000000002';
const env={SUPABASE_URL:'https://billing-database-test.invalid',SUPABASE_ANON_KEY:'ANON-FICTICIO',SUPABASE_SERVICE_ROLE_KEY:'SERVICE-FICTICIO',MERCADOPAGO_ACCESS_TOKEN:'PROVIDER-FICTICIO',MERCADOPAGO_COLLECTOR_ID:'980000001',MERCADOPAGO_WEBHOOK_SECRET:'HMAC-SOMENTE-FICTICIO',BILLING_APP_URL:'https://billing-app-test.invalid',BILLING_RECONCILIATION_ENABLED:'true'};
const day=86400000,base=Date.now(),at=delta=>new Date(base+delta).toISOString();
const database=new PGlite(), q=async(sql,params)=>(await database.query(sql,params)).rows;
const value=async(sql,params)=>Object.values((await q(sql,params))[0])[0];
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const scenarios=[],errors=[],calls=[],outsideRequests=[];
let browser,server,page,attempt,provider,offline=false;
const invoices=new Map(),payments=new Map();
async function roleQuery(role,uid,sql,params=[]) {
  assert.ok(['authenticated','service_role'].includes(role));
  return database.transaction(async tx=>{
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('test.uid',$1,true)",[uid||'']);
    return (await tx.query(sql,params)).rows;
  });
}
async function rpc(name,body,authenticated=false) {
  const queries={
    billing_access:['select billing_access($1::uuid) as result',[body.p_company_id||null]],
    billing_apply_provider:['select billing_apply_provider($1::uuid,$2,$3,$4::timestamptz,$5,$6::jsonb) as result',[body.p_attempt,body.p_provider_id,body.p_status,body.p_modified,body.p_checkout,body.p_payment==null?null:JSON.stringify(body.p_payment)]],
    billing_claim_sync:['select billing_claim_sync($1::uuid) as result',[body.p_attempt]]
  };
  assert.ok(queries[name],'Only explicitly supported local SQL RPCs');
  const [sql,args]=queries[name];
  return (await roleQuery(authenticated?'authenticated':'service_role',authenticated?owner:null,sql,args))[0].result;
}
async function fixtureFetch(raw,options={}) {
  const url=new URL(raw), method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
  calls.push({host:url.hostname,path:url.pathname,method});
  if(url.origin===env.SUPABASE_URL) {
    const authenticated=options.headers?.authorization==='Bearer SESSION-FICTICIA';
    if(url.pathname==='/auth/v1/user')return authenticated?response({id:owner,email:'integracao-ficticia@example.invalid',email_confirmed_at:at(-day)}):response({},401);
    if(url.pathname.startsWith('/rest/v1/rpc/'))return response(await rpc(url.pathname.split('/').at(-1),body,authenticated));
    assert.equal(authenticated,false,'Private billing tables never accessed with a user token');
    if(url.pathname==='/rest/v1/billing_control')return response(await roleQuery('service_role',null,'select enabled from billing_control where id'));
    if(url.pathname==='/rest/v1/billing_attempts') {
      const id=url.searchParams.get('id')?.replace(/^eq\./,''),account=url.searchParams.get('owner_user_id')?.replace(/^eq\./,'');
      if(method==='PATCH') {
        assert.equal(id,attempt.id);
        const keys=Object.keys(body);assert.ok(keys.every(k=>['invoice_offset','last_error','checked_at','status'].includes(k)));
        const sql=`update billing_attempts set ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} where id=$${keys.length+1}`;
        await roleQuery('service_role',null,sql,[...keys.map(k=>body[k]),id]);return response(null);
      }
      assert.equal(method,'GET');
      return response(await roleQuery('service_role',null,
        id?'select * from billing_attempts where id=$1':account?'select * from billing_attempts where owner_user_id=$1 order by created_at desc limit 1':'select * from billing_attempts order by checked_at asc nulls first,created_at asc limit 4',id?[id]:account?[account]:[]));
    }
  }
  if(url.origin==='https://api.mercadopago.com') {
    if(offline)return response({error:'PROVEDOR FICTÍCIO INDISPONÍVEL'},503);
    assert.equal(options.headers.authorization,'Bearer PROVIDER-FICTICIO');
    if(url.pathname===`/preapproval/${provider.id}`) {
      if(method==='PUT') {assert.deepEqual(body,{status:'cancelled'});provider.status='cancelled';provider.last_modified=at(10000);}
      else assert.equal(method,'GET');
      return response(provider);
    }
    assert.equal(method,'GET','This test never creates payment/subscription, even in fixtures');
    if(url.pathname==='/authorized_payments/search') {
      const items=[...invoices.values()].filter(i=>(!url.searchParams.has('payment_id')||String(i.payment.id)===url.searchParams.get('payment_id'))&&(!url.searchParams.has('preapproval_id')||i.preapproval_id===url.searchParams.get('preapproval_id')));
      const offset=Number(url.searchParams.get('offset'))||0,limit=Number(url.searchParams.get('limit'))||10;
      return response({results:items.slice(offset,offset+limit),paging:{total:items.length}});
    }
    if(url.pathname.startsWith('/authorized_payments/'))return response(invoices.get(url.pathname.split('/').at(-1)));
    if(url.pathname.startsWith('/v1/payments/'))return response(payments.get(url.pathname.split('/').at(-1)));
  }
  throw Error('UNMOCKED NETWORK PROHIBITED: '+url.pathname);
}
const deps={env,fetchImpl:fixtureFetch}, notify=webhook(deps),cancelHandler=cancel(deps),recover=reconcile(deps),status=statusHandler(deps);
function signed(topic,id,valid=true) {
  const ts=String(Math.floor(base/1000)),requestId='LOCAL-FICTICIO';
  const signature=createHmac('sha256',env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
  return new Request(`${env.BILLING_APP_URL}/.netlify/functions/billing-webhook?data.id=${id}`,{method:'POST',headers:{'x-request-id':requestId,'x-signature':`ts=${ts},v1=${valid?signature:'f'.repeat(64)}`},body:JSON.stringify({type:topic,data:{id},status:'approved',can_write:true})});
}
function invoiceFixture(id,status,debit=at(-day),updated=at(0)) {
  invoices.set('INVOICE_'+id,{id:'INVOICE_'+id,preapproval_id:provider.id,currency_id:'BRL',transaction_amount:69,debit_date:debit,payment:{id}});
  payments.set(id,{id,collector_id:980000001,payer:{id:980000002},transaction_amount:69,currency_id:'BRL',status,date_last_updated:updated,date_approved:status==='approved'?at(-1000):null});
}
const access=()=>rpc('billing_access',{p_company_id:company},true);
async function checkScreen(mode,writable) {
  // The production focus listener fetches the current SQL result. No can_write fixture is injected.
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(({mode,writable})=>ObraAtivaBilling.access?.mode===mode&&ObraAtivaBilling.canWrite()===writable,{mode,writable});
  assert.equal((await access()).mode,mode);
  assert.equal((await access()).can_write,writable);
  const guard=await page.evaluate(()=>{try{ObraAtivaBilling.assertWrite();return 'allowed'}catch(e){return e.code}});
  assert.equal(guard,writable?'allowed':'OB069');
  await page.evaluate(()=>document.getElementById('oaBillingDialog')?.close());
  const banner=page.locator('#oaBillingBanner');
  return await banner.count() ? banner.innerText() : '';
}
async function scenario(name,run) {await run();scenarios.push(name);console.log('LOCAL_FLOW_OK: '+name);}
async function connectBillingScreen() {
  await page.evaluate(async({owner,company})=>{
    CloudSync.session.user.id=owner;CloudSync.session.access_token='SESSION-FICTICIA';CompanyWorkspace.current.id=company;CloudSync.isSalesAdmin=false;
    window.returnStatusChecks=0;
    window.fetch=async(url,options)=>{
      if(url!=='/.netlify/functions/billing-status')throw Error('Unlisted TEST HTTP request');
      const result=await window.localBillingStatus({headers:options.headers,body:options.body});window.returnStatusChecks++;
      return new Response(JSON.stringify(result.body),{status:result.status,headers:{'content-type':'application/json'}});
    };
    CloudSync.request=async endpoint=>{
      if(endpoint.endsWith('/billing_access'))return window.localBillingRpc('billing_access');
      throw Error('RPC FICTÍCIA NÃO PERMITIDA');
    };
    await ObraAtivaBilling.refresh();
  },{owner,company});
}
try {
  await database.exec(`create schema auth;create role anon;create role authenticated;create role service_role bypassrls;
    create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;`);
  for(const migration of ['202608250900_core_schema_baseline','202608311000_core_access_contracts_and_rls']) {
    await database.exec((await fs.readFile(path.join(root,`supabase/migrations/${migration}.sql`),'utf8')).replace('create extension if not exists pgcrypto;',''));
  }
  for(const [id,cid,label] of [[owner,company,'PRINCIPAL'],[other,companyOther,'OUTRA']]) {
    await q('insert into auth.users(id,email) values($1,$2)',[id,`conta-${label.toLowerCase()}-ficticia@example.invalid`]);
    await q('insert into companies(id,name,owner_user_id) values($1,$2,$3)',[cid,'EMPRESA FICTÍCIA '+label,id]);
    await q("insert into company_members(company_id,user_id,email,role) values($1,$2,$3,'owner')",[cid,id,`conta-${label.toLowerCase()}-ficticia@example.invalid`]);
    await q('insert into company_app_state(company_id,data) values($1,$2::jsonb)',[cid,JSON.stringify({fixture:'REGISTROS FICTÍCIOS PRESERVADOS '+label})]);
  }
  await database.exec(await fs.readFile(path.join(root,'supabase/migrations/202609052000_mercadopago_billing.sql'),'utf8'));
  await database.exec(await fs.readFile(path.join(root,'supabase/migrations/202609061030_billing_trial_signup_repair.sql'),'utf8'));
  await value('select billing_activate()');
  await q("update billing_accounts set trial_started_at=now()-interval '60 days',trial_ends_at=now()-interval '30 days'");
  attempt=await value('select billing_claim_checkout($1)',[owner]);
  provider={id:'SUBSCRIPTION_FICTICIA_FLOW',external_reference:attempt.id,collector_id:980000001,payer_id:980000002,status:'authorized',last_modified:at(-10000),init_point:'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=FICTICIO',auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:69,currency_id:'BRL'}};
  const dataBefore=await q('select company_id,data from company_app_state order by company_id');
  const started=await startPreview();server=started.server;
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:844,height:390}});
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===started.origin)return route.continue();
    outsideRequests.push(new URL(route.request().url()).hostname);return route.abort();
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('localBillingRpc',async name=>{assert.equal(name,'billing_access');return access()});
  await page.exposeFunction('localBillingStatus',async options=>{
    const result=await status(new Request(env.BILLING_APP_URL+'/.netlify/functions/billing-status',{method:'POST',headers:options.headers,body:options.body}));
    return {status:result.status,body:await result.json()};
  });
  await page.goto(started.origin+'/tests/premium-workspace-preview.html?app=1&billingtest=expired&billing=return&status=approved&collection_status=approved&can_write=true');
  await page.waitForFunction(()=>ObraAtivaBilling.access?.mode==='expired');
  await connectBillingScreen();
  await scenario('vencido: tela consulta e servidor bloqueia escrita',async()=>{
    assert.match(await checkScreen('expired',false),/Teste encerrado/);
    await assert.rejects(q('update company_app_state set data=$1::jsonb where company_id=$2',[JSON.stringify({fixture:'ESCRITA QUE DEVE SER BLOQUEADA'}),company]),e=>e.code==='OB069');
    assert.deepEqual(await q('select company_id,data from company_app_state order by company_id'),dataBefore);
  });
  await scenario('retorno com approved na URL não libera acesso nem troca a conta',async()=>{
    await page.waitForFunction(()=>window.returnStatusChecks===1,null,{timeout:15000});
    await checkScreen('expired',false);
    assert.equal(await page.evaluate(()=>CloudSync.session.user.id),owner);
    assert.equal(await value('select count(*)::int from billing_payments'),0);
  });
  await scenario('HMAC inválido: nenhum acesso à API/banco e nenhuma liberação',async()=>{
    const before=calls.length;assert.equal((await notify(signed('subscription_preapproval',provider.id,false))).status,401);
    assert.equal(calls.length,before);await checkScreen('expired',false);
  });
  await scenario('autorização da recorrência sem parcela paga não libera após vencimento',async()=>{
    assert.equal((await notify(signed('subscription_preapproval',provider.id))).status,200);
    await checkScreen('expired',false);assert.equal(await value('select count(*)::int from billing_payments'),0);
  });
  await scenario('preço divergente e indisponibilidade não concedem acesso',async()=>{
    invoiceFixture('PAYMENT_REJECTED','approved');payments.get('PAYMENT_REJECTED').transaction_amount=1;
    assert.equal((await notify(signed('subscription_authorized_payment','INVOICE_PAYMENT_REJECTED'))).status,502);
    offline=true;assert.equal((await notify(signed('subscription_preapproval',provider.id))).status,503);offline=false;
    assert.equal(await value('select count(*)::int from billing_payments'),0);await checkScreen('expired',false);
  });
  await scenario('recusa: tolerância de 3 dias e fim da tolerância sem apagar dados',async()=>{
    invoiceFixture('PAYMENT_REJECTED','rejected',at(-day));
    assert.equal((await notify(signed('subscription_authorized_payment','INVOICE_PAYMENT_REJECTED'))).status,200);
    assert.match(await checkScreen('grace',true),/tolerância/);
    const grace=(await access()).grace_ends_at;
    await notify(signed('subscription_authorized_payment','INVOICE_PAYMENT_REJECTED'));
    assert.equal((await access()).grace_ends_at,grace);
    // Only the in-memory fixture clock advances: no provider or app record is modified.
    await q("update billing_payments set debit_at=now()-interval '4 days' where provider_payment_id='PAYMENT_REJECTED'");
    await checkScreen('payment_due',false);
  });
  await scenario('retorno com segundo ?: consulta confirma pagamento mesmo sem webhook',async()=>{
    // Exact provider query shape with a clearly artificial ID, deliberately not
    // the stored contract: the authenticated server must ignore the URL's ID.
    await page.goto(started.origin+'/tests/premium-workspace-preview.html?app=1&billingtest=expired&billing=return?preapproval_id='+ 'a'.repeat(32)+'&status=approved&can_write=true');
    await page.waitForFunction(()=>ObraAtivaBilling.access?.mode==='expired');
    await connectBillingScreen();
    await checkScreen('payment_due',false);
    assert.equal(await page.evaluate(()=>window.returnStatusChecks),0);
    const callsBefore=calls.length;
    invoiceFixture('PAYMENT_APPROVED','approved',at(-day));
    await q("update billing_attempts set sync_requested_at=now()-interval '31 seconds' where id=$1",[attempt.id]);
    assert.equal(await value("select count(*)::int from billing_payments where provider_payment_id='PAYMENT_APPROVED'"),0);
    // No notify() call: exercise the real return timer -> status handler -> SQL.
    await page.waitForFunction(()=>window.returnStatusChecks===1,null,{timeout:15000});
    assert.equal(await checkScreen('active',true),'','assinatura ativa longe do vencimento não ocupa o topo');
    assert.ok(calls.slice(callsBefore).some(call=>call.host==='api.mercadopago.com'&&call.path===`/preapproval/${provider.id}`&&call.method==='GET'));
    assert.equal(await value("select count(*)::int from billing_payments where provider_payment_id='PAYMENT_APPROVED' and status='approved'"),1);
    assert.equal(await page.evaluate(()=>CloudSync.session.user.id),owner);
    assert.deepEqual(await q('select company_id,data from company_app_state order by company_id'),dataBefore);
  });
  await scenario('pagamento aprovado: webhook → SQL → interface liberada',async()=>{
    invoiceFixture('PAYMENT_APPROVED','approved',at(-day));
    assert.equal((await notify(signed('subscription_authorized_payment','INVOICE_PAYMENT_APPROVED'))).status,200);
    assert.equal(await checkScreen('active',true),'','assinatura ativa longe do vencimento não ocupa o topo');
    await q('update company_app_state set data=data where company_id=$1',[company]);
    assert.equal((await value('select billing_account_access($1)',[other])).can_write,false);
    assert.deepEqual(await q('select company_id,data from company_app_state order by company_id'),dataBefore);
  });
  await scenario('resposta atrasada da conta paga não libera outra conta ou sessão encerrada',async()=>{
    await page.evaluate(()=>{
      window.holdBillingResult=null;
      CloudSync.request=()=>new Promise(resolve=>{window.holdBillingResult=resolve;});
      window.pendingBillingTest=ObraAtivaBilling.refresh();
    });
    const paidAccess=await access();
    await page.evaluate(({other,companyOther})=>{CloudSync.session.user.id=other;CompanyWorkspace.current.id=companyOther;},{other,companyOther});
    assert.equal(await page.evaluate(()=>ObraAtivaBilling.canWrite()),false);
    await page.evaluate(async value=>{window.holdBillingResult(value);await window.pendingBillingTest;},paidAccess);
    assert.equal(await page.evaluate(()=>ObraAtivaBilling.canWrite()),false);
    assert.equal(await page.evaluate(()=>ObraAtivaBilling.access),null);
    await page.evaluate(async()=>{CloudSync.session=null;await ObraAtivaBilling.refresh();});
    assert.equal(await page.evaluate(()=>ObraAtivaBilling.access),null);
    await page.evaluate(async({owner,company})=>{
      CloudSync.session={access_token:'SESSION-FICTICIA',user:{id:owner,email:'integracao-ficticia@example.invalid'}};CompanyWorkspace.current.id=company;
      CloudSync.request=endpoint=>{if(endpoint.endsWith('/billing_access'))return window.localBillingRpc('billing_access');throw Error('Unlisted TEST RPC');};
      await ObraAtivaBilling.refresh();
    },{owner,company});
    await checkScreen('active',true);
    assert.deepEqual(await q('select company_id,data from company_app_state order by company_id'),dataBefore);
  });
  await scenario('reentrega e evento antigo não duplicam pagamento nem período',async()=>{
    const until=(await access()).paid_until,count=await value('select count(*)::int from billing_events');
    await notify(signed('payment','PAYMENT_APPROVED'));
    assert.equal((await access()).paid_until,until);assert.equal(await value('select count(*)::int from billing_events'),count);
    const original={...payments.get('PAYMENT_APPROVED')};
    Object.assign(payments.get('PAYMENT_APPROVED'),{status:'rejected',date_last_updated:at(-60000)});
    await notify(signed('payment','PAYMENT_APPROVED'));await checkScreen('active',true);
    payments.set('PAYMENT_APPROVED',original);
  });
  await scenario('webhook ausente: conciliação encontra parcela e reativa',async()=>{
    await q("update billing_payments set period_ends_at=now()-interval '1 second' where status='approved'");
    await checkScreen('expired',false);
    invoiceFixture('PAYMENT_RENEWAL','approved',at(0),at(1000));
    // The prior checkout-return test legitimately consumed the persistent 30s
    // sync claim. Advance only this in-memory test row past the cooldown.
    await q("update billing_attempts set sync_requested_at=now()-interval '31 seconds' where id=$1",[attempt.id]);
    await recover();assert.equal(await checkScreen('active',true),'','renovação longe do vencimento não ocupa o topo');
    assert.equal(await value("select count(*)::int from billing_payments where provider_payment_id='PAYMENT_RENEWAL' and status='approved'"),1);
  });
  await scenario('cancelamento mantém período pago; estorno volta à consulta preservando dados',async()=>{
    const request=new Request(env.BILLING_APP_URL+'/.netlify/functions/billing-cancel',{method:'POST',headers:{authorization:'Bearer SESSION-FICTICIA','content-type':'application/json'},body:JSON.stringify({companyId:company,confirm:true})});
    const cancelled=await cancelHandler(request);assert.equal(cancelled.status,200);
    assert.equal(await checkScreen('active',true),'','cancelamento com período ainda distante não ocupa o topo');
    payments.get('PAYMENT_RENEWAL').transaction_amount_refunded=69;payments.get('PAYMENT_RENEWAL').date_last_updated=at(20000);
    assert.equal((await notify(signed('payment','PAYMENT_RENEWAL'))).status,200);
    await checkScreen('cancelled',false);
    await assert.rejects(q('delete from company_app_state where company_id=$1',[company]),e=>e.code==='OB069');
    assert.deepEqual(await q('select company_id,data from company_app_state order by company_id'),dataBefore);
  });
  const out=path.join(root,'tmp/billing-flow-qa');await fs.mkdir(out,{recursive:true});
  await page.evaluate(()=>ObraAtivaBilling.open());await page.screenshot({path:path.join(out,'phone-after-cancellation.png')});
  await page.setViewportSize({width:1440,height:900});await page.screenshot({path:path.join(out,'desktop-after-cancellation.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(outsideRequests,[]);
  console.log(JSON.stringify({result:'BILLING_LOCAL_INTEGRATED_FLOW_OK',scenarios,sql:'actual migration in memory',provider:'synthetic responses; no external network',frontend:'actual billing script and app preview',dataPreserved:true,productionTouched:false,realWebhookDeliveryTested:false,errors}));
} finally {
  await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await database.close();
}
