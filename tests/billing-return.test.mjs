// Entire production frontend, isolated scheduler and synthetic session only.
// No browser, provider, database or production network.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=readFileSync(new URL('../public-assets/obraativa-billing-v1.js',import.meta.url),'utf8');
const fictitiousId='a'.repeat(32);
function boot(search) {
  const timers=[];
  const context={URLSearchParams,performance:{now:()=>0},location:{search},
    document:{readyState:'complete',hidden:false,body:{classList:{contains:()=>false}},addEventListener(){},getElementById(){return null}},
    setInterval(callback,delay){timers.push({callback,delay});return timers.length},clearInterval(){},clearTimeout(){},
    window:{addEventListener(){},CloudSync:{ready:false,session:null,finishActivation(){},schedule(){},flush(){},request(){throw Error('No network allowed in this test')}}}};
  vm.runInNewContext(source,context);
  return {context,returns:timers.filter(timer=>timer.delay===10000)};
}

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
