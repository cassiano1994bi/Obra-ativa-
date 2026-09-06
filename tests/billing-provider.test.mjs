import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createBilling, signatureValid, checkoutURL } from '../netlify/functions/_billing/core.mjs';
import { createHandler as checkout } from '../netlify/functions/billing-checkout.mjs';
import { createHandler as webhook } from '../netlify/functions/billing-webhook.mjs';
import { createHandler as cancel } from '../netlify/functions/billing-cancel.mjs';
import { createHandler as reconcile } from '../netlify/functions/billing-reconcile.mjs';
const owner='81000000-0000-4000-8000-000000000001', attemptId='82000000-0000-4000-8000-000000000001';
const instant='2031-01-01T12:00:00Z';
const env={SUPABASE_URL:'https://database-test.invalid',SUPABASE_ANON_KEY:'ANON_FICTICIO',SUPABASE_SERVICE_ROLE_KEY:'SERVICE_FICTICIO',MERCADOPAGO_ACCESS_TOKEN:'TOKEN_FICTICIO',MERCADOPAGO_WEBHOOK_SECRET:'SEGREDO-FICTICIO-DE-TESTE',MERCADOPAGO_COLLECTOR_ID:'900000000',BILLING_APP_URL:'https://app-test.invalid',BILLING_RECONCILIATION_ENABLED:'true'};
function fixture() {
  const state={calls:[], applied:[], attempts:[], timeout:false, canManage:true, enabled:true, provider:{id:'TEST_SUB',collector_id:900000000,external_reference:attemptId,status:'pending',last_modified:instant,init_point:'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=TEST_SUB',auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:69,currency_id:'BRL'}},payment:{id:90000001,collector_id:900000000,transaction_amount:69,currency_id:'BRL',status:'approved',date_approved:instant,date_last_updated:instant},invoice:{id:90000002,preapproval_id:'TEST_SUB',currency_id:'BRL',transaction_amount:69,debit_date:instant,payment:{id:90000001}}};
  const response=v=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}});
  async function fetchImpl(raw, opts={}) {
    const url=new URL(raw),body=opts.body?JSON.parse(opts.body):null;
    state.calls.push({url:raw,method:opts.method||'GET',body,headers:opts.headers});
    if(url.host==='database-test.invalid') {
      if(url.pathname==='/auth/v1/user') return response({id:owner,email:'DONO-FICTICIO@example.invalid',email_confirmed_at:instant});
      if(url.pathname.endsWith('/rpc/billing_access'))return response({enabled:state.enabled,can_write:true,can_manage:state.canManage,owner_user_id:owner,mode:'trial',trial_ends_at:state.trialEndsAt||'2031-01-31T12:00:00Z'});
      if(url.pathname.endsWith('/rpc/billing_claim_checkout')){const created=!state.attempts.length;if(created)state.attempts.push({id:attemptId,owner_user_id:owner,status:'creating'});return response({...state.attempts[0],created});}
      if(url.pathname.endsWith('/rpc/billing_apply_provider')){state.applied.push(body);const a=state.attempts[0];a.provider_id=body.p_provider_id;a.status=body.p_status;return response(true);}
      if(url.pathname.endsWith('/rpc/billing_claim_sync'))return response(true);
      if(url.pathname.endsWith('/billing_control'))return response([{enabled:state.enabled}]);
      if(url.pathname.endsWith('/billing_attempts')){if(opts.method==='PATCH'){Object.assign(state.attempts[0],body);return response(null);}return response(state.attempts);}
    }
    if(url.host==='api.mercadopago.com') {
      if(url.pathname==='/preapproval'&&opts.method==='POST'){
        if(state.timeout)throw Error('TIMEOUT FICTÍCIO');
        if(state.providerRoundsStart)state.provider.auto_recurring.start_date=new Date(Math.floor(Date.parse(body.auto_recurring.start_date)/1000)*1000).toISOString();
        return response(state.provider);
      }
      if(url.pathname==='/preapproval/search')return response({results:state.timeout?[]:[state.provider]});
      if(url.pathname==='/preapproval/TEST_SUB'){if(opts.method==='PUT')state.provider={...state.provider,status:body.status,last_modified:'2031-01-01T12:01:00Z'};return response(state.provider);}
      if(url.pathname==='/authorized_payments/search')return response({results:[state.invoice],paging:{total:1}});
      if(url.pathname==='/authorized_payments/90000002')return response(state.invoice);
      if(url.pathname==='/v1/payments/90000001')return response(state.payment);
    }
    throw Error(`ROTA NÃO MOCKADA — REDE PROIBIDA ${url.pathname}`);
  }
  state.provider.auto_recurring.start_date='2031-01-31T12:00:00Z';
  return {state,deps:{env,fetchImpl,now:()=>Date.parse(instant)}};
}
function request(body={},url='https://app-test.invalid/.netlify/functions/billing-checkout') {
  return new Request(url,{method:'POST',headers:{authorization:'Bearer TOKEN_FICTICIO','content-type':'application/json'},body:JSON.stringify(body)});
}
function signed(type='subscription_authorized_payment',id='90000002',signature=true) {
  const ts='1925035200', requestId='TEST-REQUEST';
  const v1=createHmac('sha256',env.MERCADOPAGO_WEBHOOK_SECRET).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
  return new Request(`https://app-test.invalid/.netlify/functions/billing-webhook?data.id=${id}`,{method:'POST',headers:{'x-request-id':requestId,'x-signature':`ts=${ts},v1=${signature?v1:'a'.repeat(64)}`},body:JSON.stringify({type,data:{id},status:'approved',amount:999999,ownerId:'IGNORAR PAYLOAD FICTÍCIO'})});
}
test('assinatura oficial exige HMAC correto, request-id e data.id; link externo não é aceito',()=>{
  assert.equal(signatureValid(signed(),env.MERCADOPAGO_WEBHOOK_SECRET,'90000002'),true);
  assert.equal(signatureValid(signed(undefined,undefined,false),env.MERCADOPAGO_WEBHOOK_SECRET,'90000002'),false);
  assert.equal(signatureValid(signed(),env.MERCADOPAGO_WEBHOOK_SECRET,'90000003'),false);
  assert.throws(()=>checkoutURL('https://mercadopago.com.br.evil.invalid/subscriptions/checkout'));
  assert.throws(()=>checkoutURL('javascript:alert(1)'));
});
test('checkout exige login, responsável, autorização expressa e plano definido no servidor',async()=>{
  const f=fixture(),handle=checkout(f.deps);
  assert.equal((await handle(new Request('https://app-test.invalid',{method:'POST'}))).status,401);
  assert.equal((await handle(request({}))).status,400);
  assert.equal((await handle(request({acceptRecurring:true,amount:1}))).status,400);
  f.state.canManage=false;assert.equal((await handle(request({acceptRecurring:true}))).status,403);
  assert.equal(f.state.calls.filter(x=>x.url.endsWith('/preapproval')&&x.method==='POST').length,0);
});
test('30 dias sem cobrar; clique repetido reutiliza reserva e não duplica recorrência',async()=>{
  const f=fixture(),handle=checkout(f.deps);
  const first=await handle(request({acceptRecurring:true}));assert.equal(first.status,200);
  const second=await handle(request({acceptRecurring:true}));assert.equal(second.status,200);
  assert.equal((await second.json()).reused,true);
  const writes=f.state.calls.filter(x=>x.url.endsWith('/preapproval')&&x.method==='POST');
  assert.equal(writes.length,1);assert.equal(writes[0].body.auto_recurring.transaction_amount,69);
  assert.equal(writes[0].body.auto_recurring.start_date,'2031-01-31T12:00:00.000Z');
  assert.equal(writes[0].body.status,'pending');assert.equal(f.state.applied[0].p_payment,null);
});
test('precisão de segundos do provedor nunca encurta os 30 dias nem impede checkout válido',async()=>{
  const f=fixture();f.state.trialEndsAt='2031-01-31T12:00:00.620Z';f.state.providerRoundsStart=true;
  const handle=checkout(f.deps);
  assert.equal((await handle(request({acceptRecurring:true}))).status,200);
  const write=f.state.calls.find(c=>c.url.endsWith('/preapproval')&&c.method==='POST');
  assert.equal(write.body.auto_recurring.start_date,'2031-01-31T12:00:01.000Z');
  assert.ok(Date.parse(f.state.provider.auto_recurring.start_date)>=Date.parse(f.state.trialEndsAt));
  assert.equal((await handle(request({acceptRecurring:true}))).status,200);
  assert.equal(f.state.calls.filter(c=>c.url.endsWith('/preapproval')&&c.method==='POST').length,1);
});

test('data de cobrança antecipada continua bloqueada mesmo por fração de segundo',async()=>{
  const f=fixture();f.state.trialEndsAt='2031-01-31T12:00:00.620Z';
  const response=await checkout(f.deps)(request({acceptRecurring:true}));
  assert.equal(response.status,502);assert.equal((await response.json()).code,'trial_start_not_confirmed');
});

test('timeout ambíguo não repete POST; consulta a tentativa anterior primeiro',async()=>{
  const f=fixture();f.state.timeout=true;const handle=checkout(f.deps);
  assert.equal((await handle(request({acceptRecurring:true}))).status,503);
  assert.equal((await handle(request({acceptRecurring:true}))).status,409);
  assert.equal(f.state.calls.filter(x=>x.url.endsWith('/preapproval')&&x.method==='POST').length,1);
});
test('não encaminha ao checkout se o provedor não confirmar a data posterior ao teste',async()=>{
  const f=fixture();delete f.state.provider.auto_recurring.start_date;
  const response=await checkout(f.deps)(request({acceptRecurring:true}));
  assert.equal(response.status,502);const body=await response.json();assert.equal(body.code,'trial_start_not_confirmed');assert.equal(body.url,undefined);
});
test('webhook inválido não acessa rede nem banco; aprovado exige consulta canônica',async()=>{
  const f=fixture(),handle=webhook(f.deps);
  assert.equal((await handle(signed(undefined,undefined,false))).status,401);assert.equal(f.state.calls.length,0);
  f.state.attempts.push({id:attemptId,owner_user_id:owner,provider_id:'TEST_SUB'});
  assert.equal((await handle(signed())).status,200);
  assert.equal(f.state.applied[0].p_payment.id,'90000001');assert.equal(f.state.applied[0].p_payment.amount,69);
  assert.equal(f.state.applied[0].p_payment.status,'approved');
  assert.ok(f.state.calls.some(c=>c.url.endsWith('/v1/payments/90000001')));
});
test('valor, moeda, recebedor ou vínculo divergente nunca liberam acesso',async()=>{
  for(const field of ['transaction_amount','currency_id','collector_id']){
    const f=fixture();f.state.attempts.push({id:attemptId,owner_user_id:owner,provider_id:'TEST_SUB'});
    f.state.payment[field]=field==='currency_id'?'USD':1;
    assert.equal((await webhook(f.deps)(signed())).status,502);assert.equal(f.state.applied.length,0);
  }
});
test('autorização da recorrência não equivale a pagamento; reembolso não mantém acesso pago',async()=>{
  const f=fixture();f.state.attempts.push({id:attemptId,owner_user_id:owner,provider_id:'TEST_SUB'});
  f.state.provider.status='authorized';
  assert.equal((await webhook(f.deps)(signed('subscription_preapproval','TEST_SUB'))).status,200);
  assert.equal(f.state.applied[0].p_payment,null);
  f.state.payment.transaction_amount_refunded=1;
  await webhook(f.deps)(signed());assert.equal(f.state.applied[1].p_payment.status,'refunded');
});
test('cancelamento exige confirmação e não envia DELETE nem altera dados operacionais',async()=>{
  const f=fixture();f.state.attempts.push({id:attemptId,owner_user_id:owner,provider_id:'TEST_SUB'});f.state.provider.status='authorized';
  const handle=cancel(f.deps);assert.equal((await handle(request({}))).status,400);
  assert.equal((await handle(request({confirm:true}))).status,200);
  assert.equal(f.state.applied.at(-1).p_status,'cancelled');
  assert.ok(f.state.calls.every(c=>c.method!=='DELETE'&&!/company_app_state|app_state\?/.test(c.url)));
});
test('reconciliação usa o mesmo verificador; não roda antes da ativação',async()=>{
  const f=fixture();f.state.enabled=false;await reconcile(f.deps)();assert.equal(f.state.calls.length,1);
  f.state.enabled=true;f.state.attempts.push({id:attemptId,owner_user_id:owner,provider_id:'TEST_SUB'});
  await reconcile(f.deps)();assert.equal(f.state.applied.at(-1).p_payment.status,'approved');
});
test('segredos ausentes falham fechados, sem ecoar valores ou conectar',async()=>{
  const f=fixture();let called=false;
  const handle=checkout({env:{},fetchImpl:async()=>{called=true;throw Error()}});
  const res=await handle(request({acceptRecurring:true}));assert.equal(res.status,503);assert.equal(called,false);
  assert.doesNotMatch(await res.text(),/TOKEN_FICTICIO|SERVICE_FICTICIO/);
});
