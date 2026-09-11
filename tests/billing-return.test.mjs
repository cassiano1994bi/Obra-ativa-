// Entire production frontend, isolated scheduler and synthetic session only.
// No browser, provider, database or production network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../public-assets/obraativa-billing-v1.js',import.meta.url),'utf8');
const fictitiousId='a'.repeat(32);
test('conta administradora preserva a isenção e não repete o cartão grande no topo',()=>{
  assert.match(source, /a\?\.mode === 'administrator'/);
  assert.match(source, /bar\?\.remove\(\); return;/);
  assert.match(source, /Conta administrativa do produto\. Sem cobrança de assinatura\./);
  assert.match(source, /a\?\.mode === 'administrator' \? ''/);
});
test('aviso superior aparece só nos sete dias finais ou quando exige ação',()=>{
  assert.match(source, /EXPIRING_NOTICE_DAYS = 7/);
  assert.match(source, /a\.mode === 'trial'.*trial_ends_at/s);
  assert.match(source, /a\.mode === 'active'.*paid_until/s);
  assert.match(source, /\['grace','payment_due','expired','cancelled'\]/);
  assert.match(source, /if \(!shouldShowBanner\(a\)\) \{ bar\?\.remove\(\); return; \}/);
});
test('assinatura pode ser iniciada sem caixa redundante e informa cobrança agendada',()=>{
  assert.doesNotMatch(source, /data-billing-consent/);
  assert.match(source, /Garantir renovação por R\$ 69\/mês/);
  assert.match(source, /A primeira cobrança será somente em/);
  assert.match(source, /Gerenciar forma de pagamento/);
});
function boot(search,{signedIn=false,ready=false}={}) {
  const timers=[];
  const context={URLSearchParams,AbortSignal,performance:{now:()=>0},location:{search},
    document:{readyState:'complete',hidden:false,body:{classList:{contains:()=>false}},addEventListener(){},getElementById(){return null}},
    setInterval(callback,delay){timers.push({callback,delay});return timers.length},clearInterval(){},clearTimeout(){},
    window:{addEventListener(){},CloudSync:{ready,session:signedIn?{user:{id:'USUARIO-FICTICIO'},access_token:'TOKEN-FICTICIO'}:null,finishActivation(){},schedule(){},flush(){},request(){throw Error('No network allowed in this test')}}}};
  vm.runInNewContext(source,context);
  return {context,returns:timers.filter(timer=>timer.delay===10000)};
}

test('primeiro login não vira somente consulta enquanto o servidor confirma o teste',async()=>{
  const {context}=boot('?app=1',{signedIn:true,ready:true});
  assert.equal(context.window.ObraAtivaBilling.canWrite(),true);
  await Promise.resolve();
  assert.equal(context.window.ObraAtivaBilling.canWrite(),true);
});

for(const [name,search,expected] of [
  ['normal return','?app=1&billing=return',1],
  ['provider appended question mark',`?app=1&billing=return?preapproval_id=${fictitiousId}`,1],
  ['uppercase hexadecimal identifier',`?billing=return?preapproval_id=${fictitiousId.toUpperCase()}`,1],
  ['normal separated identifier',`?billing=return&preapproval_id=${fictitiousId}`,1],
  ['approved parameters do not substitute a return','?approved=true&can_write=true',0],
  ['unrelated billing view','?billing=admin',0],
  ['return substring','?billing=not-return',0],
  ['different embedded parameter',`?billing=return?payment_id=${fictitiousId}`,0],
  ['missing embedded identifier','?billing=return?preapproval_id=',0],
  ['short embedded identifier','?billing=return?preapproval_id=FICTICIO',0],
  ['non hexadecimal identifier',`?billing=return?preapproval_id=${'z'.repeat(32)}`,0],
  ['unexpected embedded suffix',`?billing=return?preapproval_id=${fictitiousId}?approved=true`,0],
  ['no return parameters','?app=1',0],
]) {
  test(name,async()=>{
    const {context,returns}=boot(search);
    assert.equal(returns.length,expected);
    assert.equal(context.window.ObraAtivaBilling.access,null,'No URL can create access');
    for(const timer of returns)await timer.callback();
    assert.equal(context.window.ObraAtivaBilling.access,null,'No polling of a signed-out account');
  });
}
