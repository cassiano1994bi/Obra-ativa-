// Current client in an isolated VM. Manual clock; no browser/account/network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public-assets/obraativa-billing-v1.js',import.meta.url),'utf8');
const access=()=>({enabled:true,can_write:false,can_manage:true,mode:'expired',server_now:'2031-01-15T12:00:00Z',trial_ends_at:'2031-01-01T12:00:00Z'});
const session=()=>({user:{id:'USUARIO-FICTICIO-A'},access_token:'TOKEN-FICTICIO'});
function boot() {
  let now=0,fetchImpl=async()=>new Response(JSON.stringify(access())),rpcImpl=async()=>access();
  const timers=[],calls=[],rpcCalls=[],signals=[];
  const ctx={URLSearchParams,URL,Response,AbortSignal:{timeout(ms){assert.equal(ms,25000);const c=new AbortController();signals.push(c);return c.signal}},performance:{now:()=>now},location:{search:'?app=1&billing=return'},
    CompanyWorkspace:{current:null,showSubscription(){}},
    document:{readyState:'complete',hidden:false,body:{classList:{contains:()=>false}},addEventListener(){},getElementById(){return null}},
    setInterval(callback,delay){const timer={callback,delay,stopped:false};timers.push(timer);return timer},clearInterval(timer){timer.stopped=true},clearTimeout(){},
    fetch:async(url,options)=>{calls.push({at:now,url,body:JSON.parse(options.body)});return fetchImpl(url,options)},
    window:{addEventListener(){},CloudSync:{ready:false,session:null,finishActivation(){},schedule(){},flush(){},request:async(path,options)=>{rpcCalls.push({path,options});return rpcImpl(path,options)}}}};
  vm.runInNewContext(source,ctx);
  const timer=timers.find(t=>t.delay===10000);
  return {ctx,calls,rpcCalls,signals,timer,api:ctx.window.ObraAtivaBilling,
    ready(){ctx.window.CloudSync.session=session();ctx.window.CloudSync.ready=true;ctx.CompanyWorkspace.current={id:'EMPRESA-FICTICIA-A'}},
    fetch(fn){fetchImpl=fn},rpc(fn){rpcImpl=fn},
    async tick(){now+=10000;if(!timer.stopped)await timer.callback()},
    tickPending(){now+=10000;return timer.stopped?Promise.resolve():timer.callback()}
  };
}
test('retorno espera sessão e empresa antes de consultar; falha temporária tem nova consulta',async()=>{
  const b=boot();await b.tick();b.ctx.window.CloudSync.session=session();await b.tick();
  assert.equal(b.calls.length,0);
  b.ready();let attempts=0;
  b.fetch(async()=>{if(++attempts===1)throw Error('FALHA FICTICIA');return new Response(JSON.stringify({...access(),can_write:true,mode:'active',paid_until:'2031-03-01T00:00:00Z'}))});
  await b.tick();assert.equal(b.calls.length,1);
  for(let i=0;i<4;i++)await b.tick();
  assert.equal(b.calls.length,2);assert.equal(b.calls[1].at-b.calls[0].at,40000);
  assert.ok(b.calls.every(c=>c.body.companyId==='EMPRESA-FICTICIA-A'));
  assert.equal(b.api.access.mode,'active');
  await b.tick();assert.equal(b.timer.stopped,true);
});
test('limita a quatro consultas reais, sem repetir cobrança',async()=>{
  const b=boot();b.ready();for(let i=0;i<30;i++)await b.tick();
  assert.equal(b.calls.length,4);assert.ok(b.calls.every(c=>c.url.endsWith('billing-status')));
  for(let i=1;i<4;i++)assert.ok(b.calls[i].at-b.calls[i-1].at>=35000);
});
test('não sobrepõe consulta pendente e descarta resposta de outra identidade',async()=>{
  const b=boot();b.ready();let resolve;b.fetch(()=>new Promise(r=>resolve=r));
  const pending=b.tickPending();while(!resolve)await Promise.resolve();
  await b.tick();await b.tick();assert.equal(b.calls.length,1);
  b.ctx.window.CloudSync.session.user.id='USUARIO-FICTICIO-B';b.ctx.CompanyWorkspace.current.id='EMPRESA-FICTICIA-B';
  resolve(new Response(JSON.stringify({...access(),mode:'active',can_write:true,paid_until:'2031-03-01T00:00:00Z'})));
  await pending;assert.equal(b.api.access,null);await b.tick();assert.equal(b.timer.stopped,true);assert.equal(b.calls.length,1);
});
test('RPC pendente recebe limite de 25s; abortar libera atualização e retorno',async()=>{
  const b=boot();b.ready();b.rpc((path,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('TIMEOUT FICTICIO')),{once:true})));
  const pending=b.tickPending();await Promise.resolve();
  assert.equal(b.rpcCalls.length,1);assert.ok(b.rpcCalls[0].options.signal);
  b.signals[0].abort();await pending;assert.equal(b.calls.length,0);
  b.rpc(async()=>access());await b.tick();assert.equal(b.calls.length,1);
});
test('prazo de retorno encerra sem login; legado pronto sem empresa continua suportado',async()=>{
  const b=boot();for(let i=0;i<31;i++)await b.tick();assert.equal(b.calls.length,0);assert.equal(b.timer.stopped,true);
  const legacy=boot();legacy.ready();legacy.ctx.CompanyWorkspace.current=null;await legacy.tick();
  assert.equal(legacy.calls.length,1);assert.equal(legacy.calls[0].body.companyId,null);
});
