(() => {
  'use strict';
  const MODULES = { home: 'Início', works: 'Obras', planning: 'Escala diária', team: 'Equipe', attendance: 'Presença', payments: 'Pagamentos', financial: 'Financeiro', vehicles: 'Veículos', reports: 'Relatórios', assistant: 'IA', permissions: 'Administrador', reminders: 'Lembretes', budgets: 'Orçamentos' };
  const LABELS = { owner: 'Proprietário', manager: 'Gerente', admin: 'Administrador', collaborator: 'Colaborador', viewer: 'Visualizador', trial: 'Em teste', active: 'Ativa', inactive: 'Inativa', suspended: 'Suspensa', payment_due: 'Pagamento pendente', cancelled: 'Cancelada', essential: 'Essencial', builder: 'Construtora', professional: 'Profissional', custom: 'Personalizado', administrator: 'Administrador' };
  const state = { user: '', tab: 'overview', days: 30, search: '', activity: 'all', offset: 0, data: null, busy: false, error: '', form: '', detail: null, selected: null, notice: '', link: '', request: 0 };
  const allowed = () => window.CloudSync?.isSalesAdmin === true && Boolean(window.CloudSync?.session?.user?.id);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const cash = (value) => number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date = (value, time = false) => value ? new Date(String(value).length === 10 ? `${value}T12:00:00` : value).toLocaleString('pt-BR', time ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }) : 'Não registrado';
  const duration = (seconds) => `${Math.floor(number(seconds) / 3600)}h ${Math.floor(number(seconds) % 3600 / 60)}min`;
  const button = (action, label, value = '', primary = false) => `<button type="button" data-oc-action="${action}" data-value="${escape(value)}" class="${primary ? 'oc-primary' : ''}">${label}</button>`;
  const stat = (label, value, hint) => `<article class="oc-stat"><small>${label}</small><b>${escape(value)}</b><small>${hint}</small></article>`;
  const empty = (text) => `<div class="oc-empty">${text}</div>`;
  function reset() {
    const user = window.CloudSync?.session?.user?.id || '';
    if (!allowed() || user !== state.user) Object.assign(state, { user, data: null, busy: false, error: '', detail: null, selected: null, receiptCompanies: [], form: '', link: '', search: '', activity: 'all', offset: 0, notice: '', request: state.request + 1 });
  }
  async function rpc(name, args = {}) {
    if (!allowed()) throw new Error('denied');
    const path = `/rest/v1/rpc/${name}`;
    const options = { method: 'POST', body: JSON.stringify(args) };
    try {
      return await window.CloudSync.request(path, options, window.CloudSync.session?.access_token);
    } catch (error) {
      const session = window.CloudSync.session;
      if (error?.status !== 401 || !session?.refresh_token || typeof window.CloudSync.refreshSession !== 'function') throw error;
      try {
        const refreshed = await window.CloudSync.refreshSession(session);
        return await window.CloudSync.request(path, options, refreshed?.access_token);
      } catch (refreshError) {
        if (window.CloudSync.isConfirmedAuthFailure?.(refreshError)) {
          window.CloudSync.session = null;
          window.CloudSync.ready = false;
          try { localStorage.removeItem(CLOUD_CONFIG.sessionKey); } catch { /* armazenamento pode estar indisponível */ }
          window.CloudSync.showAuth?.('signin', 'Sua sessão terminou. Entre novamente para continuar.', true);
        }
        throw refreshError;
      }
    }
  }
  function message(error) {
    if (error?.status === 404 || error?.code === 'PGRST202') return 'Acompanhamento ainda não ativado no banco. As funções atuais continuam disponíveis em Comercial e Configurações.';
    if ([401, 403].includes(error?.status) || error?.message === 'denied' || error?.code === '42501') return 'Acesso exclusivo do proprietário. Entre novamente se sua sessão terminou.';
    if (error?.code === '23505') return 'Esse identificador ou referência já foi registrado. Confira para não duplicar.';
    return 'Não foi possível concluir agora. Confira sua conexão e tente novamente. Nenhuma informação foi substituída na tela.';
  }
  function paint() {
    reset();
    const host = document.getElementById('oaOwnerPanel');
    if (host) host.innerHTML = allowed() ? content() : '<p>Acesso exclusivo do proprietário.</p>';
  }
  async function load(silent = false) {
    reset(); if (!allowed() || state.busy) return;
    const request = ++state.request, user = state.user;
    state.busy = true; state.error = ''; if (!silent) paint();
    try {
      const data = await rpc('owner_insights_report', { p_days: state.days, p_search: state.search, p_offset: state.offset, p_activity: state.activity });
      if (request !== state.request || user !== window.CloudSync?.session?.user?.id || !allowed()) return;
      state.data = data;
    } catch (error) { if (request === state.request) state.error = message(error); }
    finally { if (request === state.request) { state.busy = false; paint(); } }
  }
  function overview() {
    const s = state.data.summary || {}, campaigns = state.data.campaigns || [];
    const total = (key) => campaigns.reduce((sum, c) => sum + number(c[key]), 0);
    return `<div class="oc-stats">${stat('Visitas medidas', s.visits, 'após a pessoa permitir a medição')}${stat('Cadastros no período', s.registered, 'contas, não funcionários cadastrados')}${stat('Pessoas que usaram', s.active, 'uso ativo com medição permitida')}${stat('Ativos recentemente', s.online, 'estimativa dos últimos 90 segundos')}${stat('Cadastros sem origem', s.unattributed, 'não atribuímos uma campanha por suposição')}</div>
      <div class="oc-grid"><section class="oc-card"><h3>Suas campanhas estão trazendo resultados?</h3><p>Investimento informado: <b>${cash(total('spent'))}</b></p><p>Recebimentos atribuídos no período: <b>${cash(total('revenue'))}</b></p><p>Cadastros identificados: <b>${total('signups')}</b> · Desses, começaram a usar: <b>${total('activated')}</b></p>${button('nav-campaigns', 'Ver resultados das campanhas')}<p class="oc-legend">Recebimentos comerciais informados manualmente, descontando estornos. Não representam lucro nem alteram o financeiro das obras.</p></section>
      <section class="oc-card"><h3>Entenda a adoção do aplicativo</h3><p>Veja quem entrou, quem voltou e quem ainda não começou. A ausência de medição não prova abandono: a pessoa pode ter recusado ou estar offline.</p>${button('nav-users', 'Acompanhar usuários')}<p class="oc-legend">Atualizado em ${date(state.data.server_time, true)}. Use Atualizar para consultar a presença recente.</p></section></div>`;
  }
  function users() {
    const users = state.data.users || [];
    return `<form data-oc-form="search" class="oc-toolbar"><label>Buscar nome ou e-mail<input name="search" type="search" maxlength="120" value="${escape(state.search)}" placeholder="Pesquisar usuário"></label><label>Atividade<select name="activity">${[['all','Todos os usuários'],['online','Ativos recentemente'],['unused','Sem uso medido no período'],['unmeasured','Sem permissão de medição']].map(([value,label])=>`<option value="${value}" ${state.activity===value?'selected':''}>${label}</option>`).join('')}</select></label><button class="oc-primary" type="submit">Buscar</button></form>
      <div class="oc-table-wrap"><table class="oc-users"><thead><tr><th>Usuário / empresa</th><th>Cadastro</th><th>Atividade</th><th>Uso no período</th><th>Origem</th><th>Detalhes</th></tr></thead><tbody>${users.map((u) => `<tr><td><b>${escape(u.name || u.email || 'Conta sem nome')}</b><small>${escape(u.email)}</small><small>${escape((u.companies || []).map((c) => c.name).join(' · ') || 'Ainda sem empresa')}</small></td><td data-label="Cadastro">${date(u.created_at)}</td><td><span class="oc-status ${u.online ? 'oc-online' : ''}">${u.online ? 'Ativo recentemente' : u.tracking_allowed ? 'Sem atividade recente' : 'Medição não permitida'}</span><small>Última atividade: ${date(u.last_activity, true)}</small></td><td data-label="Uso">${number(u.active_days)} dia(s) · ${duration(u.active_seconds)}<small>estimado e medido</small></td><td data-label="Origem">${escape(u.origin || 'Não identificada')}</td><td>${button('user', 'Ver histórico', u.id)}</td></tr>`).join('') || '<tr><td colspan="6">Nenhum usuário encontrado para esta busca.</td></tr>'}</tbody></table></div>
      <div class="oc-toolbar"><small>${state.data.user_total ? state.offset + 1 : 0}–${state.offset + users.length} de ${number(state.data.user_total)} contas</small><div>${state.offset ? button('prev', 'Anterior') : ''}${state.offset + 50 < state.data.user_total ? button('next', 'Próximos') : ''}</div></div>
      <p class="oc-legend">Tempo ativo é uma estimativa, não uma medida de produtividade. Nenhuma tela, senha, conversa ou conteúdo operacional é mostrado aqui.</p>`;
  }
  function detail() {
    const u = state.selected, d = state.detail;
    const modules = {};
    for (const day of d.days || []) for (const [key, value] of Object.entries(day.modules || {})) modules[key] = (modules[key] || 0) + number(value);
    return `<section class="oc-card"><div class="oc-toolbar"><h3>${escape(u.name || u.email)}</h3>${button('back-user', 'Voltar à lista')}</div><p>${escape(u.email)} · Cadastro: ${date(u.created_at, true)}</p><p>Convite por: ${escape(u.invited_by || 'Cadastro direto ou origem não registrada')}</p><p>Último login registrado: ${date(u.last_sign_in_at, true)} · Origem: ${escape(u.origin || 'Não identificada')}</p><p>${escape((u.companies || []).map((c) => `${c.name} · ${LABELS[c.role] || c.role} · ${LABELS[c.plan] || c.plan || 'Sem plano'} · ${LABELS[c.subscription_status || c.status] || c.status}`).join(' / '))}</p><p>Primeiros passos: conta criada · ${(u.companies || []).length ? 'empresa vinculada' : 'ainda sem empresa'} · ${number(u.active_seconds) ? 'uso medido no período' : 'uso ainda não medido no período'}</p></section>
      <section class="oc-card"><h3>Dias com atividade medida</h3><p>Primeiro acesso medido: ${date(u.first_activity,true)} · Última atividade medida: ${date(u.last_activity,true)}</p><div class="oc-calendar">${(d.days || []).map((day) => `<div class="oc-day">${date(day.day)}<small>${duration(day.active_seconds)}</small></div>`).join('') || empty('Ainda não há dias medidos no período.')}</div><h3 class="oc-section">Áreas utilizadas</h3><p>${Object.entries(modules).map(([key, value]) => `${escape(MODULES[key] || 'Outra área')}: ${duration(value)}`).join(' · ') || 'Ainda não registrado.'}</p></section>
      <section class="oc-card"><h3>Últimas 20 sessões do período</h3><div class="oc-table-wrap"><table><thead><tr><th>Entrada</th><th>Último sinal</th><th>Encerramento</th><th>Tempo ativo</th></tr></thead><tbody>${(d.sessions || []).map((s) => `<tr><td>${date(s.started_at, true)}</td><td>${date(s.last_seen_at, true)}</td><td>${s.ended_at ? `${s.end_reason === 'logout' ? 'Saída confirmada' : 'Medição desativada'}: ${date(s.ended_at, true)}` : new Date(state.data.server_time) - new Date(s.last_seen_at) < 90000 ? 'Sinal recente' : 'Sem sinal; horário de saída desconhecido'}</td><td>${duration(s.active_seconds)}</td></tr>`).join('') || '<tr><td colspan="4">Nenhuma sessão medida.</td></tr>'}</tbody></table></div><p class="oc-legend">Fechar o aplicativo ou perder conexão não garante um registro de saída. O histórico de uso começa após a ativação e a permissão; detalhes ficam disponíveis por até 90 dias.</p></section>`;
  }
  function campaigns() {
    const rows = state.data.campaigns || [];
    return `<div class="oc-tools">${button('new-campaign', '+ Nova campanha', '', true)}${button('new-spend', 'Informar investimento')}${button('new-receipt', 'Registrar recebimento comercial')}</div>
      ${number(state.data.summary?.visits_unattributed) ? `<section class="oc-note oc-warning"><b>${number(state.data.summary.visits_unattributed)} visita(s) medida(s) sem campanha identificada.</b><p>Essas pessoas chegaram por um link comum. Para separar o resultado de cada anúncio, crie a campanha abaixo, copie o link identificado e use esse endereço no anúncio.</p></section>` : ''}
      ${state.link ? `<section class="oc-link-result"><b>Link identificado da campanha</b><input readonly aria-label="Link da campanha" value="${escape(state.link)}">${button('copy-link', 'Copiar link')}<small>Primeira campanha identificada neste navegador, por até 30 dias, somente com permissão. Use este link no anúncio.</small></section>` : ''}
      <div class="oc-campaign-list">${rows.map((c) => `<article class="oc-card oc-campaign"><div class="oc-toolbar"><div><h3>${escape(c.name)}</h3><small>${escape(c.source)}</small></div>${button('link','Ver link',c.id)}</div><div class="oc-campaign-summary">${[['Investido',cash(c.spent)],['Cadastros',number(c.signups)],['Desses, clientes',number(c.customers)],['Recebido no período*',cash(c.revenue)]].map(([label,value])=>`<div><small>${label}</small><b>${value}</b></div>`).join('')}</div><details><summary>Ver funil e custos</summary><div class="oc-campaign-summary">${[['Visitantes identificados*',number(c.visits)],['Interesses no WhatsApp',number(c.whatsapp)],['Desses cadastros, usaram',number(c.activated)],['Custo por cadastro',c.signups?cash(c.spent/c.signups):'—'],['Custo por cliente*',c.customers?cash(c.spent/c.customers):'—']].map(([label,value])=>`<div><small>${label}</small><b>${value}</b></div>`).join('')}</div></details></article>`).join('') || empty('Crie uma campanha para gerar seu primeiro link identificado.')}</div>
      <section class="oc-note"><b>Como ler os resultados</b><p>Cadastros são contas criadas no período. “Desses, usaram” acompanha esses cadastrados; “clientes” conta empresas deles com recebimento comercial registrado. Os resultados continuam amadurecendo depois do cadastro.</p><p>* Visitantes são navegadores identificados pela primeira visita, não todos os acessos nem pessoas únicas. Bloqueadores, falta de permissão e troca de aparelho reduzem a identificação. Custo/cliente é uma estimativa parcial: o gasto e a chegada do cliente podem ocorrer em períodos diferentes.</p><p>* Recebido soma os pagamentos manuais do período de clientes atribuídos, inclusive de cadastros anteriores, menos estornos. Não é lucro. Um clique no WhatsApp não é uma venda. Gastos não são importados automaticamente das plataformas.</p></section>
      <section class="oc-card"><h3>Últimos 100 recebimentos comerciais do período</h3><p>Registro separado das obras e da liberação de assinaturas. Use uma referência única para evitar duplicidade.</p><div class="oc-table-wrap"><table><thead><tr><th>Empresa</th><th>Data</th><th>Tipo</th><th>Valor</th><th>Referência</th></tr></thead><tbody>${(state.data.receipts || []).map((r) => `<tr><td>${escape(r.company)}</td><td>${date(r.day)}</td><td>${r.kind === 'refund' ? 'Estorno' : 'Recebimento'}</td><td>${cash(r.amount)}</td><td>${escape(r.reference)}</td></tr>`).join('') || '<tr><td colspan="5">Nenhum recebimento informado.</td></tr>'}</tbody></table></div></section>`;
  }
  function settings() {
    const active = state.data?.settings?.enabled;
    return `<div class="oc-grid"><section class="oc-card"><h3>Configurações da sua empresa</h3><p>Os controles anteriores continuam aqui, sem alterações de regras.</p><div class="oc-links">${[['company-overview', 'Resumo e configuração essencial'], ['access', 'Acessos, convites e permissões'], ['company', 'Dados e configurações da empresa'], ['subscription', 'Assinatura e exportação de dados'], ['security', 'Segurança e conta']].map(([key, label]) => button('settings-link', label, key)).join('')}${button('history', 'Histórico administrativo completo')}</div></section>
      <section class="oc-card"><h3>Medição de uso e campanhas</h3><p>Coleta: <b>${active ? 'ativada para quem permitir' : 'desativada ou aguardando banco'}</b></p><p>Ativação inicial: ${date(state.data?.settings?.enabled_at, true)}</p><p>Apenas módulos, tempo ativo estimado, sessões e origem de campanha. O usuário escolhe se permite; recusar não restringe o aplicativo.</p>${state.data ? button('toggle-collection', active ? 'Desativar coleta' : 'Ativar coleta opcional', active ? 'off' : 'on') : ''}${button('privacy', 'Minha preferência de privacidade')}<p class="oc-legend">A medição pública também exige configuração do servidor. Detalhes de uso: retenção de 90 dias; vínculos de origem e registros comerciais têm finalidade histórica. Não registra conteúdo operacional nem modifica permissões.</p></section></div>`;
  }
  function form() {
    const campaigns = state.data?.campaigns || [];
    const companies = state.receiptCompanies || [];
    const today = new Date().toLocaleDateString('en-CA');
    const input = (name, label, type = 'text', attrs = '') => `<label>${label}<input name="${name}" type="${type}" ${attrs} required></label>`;
    let body = '', title = '';
    if (state.form === 'campaign') {
      title = 'Nova campanha'; body = `${input('name', 'Nome para identificar', 'text', 'minlength="2" maxlength="100"')}${input('slug', 'Identificador do link (sem espaços)', 'text', 'pattern="[a-z0-9][a-z0-9_-]{1,63}" maxlength="64" placeholder="campanha-setembro"')}<label>Origem<select name="source"><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="google">Google</option><option value="whatsapp">WhatsApp</option><option value="other">Outra</option></select></label>`;
    } else if (state.form === 'spend') {
      title = 'Investimento por dia'; body = `<label>Campanha<select name="campaign" required><option value="">Selecione</option>${campaigns.map((c) => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('')}</select></label>${input('day', 'Data do gasto', 'date', `value="${today}" max="${today}"`)}${input('amount', 'Total gasto nesse dia (R$)', 'number', 'min="0" step="0.01" max="9999999999"')}<p class="oc-wide">Informe o total, não um acréscimo. Se já houver um valor nessa campanha e dia, a confirmação o substituirá. Zero também é permitido.</p>`;
    } else {
      title = 'Recebimento comercial manual'; body = `<label>Empresa cliente<select name="company" required><option value="">Selecione</option>${companies.map((c) => `<option value="${escape(c.company_id)}">${escape(c.company_name)}</option>`).join('')}</select></label>${input('day', 'Data', 'date', `value="${today}" max="${today}"`)}${input('amount', 'Valor recebido ou estornado (R$)', 'number', 'min="0.01" step="0.01" max="9999999999"')}<label>Tipo<select name="kind"><option value="payment">Recebimento</option><option value="refund">Estorno</option></select></label>${input('reference', 'Referência única do comprovante', 'text', 'minlength="3" maxlength="100"')}<p class="oc-wide">Não libera a assinatura e não altera pagamentos ou financeiro de nenhuma obra. Registre somente valores confirmados. Para corrigir um recebimento, registre um estorno e depois o valor correto.</p>`;
    }
    return `<section class="oc-card"><h3>${title}</h3><form class="oc-form" data-oc-form="${state.form}">${body}<footer class="oc-wide">${button('cancel', 'Cancelar')}<button type="submit" class="oc-primary">Conferir e salvar</button></footer></form></section>`;
  }
  function content() {
    const titles = { overview: ['Painel do proprietário', 'Usuários e resultados do produto, separados da rotina das obras.'], users: ['Usuários e atividade', 'Quem se cadastrou, voltou e começou a usar.'], campaigns: ['Resultados das campanhas', 'Do anúncio ao cliente, com a origem e os limites da medição claros.'], settings: ['Configurações e histórico', 'Cada controle no seu lugar. As funções existentes continuam disponíveis.'] };
    const [title, sub] = titles[state.tab] || titles.overview;
    const header = `<header class="oc-head"><div><h2>${title}</h2><p>${sub}</p>${state.data ? `<small>Última consulta: ${date(state.data.server_time,true)}</small>` : ''}</div><div class="oc-tools"><label>Período<select data-oc-period aria-label="Período dos indicadores">${[7, 30, 90].map((n) => `<option value="${n}" ${n === state.days ? 'selected' : ''}>Últimos ${n} dias</option>`).join('')}</select></label>${button('refresh', 'Atualizar')}</div></header>`;
    const error = state.error ? `<div class="oc-error" role="alert">${escape(state.error)} ${button('refresh', 'Tentar novamente')}</div>` : '';
    const notice = state.notice ? `<p class="oc-note" role="status">${escape(state.notice)}</p>` : '';
    if (state.busy) return `${header}<p role="status" aria-busy="true">Carregando informações…</p>`;
    const pending = state.data && !state.data.settings?.enabled ? '<div class="oc-note oc-warning">A coleta está desligada. Cadastros existentes podem aparecer, mas novos dados de uso só começam após ativação e permissão. Não há histórico de uso retroativo.</div>' : '';
    let body = state.tab === 'settings' ? settings() : !state.data ? '' : state.form ? form() : state.detail ? detail() : ({ overview, users, campaigns }[state.tab] || overview)();
    return `${header}${error}${notice}${pending}${body}`;
  }
  async function action(name, value) {
    reset(); if (!allowed() || state.busy) return;
    state.notice = '';
    if (name === 'refresh') { state.detail = null; await load(); return; }
    if (name.startsWith('nav-')) { window.openPermissionHub?.(`owner-${name.slice(4)}`); return; }
    if (name === 'settings-link') { window.openPermissionHub?.(value); return; }
    if (name === 'history') { window.openPermissionHub?.('commercial'); window.adminTab?.('audit'); return; }
    if (name === 'privacy') { window.ObraAtivaUsage?.openPrivacy(); return; }
    if (name === 'prev' || name === 'next') { state.offset = Math.max(0, state.offset + (name === 'next' ? 50 : -50)); await load(); return; }
    if (name === 'cancel' || name === 'back-user') { state.form = ''; state.detail = null; paint(); return; }
    if (name.startsWith('new-')) {
      state.form = name.slice(4) === 'receipt' ? 'receipt' : name.slice(4) === 'spend' ? 'spend' : 'campaign';
      if (state.form === 'receipt') {
        state.receiptCompanies = []; state.busy = true; paint();
        const user = state.user;
        try { const companies = await rpc('admin_list_companies_with_presence', { p_search: '' }); if (allowed() && user === window.CloudSync?.session?.user?.id) state.receiptCompanies = companies; }
        catch (error) { state.error = message(error); }
        finally { state.busy = false; }
      }
      paint(); document.querySelector('#oaOwnerPanel input, #oaOwnerPanel form select')?.focus(); return;
    }
    if (name === 'link') {
      const c = state.data.campaigns.find((c) => c.id === value); if (!c) return;
      const url = new URL(location.pathname, location.origin); url.search = new URLSearchParams({ produto: '1', utm_source: c.source, utm_medium: 'paid', utm_campaign: c.slug }).toString();
      state.link = url.href; paint(); return;
    }
    if (name === 'copy-link') { try { await navigator.clipboard.writeText(state.link); state.notice = 'Link copiado. Use no anúncio.'; } catch { state.notice = 'Selecione o link acima e copie.'; } paint(); return; }
    if (name === 'toggle-collection') {
      if (!confirm(value === 'on' ? 'Ativar a medição somente para usuários que permitirem? A configuração do servidor também precisa estar pronta.' : 'Parar novos registros de uso e campanha, preservando o histórico existente?')) return;
      try { await rpc('owner_insight_settings', { p_enabled: value === 'on' }); await load(); } catch (error) { state.error = message(error); paint(); } return;
    }
    if (name === 'user') {
      state.selected = state.data.users.find((u) => u.id === value); if (!state.selected) return;
      const user = state.user, request = ++state.request; state.busy = true; paint();
      try { const detail = await rpc('owner_insight_user', { p_user: value, p_days: state.days }); if (user === window.CloudSync?.session?.user?.id && request === state.request && allowed()) state.detail = detail; }
      catch (error) { state.error = message(error); }
      finally { if (request === state.request) { state.busy = false; paint(); document.getElementById('oaOwnerPanel')?.scrollIntoView({ block: 'start' }); } }
    }
  }
  document.addEventListener('click', (event) => {
    const target = event.target.closest?.('#oaOwnerPanel [data-oc-action]');
    if (target) { event.preventDefault(); action(target.dataset.ocAction, target.dataset.value).catch(() => {}); }
  });
  document.addEventListener('change', (event) => {
    if (!event.target.matches?.('#oaOwnerPanel [data-oc-period]') || !allowed()) return;
    state.days = Number(event.target.value); state.offset = 0; state.detail = null; state.form = ''; load();
  });
  document.addEventListener('submit', async (event) => {
    const form = event.target.closest?.('#oaOwnerPanel form[data-oc-form]'); if (!form) return;
    event.preventDefault(); if (!allowed() || state.busy || !form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form)), kind = form.dataset.ocForm;
    if (kind === 'search') { state.search = String(values.search).trim(); state.activity = values.activity || 'all'; state.offset = 0; await load(); return; }
    const calls = {
      campaign: ['owner_campaign_save', { p_name: values.name, p_slug: values.slug, p_source: values.source }],
      spend: ['owner_campaign_spend', { p_campaign: values.campaign, p_day: values.day, p_amount: Number(values.amount) }],
      receipt: ['owner_campaign_receipt', { p_id: crypto.randomUUID(), p_company: values.company, p_day: values.day, p_amount: Number(values.amount), p_kind: values.kind, p_reference: values.reference }]
    };
    if (!calls[kind]) return;
    if (!confirm(kind === 'spend' ? `Salvar ${cash(values.amount)} como TOTAL gasto em ${date(values.day)}? Substitui o valor anterior dessa campanha e dia, se existir.` : kind === 'receipt' ? `Registrar ${values.kind === 'refund' ? 'estorno' : 'recebimento'} de ${cash(values.amount)}? Não altera o financeiro das obras nem libera a assinatura.` : `Criar a campanha “${values.name}”?`)) return;
    const submit = form.querySelector('[type=submit]'); state.busy = true; submit.disabled = true; submit.textContent = 'Salvando…';
    try {
      await rpc(...calls[kind]); state.form = ''; state.notice = 'Registro salvo com sucesso.';
      window.ObraAtivaActionFeedback?.success('Registro comercial salvo');
    } catch (error) { state.error = message(error); }
    finally { state.busy = false; if (state.form) { submit.disabled = false; submit.textContent = 'Conferir e salvar'; const notice = document.createElement('p'); notice.setAttribute('role', 'alert'); notice.textContent = state.error; form.prepend(notice); } else await load(); }
  });
  window.ObraAtivaOwnerCenter = {
    render(tab = 'overview') {
      reset(); if (!allowed()) return '';
      if (state.tab !== tab) { state.tab = tab; state.form = ''; state.detail = null; state.error = ''; state.notice = ''; }
      if (!state.data && !state.busy && !state.error) setTimeout(load, 0);
      return `<section class="oa-owner" id="oaOwnerPanel">${content()}</section>`;
    }
  };
  // Atualiza presença sem piscar a tela, sem polling fora do painel e sem apagar rascunhos.
  setInterval(() => {
    if (allowed() && state.data && !state.error && !state.busy && !state.form && !state.detail && ['overview','users'].includes(state.tab)
      && document.getElementById('oaOwnerPanel') && document.visibilityState === 'visible' && document.hasFocus()
      && !document.activeElement?.matches('input,textarea,select,button')) load(true);
  }, 60000);
})();
