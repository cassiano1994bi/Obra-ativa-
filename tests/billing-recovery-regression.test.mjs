// Somente handlers locais, dados FICTÍCIOS e respostas simuladas; nunca rede real.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBilling} from '../netlify/functions/_billing/core.mjs';
import {createHandler as checkout} from '../netlify/functions/billing-checkout.mjs';
import {createHandler as status} from '../netlify/functions/billing-status.mjs';
import {createHandler as cancel} from '../netlify/functions/billing-cancel.mjs';
import {createHandler as reconcile} from '../netlify/functions/billing-reconcile.mjs';
globalThis.fetch=async()=>{throw Error('REDE REAL PROIBIDA NO TESTE');};
const owner='f5100000-0000-4000-8000-000000000001';
const instant=Date.parse('2032-02-01T12:00:00Z');
const env={SUPABASE_URL:'https://database-test.invalid',SUPABASE_ANON_KEY:'ANON_FICTICIO',SUPABASE_SERVICE_ROLE_KEY:'SERVICE_FICTICIO',MERCADOPAGO_ACCESS_TOKEN:'TOKEN_FICTICIO',MERCADOPAGO_WEBHOOK_SECRET:'SECRET_FICTICIO',MERCADOPAGO_COLLECTOR_ID:'900000000',BILLING_APP_URL:'https://app-test.invalid',BILLING_RECONCILIATION_ENABLED:'true'};
const request=(body={})=>new Request('https://app-test.invalid/.netlify/functions/TESTE',{method:'POST',headers:{authorization:'Bearer TOKEN_FICTICIO','content-type':'application/json'},body:JSON.stringify(body)});
function fixture(){
  const state={attempts:[],providers:new Map(),calls:[],applied:[],reject:false,timeout:false,searchDuplicates:false,ignoreCancel:false,alterGet:null,dropStart:false,trial:instant+30*86400000,paid:0};
  const response=(v,code=200)=>new Response(JSON.stringify(v),{status:code,headers:{'content-type':'application/json'}});
  function matches(url,a){
    const q=url.searchParams;
    if(q.has('id') && q.get('id')!=='eq.'+a.id)return false;
    if(q.get('provider_id')==='is.null' && a.provider_id)return false;
    if(q.get('or') && !(a.provider_id || a.status!=='cancelled'))return false;
    if(q.get('status')==='in.(creating,uncertain)' && !['creating','uncertain'].includes(a.status))return false;
    return true;
  }
  const addAttempt=(status='creating')=>{
    const a={id:'f5200000-0000-4000-8000-'+String(state.attempts.length+1).padStart(12,'0'),owner_user_id:owner,status,provider_id:null};
    state.attempts.push(a);return a;
  };
  const addProvider=(a,overrides={})=>{
    const s={id:'TEST_SUB_'+state.providers.size,collector_id:900000000,external_reference:a.id,status:'authorized',last_modified:new Date(instant).toISOString(),auto_recurring:{transaction_amount:69,currency_id:'BRL',frequency:1,frequency_type:'months'},...overrides};
    s.init_point='https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id='+s.id;
    a.provider_id=s.id;a.status=s.status;state.providers.set(s.id,s);return s;
  };
  async function fetchImpl(raw,options={}){
    const url=new URL(raw),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
    state.calls.push({path:url.pathname,query:url.search,method,body,headers:options.headers});
    if(url.host==='database-test.invalid'){
      if(url.pathname==='/auth/v1/user')return response({id:owner,email:'DONO-FICTICIO@example.invalid',email_confirmed_at:'2032-01-01T00:00:00Z'});
      if(url.pathname.endsWith('/rpc/billing_access'))return response({enabled:true,can_write:true,can_manage:true,owner_user_id:owner,mode:'trial',trial_ends_at:new Date(state.trial).toISOString(),paid_until:state.paid?new Date(state.paid).toISOString():null});
      if(url.pathname.endsWith('/rpc/billing_claim_checkout')){let a=state.attempts.find(a=>a.status!=='cancelled');const created=!a;if(!a)a=addAttempt();return response({...a,created});}
      if(url.pathname.endsWith('/rpc/billing_claim_sync'))return response(true);
      if(url.pathname.endsWith('/rpc/billing_apply_provider')){state.applied.push(body);Object.assign(state.attempts.find(a=>a.id===body.p_attempt),{provider_id:body.p_provider_id,status:body.p_status});return response(true);}
      if(url.pathname.endsWith('/billing_control'))return response([{enabled:true}]);
      if(url.pathname.endsWith('/billing_attempts')){
        let rows=state.attempts.filter(a=>matches(url,a));
        if(method==='PATCH'){rows.forEach(a=>Object.assign(a,body));return response(null);}
        if(url.searchParams.get('order')==='created_at.desc')rows=rows.slice().reverse();
        return response(rows.slice(0,Number(url.searchParams.get('limit'))||rows.length));
      }
    }
    if(url.host==='api.mercadopago.com'){
      if(url.pathname==='/preapproval' && method==='POST'){
        if(state.timeout)throw Error('TIMEOUT FICTÍCIO');
        if(state.reject)return response({message:'RECUSA FICTÍCIA'},422);
        const a=state.attempts.find(a=>a.id===body.external_reference),s=addProvider(a,{status:'pending',auto_recurring:{...body.auto_recurring}});
        if(state.dropStart)delete s.auto_recurring.start_date;
        return response(s);
      }
      if(url.pathname==='/preapproval/search'){
        const rows=[...state.providers.values()].filter(s=>s.external_reference===url.searchParams.get('external_reference'));
        return response({results:state.searchDuplicates?[...rows,...rows]:rows});
      }
      if(url.pathname.startsWith('/preapproval/')){
        const s=state.providers.get(url.pathname.split('/').pop());if(!s)throw Error('ASSINATURA FICTÍCIA AUSENTE');
        if(method==='PUT' && !state.ignoreCancel){s.status=body.status;s.last_modified=new Date(instant+1000).toISOString();}
        return response(state.alterGet?{...s,...state.alterGet}:s);
      }
      if(url.pathname==='/authorized_payments/search')return response({results:[],paging:{total:0}});
    }
    throw Error('ROTA NÃO MOCKADA '+url.pathname);
  }
  return {state,addAttempt,addProvider,deps:{env,now:()=>instant,fetchImpl}};
}
const posts=f=>f.state.calls.filter(c=>c.path==='/preapproval' && c.method==='POST');
const puts=f=>f.state.calls.filter(c=>c.method==='PUT');
for(const followup of ['status','reconcile','cancel'])test('recusa definitiva → '+followup+' → nova contratação segura',async()=>{
  const f=fixture();f.state.reject=true;
  assert.equal((await checkout(f.deps)(request({acceptRecurring:true}))).status,503);
  const first=f.state.attempts[0];assert.equal(first.status,'cancelled');
  if(followup==='reconcile')await reconcile(f.deps)();
  else assert.equal((await (followup==='status'?status:cancel)(f.deps)(request({confirm:true}))).status,200);
  assert.equal(first.status,'cancelled');assert.equal(first.last_error,'checkout_rejected_before_creation');
  assert.equal(f.state.calls.filter(c=>c.path==='/preapproval/search').length,0);
  f.state.reject=false;assert.equal((await checkout(f.deps)(request({acceptRecurring:true}))).status,200);
  assert.equal(posts(f).length,2);assert.notEqual(posts(f)[0].body.external_reference,posts(f)[1].body.external_reference);
});
test('callback antigo não reabre uma tentativa já recusada no banco',async()=>{
  const f=fixture(),a=f.addAttempt(),snapshot={...a};a.status='cancelled';a.last_error='checkout_rejected_before_creation';
  await createBilling(f.deps).recordError(snapshot,'checkout_uncertain');
  assert.equal(a.status,'cancelled');assert.equal(a.last_error,'checkout_rejected_before_creation');
});
test('timeout genuinamente ambíguo não repete cobrança',async()=>{
  const f=fixture();f.state.timeout=true;
  assert.equal((await checkout(f.deps)(request({acceptRecurring:true}))).status,503);
  assert.equal((await checkout(f.deps)(request({acceptRecurring:true}))).status,409);
  assert.equal(posts(f).length,1);assert.equal(f.state.attempts[0].status,'uncertain');
});
test('reconciliador ignora quatro recusas antigas mas mantém cancelada com provedor',async()=>{
  const f=fixture();for(let i=0;i<4;i++)f.addAttempt('cancelled');
  f.addProvider(f.addAttempt(),{status:'cancelled'});await reconcile(f.deps)();
  assert.equal(f.state.calls.filter(c=>c.path==='/authorized_payments/search').length,1);
});
test('cancelamento aceita preço divergente sem liberar parcela nem alterar vínculo',async()=>{
  const f=fixture(),s=f.addProvider(f.addAttempt());s.auto_recurring={transaction_amount:70,currency_id:'USD',frequency:2,frequency_type:'months'};
  assert.equal((await cancel(f.deps)(request({confirm:true}))).status,200);assert.equal(puts(f).length,1);
  assert.equal(s.status,'cancelled');assert.equal(f.state.applied[0].p_payment,null);assert.equal(f.state.applied[0].p_checkout,null);
  assert.equal((await cancel(f.deps)(request({confirm:true}))).status,200);assert.equal(puts(f).length,1);
});
for(const change of [{collector_id:900000001},{external_reference:'OUTRA-TENTATIVA-FICTICIA'},{id:'OUTRA-ASSINATURA-FICTICIA'}])test('cancelamento rejeita identidade divergente '+Object.keys(change)[0],async()=>{
  const f=fixture();f.addProvider(f.addAttempt());f.state.alterGet=change;
  assert.equal((await cancel(f.deps)(request({confirm:true}))).status,502);assert.equal(puts(f).length,0);
});
test('PUT sem confirmação canônica não registra cancelamento',async()=>{
  const f=fixture();f.addProvider(f.addAttempt());f.state.ignoreCancel=true;
  const result=await cancel(f.deps)(request({confirm:true}));assert.equal(result.status,503);assert.equal(f.state.applied.length,0);
});
test('busca ambígua não escolhe recorrência arbitrária para cancelar',async()=>{
  const f=fixture(),a=f.addAttempt();f.addProvider(a);a.provider_id=null;f.state.searchDuplicates=true;
  assert.equal((await cancel(f.deps)(request({confirm:true}))).status,409);assert.equal(puts(f).length,0);
});
for(const remaining of [45000,1])test('preserva período vigente até nos últimos '+remaining+'ms',async()=>{
  const f=fixture();f.state.trial=instant+remaining;
  assert.equal((await checkout(f.deps)(request({acceptRecurring:true}))).status,200);
  assert.ok(Date.parse(posts(f)[0].body.auto_recurring.start_date)>=f.state.trial);
});
test('período pago posterior ao teste é preservado',async()=>{
  const f=fixture();f.state.paid=f.state.trial+86400000;
  assert.equal((await checkout(f.deps)(request({acceptRecurring:true}))).status,200);
  assert.equal(Date.parse(posts(f)[0].body.auto_recurring.start_date),f.state.paid);
});
test('provedor omite data protegida: não devolve checkout',async()=>{
  const f=fixture();f.state.trial=instant+45000;f.state.dropStart=true;
  const result=await checkout(f.deps)(request({acceptRecurring:true}));assert.equal(result.status,502);assert.equal((await result.json()).url,undefined);
});
test('período já vencido permite início imediato',async()=>{
  const f=fixture();f.state.trial=instant-1;
  assert.equal((await checkout(f.deps)(request({acceptRecurring:true}))).status,200);
  assert.equal(posts(f)[0].body.auto_recurring.start_date,undefined);
});
