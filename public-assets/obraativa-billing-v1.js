/* Billing is server-authoritative. This file improves UX; PostgreSQL enforces access. */
(() => {
  'use strict';
  let access = null, identity = '', receivedAt = 0, busy = false, pending = null, message = '', verified = false;
  let adminRows = null, adminSearch = '', adminOffset = 0, adminLoading = false, adminError = '';
  const notified = new Set();
  const labels = { trial:'Teste grátis', active:'Assinatura ativa', grace:'Pagamento em atraso · tolerância', payment_due:'Pagamento pendente', expired:'Teste encerrado', cancelled:'Renovação cancelada', administrator:'Administrador do aplicativo' };
  const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cloud = () => window.CloudSync;
  const company = () => typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace.current?.id || null : null;
  const key = () => `${cloud()?.session?.user?.id || ''}|${company() || ''}`;
  const signedIn = () => Boolean(cloud()?.session?.user?.id && !document.body.classList.contains('public-mode'));
  const date = v => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleDateString('pt-BR') : '—';
  const DAY = 86400000, EXPIRING_NOTICE_DAYS = 7;
  function daysUntil(value, a = current()) {
    const deadline=Date.parse(value), serverNow=Date.parse(a?.server_now)+(performance.now()-receivedAt);
    return Number.isFinite(deadline) && Number.isFinite(serverNow) ? Math.ceil((deadline-serverNow)/DAY) : Infinity;
  }
  function shouldShowBanner(a = current()) {
    if (!verified || !a?.enabled || a.mode === 'administrator') return false;
    if (!a.can_write || ['grace','payment_due','expired','cancelled'].includes(a.mode)) return true;
    if (a.mode === 'trial') return daysUntil(a.trial_ends_at,a) <= EXPIRING_NOTICE_DAYS;
    if (a.mode === 'active') return daysUntil(a.paid_until,a) <= EXPIRING_NOTICE_DAYS;
    return false;
  }
  function current() {
    if (identity !== key()) return null;
    if (!access?.enabled || !access.can_write || access.mode === 'administrator') return access;
    const serverTime = Date.parse(access.server_now) + (performance.now()-receivedAt);
    const deadline = Math.max(...['trial_ends_at','paid_until','grace_ends_at'].map(k => Date.parse(access[k]) || 0));
    if (!Number.isFinite(serverTime) || serverTime >= deadline) return { ...access, can_write:false, mode:access.mode === 'trial' ? 'expired' : 'payment_due' };
    return access;
  }
  function canWrite() {
    if (!signedIn() || cloud()?.suppress === true) return true;
    // No primeiro acesso ainda não existe resposta local. O banco continua sendo
    // a autoridade e bloqueia contas vencidas; não travamos a criação inicial
    // enquanto os 30 dias grátis são confirmados pelo servidor.
    if (!verified && !current()) return true;
    if (current()?.enabled) return verified && current().can_write === true;
    return (!cloud()?.ready && !access) || (verified && current()?.can_write === true);
  }
  function assertWrite() {
    if (canWrite()) return true;
    open();
    const e = new Error('Somente consulta no momento. Seus dados estão seguros. Confira sua assinatura para salvar alterações.');
    e.code = 'OB069'; throw e;
  }
  async function rpc(name, body = {}, signal) {
    return cloud().request(`/rest/v1/rpc/${name}`, {method:'POST',body:JSON.stringify(body),signal}, cloud().session.access_token);
  }
  function accept(value, requestKey) {
    if (requestKey !== key()) return;
    if (!value || typeof value.enabled !== 'boolean' || typeof value.can_write !== 'boolean') throw Error('Resposta de assinatura indisponível.');
    access = value; identity = requestKey; receivedAt = performance.now(); verified = true;
    paint();
  }
  async function refresh() {
    if (!signedIn()) { access=null; identity=''; verified=false; paint(); return; }
    if (pending) return pending;
    const requestKey = key();
    if (requestKey !== identity) { access=null; verified=false; identity=requestKey;adminRows=null;adminOffset=0;document.getElementById('oaBillingDialog')?.close(); }
    pending = (async () => {
      try {
        const value=await rpc('billing_access', {p_company_id:company()}, AbortSignal.timeout(25000));
        if(requestKey!==key())return;
        message='';accept(value,requestKey);
      }
      catch (e) {
        if (requestKey !== key()) return;
        // A missing migration keeps the previous system, not a partial activation.
        if (e.code === 'PGRST202') accept({enabled:false,can_write:true,mode:'not_enabled'},requestKey);
        else { verified=false; message='Não foi possível verificar sua assinatura. A consulta continua disponível. Reconecte e toque em Atualizar.'; paint(); }
      } finally { pending=null; }
    })();
    return pending;
  }
  function detail(a = current()) {
    if (!verified || !a) return message || 'Estamos verificando sua assinatura. Seus dados continuam disponíveis para consulta.';
    if (a.mode === 'trial') return `Acesso completo grátis até ${date(a.trial_ends_at)}. Você pode contratar antes do fim sem perder os dias restantes.`;
    if (a.mode === 'active') return `Acesso completo liberado até ${date(a.paid_until)}.${a.provider_status === 'cancelled' ? ' A renovação foi cancelada.' : a.provider_status === 'authorized' ? ` A próxima cobrança já está programada para ${date(a.paid_until)} no Mercado Pago.` : ' Você pode deixar a próxima renovação autorizada antes do vencimento.'}`;
    if (a.mode === 'grace') return `O pagamento não foi aprovado. Você pode continuar usando tudo até ${date(a.grace_ends_at)}. Regularize a cobrança no Mercado Pago.`;
    if (a.mode === 'administrator') return 'Conta administrativa do produto. Sem cobrança de assinatura.';
    return 'Seus dados estão seguros. Você pode consultar e exportar normalmente. Assine para continuar criando e editando.';
  }
  function markup() {
    const a = current(), scheduled = a?.provider_status === 'authorized', paused = a?.provider_status === 'paused';
    const startsAt = a?.mode === 'trial' ? a?.trial_ends_at : a?.paid_until;
    const checkoutLabel = ['expired','payment_due','grace'].includes(a?.mode) ? 'Assinar agora por R$ 69/mês' : 'Garantir renovação por R$ 69/mês';
    const checkoutDisclosure = a?.mode === 'trial'
      ? `Ao continuar, você autoriza a renovação mensal de R$ 69. A primeira cobrança será somente em ${date(startsAt)}, depois do teste grátis.`
      : a?.mode === 'active' && startsAt
        ? `Ao continuar, você autoriza a renovação mensal de R$ 69. O período já pago até ${date(startsAt)} será preservado.`
        : 'Ao continuar, você autoriza a cobrança de R$ 69 por mês, com renovação automática e cancelamento disponível.';
    if (a?.enabled === false) return '<section class="oa-billing-panel"><h2>Assinaturas em preparação</h2><p>O novo plano ainda não foi ativado neste ambiente.</p></section>';
    return `<section class="oa-billing-panel"><span class="oa-billing-tag">OBRAATIVA · ACESSO COMPLETO</span>
      <h2>${!verified ? 'Verificando assinatura' : a?.mode === 'expired' ? 'Seu teste terminou' : escape(labels[a?.mode] || 'Sua assinatura')}</h2>
      <p>${escape(detail())}</p>${a?.mode === 'administrator' ? '' : '<div class="oa-billing-price">R$ 69 <small>/ mês</small></div>'}${a?.mode === 'trial' ? '<p>Um único plano, com todas as funcionalidades. Sem cartão para testar.</p>' : ''}
      <div class="oa-billing-actions">${a?.can_manage && a.mode !== 'administrator' && verified ? scheduled ? `<p>A forma de pagamento já está vinculada. A cobrança de R$ 69 será feita automaticamente em ${date(a.paid_until || a.trial_ends_at)}. Para trocar o cartão ou consultar a cobrança, abra o Mercado Pago.</p><a class="btn" href="https://www.mercadopago.com.br/subscriptions" target="_blank" rel="noopener">Gerenciar forma de pagamento</a>` : paused ? '<p>A assinatura está pausada no Mercado Pago. Abra o gerenciamento para regularizar ou trocar a forma de pagamento.</p><a class="btn" href="https://www.mercadopago.com.br/subscriptions" target="_blank" rel="noopener">Regularizar no Mercado Pago</a>' : `<p class="oa-billing-consent">${escape(checkoutDisclosure)}</p><button class="btn" type="button" data-billing-action="checkout">${escape(checkoutLabel)}</button>` : a?.can_manage === false ? '<p>Peça ao responsável pela conta para gerenciar a assinatura. Seu perfil e suas permissões continuam os mesmos.</p>' : ''}
      <button class="btn alt" type="button" data-billing-action="refresh">Atualizar status</button>
      ${a?.can_manage && ['pending','authorized','paused'].includes(a.provider_status) ? '<button class="btn alt" type="button" data-billing-action="cancel">Cancelar renovação</button>' : ''}</div>
      <p class="oa-billing-help">O cancelamento e o vencimento nunca apagam seus dados. Pagamentos são confirmados pelo Mercado Pago, não pelo clique no botão.</p>
      <p class="oa-billing-message" role="status">${escape(message)}</p></section>`;
  }
  function open() {
    let dialog = document.getElementById('oaBillingDialog');
    if (!dialog) {
      dialog=document.createElement('dialog'); dialog.id='oaBillingDialog'; dialog.className='oa-billing-dialog';
      dialog.setAttribute('aria-label','Assinatura ObraAtiva'); document.body.append(dialog);
    }
    dialog.__billingMarkup=markup();
    dialog.innerHTML=`<div class="oa-billing-close"><button type="button" class="btn alt" data-billing-action="close">Continuar consultando</button></div>${dialog.__billingMarkup}`;
    if (!dialog.open) dialog.showModal();
  }
  function syncOpenDialog() {
    const dialog=document.getElementById('oaBillingDialog');
    if(!signedIn()){dialog?.close();return;}
    if(!dialog?.open || busy)return;
    const next=markup();
    if(dialog.__billingMarkup===next)return;
    const panel=dialog.querySelector('.oa-billing-panel');
    if(!panel)return;
    const focused=document.activeElement,restore=panel.contains(focused),scroll=dialog.scrollTop;
    const action=focused?.dataset?.billingAction,href=focused?.getAttribute?.('href');
    panel.outerHTML=next;dialog.__billingMarkup=next;
    if(restore){
      const target=[...dialog.querySelectorAll('[data-billing-action],a[href]')].find(el=>action ? el.dataset.billingAction===action : href && el.getAttribute('href')===href);
      (target || dialog.querySelector('[data-billing-action="refresh"]') || dialog.querySelector('[data-billing-action="close"]'))?.focus({preventScroll:true});
    }
    dialog.scrollTop=scroll;
  }
  function paint() {
    // Atualiza o modal mesmo quando o acesso foi liberado e o banner deve desaparecer.
    syncOpenDialog();
    const a=current();
    let bar=document.getElementById('oaBillingBanner');
    if (!signedIn() || a?.enabled === false) { bar?.remove(); return; }
    // A conta administradora já é identificada no cabeçalho; não repete um cartão de cobrança.
    if (cloud()?.isSalesAdmin === true || (verified && a?.mode === 'administrator')) { bar?.remove(); return; }
    // O topo fica livre durante o uso normal; avisa apenas nos 7 dias finais ou quando há ação necessária.
    if (!shouldShowBanner(a)) { bar?.remove(); return; }
    const view=document.getElementById('view');
    if (!view || !cloud()?.ready) return;
    if (!bar) { bar=document.createElement('aside');bar.id='oaBillingBanner';bar.className='oa-billing-banner';bar.setAttribute('aria-label','Status da assinatura');view.before(bar); }
    const title=!verified ? 'Verificando assinatura' : labels[a?.mode] || 'Assinatura';
    const text=`<div><b>${escape(title)}</b><span>${escape(detail())}</span></div><button type="button" class="btn alt" data-billing-action="open">${a?.can_write ? 'Ver assinatura' : 'Assinar agora'}</button>`;
    if (bar.innerHTML!==text) bar.innerHTML=text;
    bar.dataset.readonly=String(!canWrite());
    if (!canWrite()) clearTimeout(cloud()?.timer);
    if (verified && a?.enabled && !a.can_write && !notified.has(identity) && !busy) {
      notified.add(identity);
      if(!document.getElementById('oaBillingDialog')?.open)open();
    }
  }
  async function api(name, body) {
    const response=await fetch(`/.netlify/functions/billing-${name}`, {method:'POST',headers:{authorization:`Bearer ${cloud().session.access_token}`,'content-type':'application/json'},body:JSON.stringify({companyId:company(),...body}),signal:AbortSignal.timeout(25000)});
    const result=await response.json();
    if (!response.ok) throw Error(result.error || 'Não foi possível confirmar. Tente novamente.');
    return result;
  }
  async function action(name, button) {
    if (name==='open') return open();
    if (name==='close') return document.getElementById('oaBillingDialog')?.close();
    if (busy) return;
    if (name==='cancel' && !confirm('Cancelar a renovação automática? O período já liberado continua válido. Seus dados não serão apagados.')) return;
    busy=true; const requestKey=key(),original=button.textContent;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Confirmando…';
    try {
      message='';
      if (name==='checkout') {
        const reply=await api('checkout',{acceptRecurring:true}), url=new URL(reply.url);
        if(requestKey!==key())return;
        if (url.protocol!=='https:' || !['www.mercadopago.com.br','mercadopago.com.br'].includes(url.hostname) || !url.pathname.startsWith('/subscriptions/')) throw Error('Endereço de pagamento não confirmado.');
        location.assign(url.href); return;
      }
      if (name==='cancel') { const result=await api('cancel',{confirm:true});if(requestKey!==key())return;await refresh();if(requestKey!==key())return;message=result.message; }
      else if (current()?.enabled) { const result=await api('status',{});if(requestKey!==key())return;accept(result,requestKey);message=current()?.mode==='active' ? 'Pagamento confirmado. Acesso completo liberado!' : 'Status atualizado. A liberação acontece quando o pagamento é confirmado.'; }
      else await refresh();
      if(requestKey===key())open();
    } catch(e) { if(requestKey===key()){message=e.message || 'Não foi possível confirmar. Tente novamente.';open();} }
    finally {busy=false;button.disabled=false;button.removeAttribute('aria-busy');button.textContent=original;paint();}
  }
  function adminMarkup() {
    if (!cloud()?.isSalesAdmin) return '';
    if (adminRows===null && !adminLoading) setTimeout(()=>loadAdmin(),0);
    return `<section class="oa-billing-panel" id="oaBillingAdmin"><h2>Assinaturas</h2><p>Plano completo · R$ 69/mês · 30 dias grátis · 3 dias de tolerância para falhas de pagamento.</p>
      <div class="oa-billing-actions"><label>Buscar conta <input type="search" data-billing-search value="${escape(adminSearch)}" placeholder="Nome ou e-mail"></label><button class="btn" type="button" data-billing-action="admin-search">Buscar / atualizar</button></div>
      <p role="status">${escape(adminError || (adminLoading ? 'Carregando assinaturas…' : 'Somente leitura. Pagamentos são confirmados automaticamente pelo Mercado Pago.'))}</p>
      <div class="oa-billing-table-wrap"><table><thead><tr><th>Conta</th><th>Status</th><th>Fim do teste</th><th>Pago até</th><th>Tolerância até</th><th>Última conferência</th></tr></thead><tbody>${(adminRows||[]).map(row=>`<tr><td><b>${escape(row.name)}</b><br>${escape(row.email)}</td><td>${escape(labels[row.access.mode] || row.access.mode)}${row.sync_error ? '<br><small>Conferência pendente</small>':''}</td><td>${date(row.access.trial_ends_at)}</td><td>${date(row.access.paid_until)}</td><td>${date(row.access.grace_ends_at)}</td><td>${date(row.last_sync)}</td></tr>`).join('') || '<tr><td colspan="6">Nenhuma assinatura carregada nesta página.</td></tr>'}</tbody></table></div>
      <div class="oa-billing-actions"><button class="btn alt" type="button" data-billing-action="admin-prev" ${adminOffset===0?'disabled':''}>Anterior</button><span>Página ${adminOffset/50+1}</span><button class="btn alt" type="button" data-billing-action="admin-next" ${(adminRows||[]).length<50?'disabled':''}>Próxima</button></div></section>`;
  }
  async function loadAdmin() {
    if (adminLoading || !cloud()?.isSalesAdmin) return;
    adminLoading=true;adminError='';
    try {const report=await rpc('billing_admin_report',{p_search:adminSearch,p_offset:adminOffset});adminRows=report.rows||[];if(!report.enabled)adminError='O novo sistema ainda não foi ativado. Nenhuma cobrança automática foi iniciada.';}
    catch {adminError='Não foi possível carregar as assinaturas. Confira sua sessão de proprietário e tente atualizar.';adminRows=[];}
    finally {adminLoading=false;const el=document.getElementById('oaBillingAdmin');if(el)el.outerHTML=adminMarkup();}
  }
  // Capture at window, ahead of legacy delegated handlers on document.
  // Navigation, filters, consultation and exports are deliberately not blocked.
  function guardEvent(event) {
    const billing=event.target.closest?.('[data-billing-action]');
    if (billing && event.type==='click') {
      event.preventDefault();event.stopImmediatePropagation();const name=billing.dataset.billingAction;
      if (name.startsWith('admin-')) {
        if(name==='admin-search'){adminSearch=document.querySelector('[data-billing-search]')?.value||'';adminOffset=0;}
        if(name==='admin-next')adminOffset+=50;if(name==='admin-prev')adminOffset=Math.max(0,adminOffset-50);
        loadAdmin();return;
      }
      action(name,billing);return;
    }
    if (canWrite() || event.target.closest?.('.oa-billing-dialog,.oa-billing-panel,[data-billing-query]')) return;
    const el=event.target.closest?.('button,a,[onclick],[data-wc-action],input[type=file]');
    const handler=el?.getAttribute('onclick')||'', text=(el?.textContent||'').trim();
    const mutating=event.type==='submit' || (event.type==='change' && event.target.matches('input[type=file]')) ||
      (event.type==='click' && el && (/\b(save|delete|remove|restore|import|addSuggested|moveWorkPhase|payAll|confirmPayment|reverseLatestPayment)/.test(handler) ||
        /^(?:[+✓💾✎🗑️\s]*)(salvar|excluir|remover|adicionar|criar|nova?\b|editar|registrar|pagar|confirmar|estornar|importar|restaurar|distribuir|sugerir fases)/i.test(text) ||
        (el.dataset.wcAction && el.dataset.wcAction!=='close')));
    if (mutating) {event.preventDefault();event.stopImmediatePropagation();open();}
  }
  for(const type of ['click','submit','change']) window.addEventListener(type,guardEvent,true);
  function wrap(object, name) {
    const original=object?.[name];if(typeof original!=='function' || original.__billingGuard)return;
    const guarded=function(...args){assertWrite();return original.apply(this,args)};
    guarded.__billingGuard=true;object[name]=guarded;
  }
  function install() {
    if (!cloud()) return;
    // Explicit mutation families; date helpers (addDays etc.) stay untouched.
    for(const name of Object.keys(window)) if (/^(save(?!d|r)|delete|remove(?:Work|Employee|Assignment|Role|Company)|restoreOfficeBackup|importOffice|addSuggestedWorkPhases|addRole|moveWorkPhase|confirmTransfer|markAll|payAll)/.test(name)) wrap(window,name);
    for(const [object,names] of [[window.COBudget,['saveForm','remove','importPdf']], [window.COBudgetLinks,['issue']], [window.COBudgetDistribution,['importFile','usePastedScope','distributeAll','redistribute','prepareBudget']], [typeof ClientDataService!=='undefined'?ClientDataService:null,['persist']], [typeof ServerWorkMedia!=='undefined'?ServerWorkMedia:null,['upload','uploadMany','remove']]]) names.forEach(name=>wrap(object,name));
    if(window.AssistantActionsCore){const original=window.AssistantActionsCore;window.AssistantActionsCore=Object.freeze({...original,applyConfirmedProposal(...args){assertWrite();return original.applyConfirmedProposal(...args)}});}
    const finish=cloud().finishActivation;
    cloud().finishActivation=function(...args){const r=finish.apply(this,args);refresh();return r;};
    const schedule=cloud().schedule,flush=cloud().flush,request=cloud().request;
    cloud().schedule=function(...args){if(!canWrite()){clearTimeout(this.timer);return;}return schedule.apply(this,args)};
    cloud().flush=function(...args){if(!canWrite())return Promise.resolve(false);return flush.apply(this,args)};
    cloud().request=async function(path,options={},...rest){
      const mutation=/\/rpc\/(save_|create_company|update_company|remove_company|budget_public_(issue|revoke))/.test(path) ||
        (/\/rest\/v1\/(app_state|company_app_state|companies|work_media)(?:\?|$)/.test(path) && !['GET','HEAD'].includes(options.method||'GET'));
      if(mutation)assertWrite();
      try{return await request.call(this,path,options,...rest)}catch(e){if(e.code==='OB069'){verified=false;message=e.message;paint();refresh();}throw e;}
    };
    if(typeof CompanyWorkspace!=='undefined') {const show=CompanyWorkspace.showSubscription;CompanyWorkspace.showSubscription=function(...args){return current()?.enabled?open():show.apply(this,args)};}
    window.addEventListener('focus',()=>refresh());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
    setInterval(()=>{if(!document.hidden){paint();if(signedIn())refresh();}},60000);
    // Poll server status, never infer success from the return URL.
    // Hosted checkout may append ?preapproval_id even when back_url has a query.
    // Recognize that shape only; the ID is never used to select or unlock an account.
    const billingReturn=new URLSearchParams(location.search).get('billing');
    if(billingReturn==='return' || /^return\?preapproval_id=[a-fA-F0-9]{32}$/.test(billingReturn||'')) {
      let ticks=0,attempts=0,inFlight=false,returnKey='',lastAttempt=-Infinity;
      const timer=setInterval(async()=>{
        if(++ticks>30 || current()?.mode==='active' || attempts>=4){clearInterval(timer);return;}
        if(inFlight || !signedIn() || !cloud()?.ready)return;
        const requestKey=key();
        if(returnKey && returnKey!==requestKey){clearInterval(timer);return;}
        returnKey=requestKey;inFlight=true;
        try {
          await refresh();
          if(requestKey!==key()){clearInterval(timer);return;}
          if(!current()?.enabled || performance.now()-lastAttempt<35000)return;
          // Só conta consultas realizadas; respeita o intervalo de 30s do servidor.
          attempts++;lastAttempt=performance.now();
          accept(await api('status',{}),requestKey);
        } catch { /* Falha temporária: nova consulta limitada, nunca uma nova cobrança. */ }
        finally {inFlight=false;}
      },10000);
    }
    if(cloud().ready)refresh();
  }
  window.ObraAtivaBilling=Object.freeze({refresh,open,markup,adminMarkup,canWrite,assertWrite,shouldShowBanner,get access(){return current()}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
