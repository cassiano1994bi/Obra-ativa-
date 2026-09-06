import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fixture = await fs.readFile(path.join(root, 'tests/work-control-harness.html'), 'utf8');
const source = fixture.slice(fixture.indexOf('let db='), fixture.indexOf('let persisted=')).replace('let db=', 'db=');

// Only synthetic data, memory storage and local assets. No real account or backend.
export const init = `(() => {
  const values = new Map();
  const storage = {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),clear:()=>values.clear(),key:i=>[...values.keys()][i]||null,get length(){return values.size}};
  Object.defineProperty(window,'localStorage',{value:storage});
  Object.defineProperty(window,'sessionStorage',{value:storage});
  const NativeDate=Date;
  window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2031-01-15T12:00:00Z']))}static now(){return NativeDate.parse('2031-01-15T12:00:00Z')}};
  window.fetch = async () => new Response('[]',{headers:{'Content-Type':'application/json'}});
  navigator.geolocation.getCurrentPosition = (_,fail) => fail?.({code:1,message:'PRÉVIA FICTÍCIA sem localização real'});
  if (new URLSearchParams(location.search).get('weather') === '1') {
    const demoWeather = {current:{temperature:24,humidity:61,wind:2,precipitation:0,symbol:'partlycloudy_day'},days:[0,1,2,3].map(i=>({date:'2031-01-'+(15+i),min:18+i,max:26+i,precipitation:i,symbol:i===2?'rain':'partlycloudy_day'}))};
    window.fetch = async () => new Response(JSON.stringify(demoWeather),{headers:{'Content-Type':'application/json'}});
    values.set('obraativaWeatherLocationV1',JSON.stringify({enabled:true,latitude:0,longitude:0,savedAt:'TESTE FICTÍCIO'}));
  }
})();`;

export const activate = `(() => {
  const emptyDb = db;
  ${source}
  db={...emptyDb,...db,settings:{...emptyDb.settings,...db.settings}};
  db.settings.responsible='Gestor fictício';
  if (new URLSearchParams(location.search).get('scenario') === 'busy') {
    db.works.push({id:'AMPLIACAO-TESTE',name:'OBRA FICTÍCIA — Ampliação de teste',status:'Em andamento'});
    for(let i=0;i<4;i++) {
      const employeeId='PESSOA-VISUAL-TESTE-'+i;
      const workId=i<2?'LEGADO-TESTE':'AMPLIACAO-TESTE';
      db.employees.push({id:employeeId,name:'PROFISSIONAL FICTÍCIO '+(i+1),daily:29+i,startDate:'2030-01-01',status:'Ativo'});
      db.distributions.push({id:'ESCALA-VISUAL-TESTE-'+i,employeeId,workId,date:'2031-01-15'});
      db.attendance.push({id:'PRESENCA-VISUAL-TESTE-'+i,employeeId,workId,date:'2031-01-15',status:'Trabalhou'});
    }
    db.audit=[{action:'Presença FICTÍCIA registrada',detail:'Registro visual de teste em memória.',at:'2031-01-15 09:00'},{action:'Escala FICTÍCIA organizada',detail:'Distribuição de teste, sem conta real.',at:'2031-01-15 08:30'}];
  }
  CompanyWorkspace.current={id:'EMPRESA-TESTE',name:'EMPRESA FICTÍCIA',role:'owner',permissionProfile:'gerente'};
  CloudSync.session={access_token:'TOKEN-FICTICIO-SEM-VALIDADE',user:{id:'USUARIO-TESTE',email:'teste@example.invalid',user_metadata:{full_name:'GESTOR FICTÍCIO'}}};
  CloudSync.schedule=()=>{};
  CloudSync.showAuth=()=>{};
  document.querySelectorAll('#cloudGate,#obraAtivaSplash,.cloud-auth-overlay,.cloud-session-retry-overlay').forEach(e=>e.remove());
  document.body.classList.remove('cloud-auth-required','public-mode','auth-mode');
  page=new URLSearchParams(location.search).get('module')||'home';
  renderTop();render();
  document.title='TESTE FICTÍCIO — ObraAtiva premium';
  if (new URLSearchParams(location.search).has('billingtest')) {
    const modes = {trial:true,active:true,grace:true,expired:false,payment_due:false,cancelled:false,administrator:true};
    window.billingFixtureMode=new URLSearchParams(location.search).get('billingtest')||'trial';
    window.billingFixtureAccess=()=>({enabled:true,can_write:modes[window.billingFixtureMode]===true,can_manage:true,
      owner_user_id:'USUARIO-TESTE',mode:window.billingFixtureMode,plan:'obraativa',price:69,currency:'BRL',server_now:'2031-01-15T12:00:00Z',
      trial_ends_at:window.billingFixtureMode==='trial'?'2031-02-01T12:00:00Z':'2030-12-01T12:00:00Z',
      paid_until:window.billingFixtureMode==='active'?'2031-02-15T12:00:00Z':null,
      grace_ends_at:window.billingFixtureMode==='grace'?'2031-01-17T12:00:00Z':null,
      provider_status:['active','grace','payment_due'].includes(window.billingFixtureMode)?'authorized':null});
    CloudSync.ready=true;CloudSync.isSalesAdmin=true;
    CloudSync.request=async(path)=>{
      if(path.endsWith('/billing_access'))return window.billingFixtureAccess();
      if(path.endsWith('/billing_admin_report'))return {enabled:true,rows:Object.keys(modes).map((mode,i)=>({name:'CONTA FICTÍCIA '+(i+1),email:'conta-teste-'+i+'@example.invalid',access:{...window.billingFixtureAccess(),mode},last_sync:'2031-01-15T12:00:00Z'}))};
      return [];
    };
    window.fetch=async(url)=>{
      if(String(url).includes('/billing-status'))return new Response(JSON.stringify(window.billingFixtureAccess()));
      return new Response(JSON.stringify({error:'PRÉVIA FICTÍCIA: nenhuma cobrança real é permitida.'}),{status:409});
    };
    window.ObraAtivaBilling.refresh().then(()=>{renderTop();render()});
  }
})();`;

export async function startPreview(port = 0) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      const isPreview = pathname === '/tests/premium-workspace-preview.html';
      const relative = isPreview ? 'index.html' : pathname.replace(/^\//, '');
      // Never expose source/config/credentials or unrelated workspace files.
      if (!(relative === 'index.html' || /^public-assets\/[a-z0-9_.-]+$/i.test(relative) || /^tests\/(?:auth-experience-harness|premium-workspace-review|billing-subscriptions-review).html$/.test(relative) || /^tmp\/premium-workspace-qa\/(?:reference-login|reference-public|before-desktop|after-desktop|after-phone|after-tablet|after-works-desktop|modern-(?:desktop|phone|tablet|small|portrait|works-desktop))\.png$/.test(relative))) throw Error('Not allowed');
      const target = path.resolve(root, relative);
      if (!target.startsWith(root + path.sep)) throw Error('Path');
      const ext = path.extname(target);
      res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.html':'text/html'})[ext] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Security-Policy', "connect-src 'none'; form-action 'none'; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'none'; font-src 'self'; frame-src " + (relative === 'tests/billing-subscriptions-review.html' ? "'self'" : "'none'"));
      let body = await fs.readFile(target);
      if (ext === '.html') {
        body = body.toString().replace('<head>', '<head>' + (isPreview ? '<base href="/">' : '') + '<script>' + init + '</script>');
        if (isPreview && url.searchParams.get('screen') !== 'login') body = body.replace('</body>', '<script>window.addEventListener("load",()=>{' + activate + '});</script></body>');
      }
      res.end(body);
    } catch { res.statusCode = 404; res.end('Local preview: unavailable'); }
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return {server, origin:`http://127.0.0.1:${server.address().port}`};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {origin} = await startPreview(Number(process.argv[2]) || 0);
  console.log('PRÉVIA LOCAL — SOMENTE DADOS FICTÍCIOS: ' + origin + '/tests/premium-workspace-preview.html?app=1');
}
