(() => {
  'use strict';

  const STYLE_ID = 'permissionHubV2Style';
  const PLAN_NAMES = { essential: 'Essencial', builder: 'Construtora', professional: 'Profissional', custom: 'Personalizado' };
  const PLAN_LIMITS = { essential: [2, 3], builder: [5, 10], professional: [15, 25], custom: ['Sem limite', 'Sem limite'] };
  let installed = false;
  let permissionHubTab = 'overview';
  let teamSnapshot = null;

  function safe(value, fallback = '—') {
    const normalized = value === undefined || value === null || value === '' ? fallback : String(value);
    return typeof escapeHtml === 'function' ? escapeHtml(normalized) : normalized;
  }

  function workspace() {
    return typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace : null;
  }

  function settings() {
    return typeof db !== 'undefined' ? (db.settings || {}) : {};
  }

  function currentPlan() {
    const subscription = workspace()?.current?.subscription || {};
    const usage = workspace()?.current?.usage || {};
    const limits = PLAN_LIMITS[subscription.plan] || ['—', '—'];
    return {
      subscription,
      usage,
      limits,
      name: PLAN_NAMES[subscription.plan] || 'Teste',
      status: workspace()?.statusLabel?.(subscription.status) || subscription.status || '—'
    };
  }

  function activeCount(name) {
    if (typeof db === 'undefined' || !Array.isArray(db[name])) return 0;
    if (name === 'works') return db[name].filter((item) => item.status !== 'Finalizada').length;
    if (name === 'employees') return db[name].filter((item) => item.active !== false).length;
    return db[name].length;
  }

  function setupItems() {
    const value = settings();
    return [
      ['Nome da empresa', Boolean(value.company), 'company'],
      ['Responsável', Boolean(value.responsible), 'company'],
      ['WhatsApp', Boolean(value.phone), 'company'],
      ['Ciclo de pagamento', Boolean(value.cycleStart), 'company'],
      ['Logo da empresa', Boolean(value.companyLogo), 'company'],
      ['Equipe com acesso', Boolean((teamSnapshot?.members || []).length || currentPlan().usage.active_users), 'access']
    ];
  }

  function setupProgress() {
    const items = setupItems();
    return Math.round(items.filter((item) => item[1]).length / items.length * 100);
  }

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="${STYLE_ID}">
      #app:not(.public-app) .permission-hub{display:grid;gap:12px;max-width:1500px;margin:0 auto}
      #app:not(.public-app) .permission-hub-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 20px;border:1px solid #174e80;border-radius:16px;background:linear-gradient(125deg,#0a385c,#0d6a58);color:#fff;box-shadow:0 12px 28px #0a355d18}
      #app:not(.public-app) .permission-hub-hero small{display:block;margin-bottom:3px;color:#a9e6ce;font-size:9px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
      #app:not(.public-app) .permission-hub-hero h1{margin:0;color:#fff;font-size:clamp(21px,2.1vw,29px);letter-spacing:-.035em}
      #app:not(.public-app) .permission-hub-hero p{max-width:650px;margin:4px 0 0;color:#dcecf0;font-size:12px;line-height:1.4}
      #app:not(.public-app) .permission-hub-owner{display:flex;align-items:center;gap:8px;flex:none;padding:8px 11px;border:1px solid #ffffff38;border-radius:11px;background:#ffffff12;font-size:11px;font-weight:800}
      #app:not(.public-app) .permission-hub-owner i{width:8px;height:8px;border-radius:50%;background:#36da8b;box-shadow:0 0 0 4px #36da8b22}
      #app:not(.public-app) .permission-hub-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px 1px 5px;scrollbar-width:none}
      #app:not(.public-app) .permission-hub-tabs::-webkit-scrollbar{display:none}
      #app:not(.public-app) .permission-hub-tabs button{display:flex;align-items:center;gap:7px;flex:0 0 auto;min-height:39px;padding:8px 12px;border:1px solid #d7e2e9;border-radius:10px;background:#fff;color:#526572;font-size:11px;font-weight:850;white-space:nowrap;transition:.18s ease}
      #app:not(.public-app) .permission-hub-tabs button:hover{transform:translateY(-1px);border-color:#9ac0d6;box-shadow:0 5px 12px #19486b10}
      #app:not(.public-app) .permission-hub-tabs button.active{border-color:#1c79c2;background:#eaf5ff;color:#125f9c;box-shadow:inset 0 -2px #1c79c2}
      #app:not(.public-app) .permission-hub-tabs button.commercial{border-color:#f0d2a8;background:#fff9ef;color:#87561f}
      #app:not(.public-app) .permission-hub-tabs button.commercial.active{border-color:#d89130;background:#fff1d9;box-shadow:inset 0 -2px #d89130}
      #app:not(.public-app) .permission-hub-content{min-width:0}
      #app:not(.public-app) .permission-hub-card{padding:16px;border:1px solid #dce6e7;border-radius:14px;background:#fff;box-shadow:0 7px 18px #17425d09}
      #app:not(.public-app) .permission-hub-card h2,#app:not(.public-app) .permission-hub-card h3{margin:0 0 5px;color:#173f4b}
      #app:not(.public-app) .permission-hub-card h2{font-size:17px}#app:not(.public-app) .permission-hub-card h3{font-size:14px}
      #app:not(.public-app) .permission-hub-card p{margin:0;color:var(--muted);font-size:11px;line-height:1.45}
      #app:not(.public-app) .permission-hub-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px}
      #app:not(.public-app) .permission-hub-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:11px}
      #app:not(.public-app) .permission-hub-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
      #app:not(.public-app) .permission-hub-stat{min-width:0;padding:13px 14px;border:1px solid #dce6e7;border-radius:13px;background:#fff}
      #app:not(.public-app) .permission-hub-stat small{display:block;color:#60757a;font-size:8px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
      #app:not(.public-app) .permission-hub-stat b{display:block;overflow:hidden;margin:5px 0 2px;color:#124453;font-size:20px;text-overflow:ellipsis;white-space:nowrap}
      #app:not(.public-app) .permission-hub-stat span{display:block;color:#6f8185;font-size:9px;line-height:1.3}
      #app:not(.public-app) .permission-hub-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #app:not(.public-app) .permission-hub-action{display:flex;align-items:center;gap:10px;min-width:0;padding:11px;border:1px solid #dfe8e9;border-radius:11px;background:#fbfdfd;text-align:left;transition:.18s ease}
      #app:not(.public-app) .permission-hub-action:hover{transform:translateY(-1px);border-color:#88b9ab;background:#f5fcf9}
      #app:not(.public-app) .permission-hub-action>span:first-child{display:grid;place-items:center;width:34px;height:34px;flex:none;border-radius:10px;background:#e9f5f1;font-size:17px}
      #app:not(.public-app) .permission-hub-action b{display:block;color:#173f4b;font-size:11px}.permission-hub-action small{display:block;margin-top:2px;color:#728487;font-size:9px}
      #app:not(.public-app) .permission-hub-checklist{display:grid;gap:6px}
      #app:not(.public-app) .permission-hub-check{display:grid;grid-template-columns:20px 1fr auto;align-items:center;gap:7px;padding:8px;border-radius:9px;background:#f7faf9;font-size:10px}
      #app:not(.public-app) .permission-hub-check i{display:grid;place-items:center;width:19px;height:19px;border-radius:50%;background:#dce8e6;color:#627b78;font-style:normal;font-weight:900}
      #app:not(.public-app) .permission-hub-check.done i{background:#dff5e9;color:#168653}.permission-hub-check button{padding:4px 6px;background:transparent;color:#176db2;font-size:9px;font-weight:800}
      #app:not(.public-app) .permission-hub-progress{height:6px;margin:8px 0 12px;overflow:hidden;border-radius:99px;background:#e5eeec}.permission-hub-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#168b60,#1a78c2)}
      #app:not(.public-app) .permission-hub-info{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
      #app:not(.public-app) .permission-hub-info div{min-width:0;padding:11px;border:1px solid #e1e9e9;border-radius:10px;background:#fafcfc}
      #app:not(.public-app) .permission-hub-info small{display:block;color:#6d8084;font-size:8px;font-weight:850;text-transform:uppercase}.permission-hub-info b{display:block;overflow:hidden;margin-top:3px;color:#173f4b;font-size:11px;text-overflow:ellipsis;white-space:nowrap}
      #app:not(.public-app) .permission-hub-buttons{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.permission-hub-buttons .btn{min-height:39px;white-space:normal}
      #app:not(.public-app) .permission-hub-note{padding:10px 12px;border:1px solid #d7e9e1;border-radius:10px;background:#f2fbf7;color:#315f52;font-size:10px;line-height:1.45}
      #app:not(.public-app) .permission-hub-commercial-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}.permission-hub-exclusive{padding:4px 7px;border-radius:99px;background:#fff1d8;color:#89571f;font-size:8px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
      #app:not(.public-app) .commercial-dashboard{display:grid;gap:10px}
      #app:not(.public-app) .commercial-priorities{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      #app:not(.public-app) .commercial-priority{display:grid;grid-template-columns:31px 1fr;align-items:center;gap:9px;min-width:0;padding:11px;border:1px solid #e5dfd2;border-radius:11px;background:#fff}
      #app:not(.public-app) .commercial-priority>span{display:grid;place-items:center;width:31px;height:31px;border-radius:9px;background:#fff3dc;font-size:15px}.commercial-priority small{display:block;color:#7c7468;font-size:8px;font-weight:900;text-transform:uppercase}.commercial-priority b{display:block;margin-top:2px;color:#56462e;font-size:18px}
      #app:not(.public-app) .commercial-pipeline{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}
      #app:not(.public-app) .commercial-stage{min-width:0;padding:10px;border:1px solid #dfe7e8;border-radius:10px;background:#fafcfc;text-align:left}.commercial-stage:hover{border-color:#d6a65e;background:#fffaf0}.commercial-stage small{display:block;color:#6d7d80;font-size:8px;font-weight:900}.commercial-stage b{display:block;margin-top:4px;color:#164555;font-size:19px}.commercial-stage span{display:block;overflow:hidden;margin-top:2px;color:#79888a;font-size:8px;text-overflow:ellipsis;white-space:nowrap}
      #app:not(.public-app) .commercial-columns{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}
      #app:not(.public-app) .commercial-list{display:grid;gap:6px}
      #app:not(.public-app) .commercial-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:9px;border:1px solid #e3e9e9;border-radius:9px;background:#fbfcfc}.commercial-row b{display:block;overflow:hidden;color:#1c4651;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.commercial-row small{display:block;margin-top:2px;color:#788788;font-size:8px;line-height:1.35}.commercial-row-actions{display:flex;gap:5px}.commercial-row-actions .btn{min-height:29px;padding:4px 7px;font-size:9px}.commercial-empty{padding:15px;border:1px dashed #cdddda;border-radius:9px;color:#4c7168;background:#f7fbfa;font-size:10px;text-align:center}
      #app:not(.public-app) .commercial-toolbar{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px}.commercial-toolbar .btn{min-height:34px}
      #app:not(.public-app) .commercial-quality-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}.commercial-quality-summary div{padding:8px;border-radius:8px;background:#fff8ec;color:#7a5830}.commercial-quality-summary small{display:block;font-size:7px;font-weight:900;text-transform:uppercase}.commercial-quality-summary b{display:block;margin-top:2px;font-size:16px}
      #app:not(.public-app) .commercial-plan-list{display:grid;gap:8px}.commercial-plan-row{display:grid;grid-template-columns:90px minmax(0,1fr) 24px;align-items:center;gap:7px;font-size:9px}.commercial-plan-row b{overflow:hidden;color:#294c57;text-overflow:ellipsis;white-space:nowrap}.commercial-plan-track{height:7px;overflow:hidden;border-radius:99px;background:#e7eeee}.commercial-plan-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#1a75bd,#1aa066)}.commercial-plan-row>span:last-child{color:#63787c;font-weight:900;text-align:right}
      #app:not(.public-app) .commercial-tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid #e5eceb}.commercial-tools .btn{min-height:32px;padding:5px 8px;font-size:9px}
      #app:not(.public-app) .permission-hub-access>.section{margin:0}.permission-hub-access>.section+.section{margin-top:10px}.permission-hub-access .grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.permission-hub-access .card{padding:13px}
      #app:not(.public-app) .top #cloudTopActions,#app:not(.public-app) .top .top-settings-button,#app:not(.public-app) .top .landscape-top-company-logo{display:none!important}
      @media(max-width:1100px){#app:not(.public-app) .permission-hub-stats{grid-template-columns:repeat(2,minmax(0,1fr))}#app:not(.public-app) .permission-hub-info{grid-template-columns:repeat(2,minmax(0,1fr))}#app:not(.public-app) .commercial-priorities{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:900px){#app:not(.public-app) .permission-hub{gap:9px}#app:not(.public-app) .permission-hub-hero{padding:12px 14px;border-radius:13px}#app:not(.public-app) .permission-hub-hero p{display:none}#app:not(.public-app) .permission-hub-grid,#app:not(.public-app) .commercial-columns{grid-template-columns:1fr}#app:not(.public-app) .permission-hub-card{padding:12px}#app:not(.public-app) .permission-hub-access .grid{grid-template-columns:repeat(2,minmax(0,1fr))}#app:not(.public-app) .commercial-pipeline{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:680px){#app:not(.public-app) .permission-hub-owner{display:none}#app:not(.public-app) .permission-hub-actions,#app:not(.public-app) .permission-hub-info{grid-template-columns:1fr}#app:not(.public-app) .permission-hub-access .grid{grid-template-columns:1fr}#app:not(.public-app) .commercial-quality-summary{grid-template-columns:1fr 1fr 1fr}.commercial-plan-row{grid-template-columns:74px minmax(0,1fr) 20px}}
    </style>`);
  }

  function hero() {
    const name = settings().company || workspace()?.current?.company?.name || 'Sua empresa';
    const role = workspace()?.roleLabel?.(workspace()?.current?.role) || 'Administrador';
    return `<header class="permission-hub-hero"><div><small>Central de gestão</small><h1>Administrador</h1><p>Controle os acessos, dados da empresa, assinatura, segurança e configurações em um único lugar.</p></div><div class="permission-hub-owner"><i></i><span>${safe(name)} · ${safe(role)}</span></div></header>`;
  }

  function tabs() {
    const basic = [['overview', '⌂', 'Visão geral'], ['access', '👥', 'Acessos'], ['company', '🏢', 'Empresa'], ['subscription', '💳', 'Assinatura'], ['security', '🔒', 'Segurança']];
    return `<nav class="permission-hub-tabs" aria-label="Áreas do administrador">${basic.map(([key, icon, label]) => `<button class="${permissionHubTab === key ? 'active' : ''}" type="button" onclick="openPermissionHub('${key}')"><span>${icon}</span>${label}</button>`).join('')}${window.CloudSync?.isSalesAdmin ? `<button class="commercial ${permissionHubTab === 'commercial' ? 'active' : ''}" type="button" onclick="openPermissionHub('commercial')"><span>📈</span>Área comercial · somente você</button>` : ''}</nav>`;
  }

  function stats() {
    const plan = currentPlan();
    const members = teamSnapshot?.members?.filter((item) => item.status !== 'inactive').length ?? plan.usage.active_users ?? 0;
    return `<section class="permission-hub-stats"><article class="permission-hub-stat"><small>Empresa</small><b>${safe(settings().company, 'Não configurada')}</b><span>identidade e dados gerais</span></article><article class="permission-hub-stat"><small>Pessoas com acesso</small><b>${members}</b><span>de ${safe(plan.limits[1])} no plano</span></article><article class="permission-hub-stat"><small>Assinatura</small><b>${safe(plan.name)}</b><span>${safe(plan.status)}</span></article><article class="permission-hub-stat"><small>Configuração</small><b>${setupProgress()}%</b><span>itens essenciais completos</span></article></section>`;
  }

  function quickAction(icon, title, detail, action) {
    return `<button class="permission-hub-action" type="button" onclick="${action}"><span>${icon}</span><span><b>${title}</b><small>${detail}</small></span></button>`;
  }

  function overviewPanel() {
    const progress = setupProgress();
    return `${stats()}<div class="permission-hub-grid"><section class="permission-hub-card"><div class="permission-hub-card-head"><div><h2>Ações do administrador</h2><p>Atalhos para as tarefas de configuração mais usadas.</p></div></div><div class="permission-hub-actions">${quickAction('👤', 'Gerenciar acessos', 'Convites, usuários e perfis', "openPermissionHub('access')")}${quickAction('🏢', 'Dados da empresa', 'Nome, contato, logo e ciclo', "openPermissionHub('company')")}${quickAction('💳', 'Ver assinatura', 'Plano, limites e uso atual', "openPermissionHub('subscription')")}${quickAction('💾', 'Exportar segurança', 'Baixar uma cópia dos dados', 'exportPermissionSubscriptionData()')}</div></section><section class="permission-hub-card"><h2>Configuração essencial</h2><p>${progress}% concluída</p><div class="permission-hub-progress"><i style="width:${progress}%"></i></div><div class="permission-hub-checklist">${setupItems().map(([label, done, target]) => `<div class="permission-hub-check ${done ? 'done' : ''}"><i>${done ? '✓' : '!'}</i><span>${safe(label)}</span><button type="button" onclick="openPermissionHub('${target}')">${done ? 'Revisar' : 'Configurar'}</button></div>`).join('')}</div></section></div>`;
  }

  function accessPanel(originalPermissionCenter) {
    setTimeout(() => typeof loadPermissionInvitePanel === 'function' && loadPermissionInvitePanel(), 0);
    return `<div class="permission-hub-access">${originalPermissionCenter()}</div>`;
  }

  function companyPanel() {
    const value = settings();
    return `<section class="permission-hub-card"><div class="permission-hub-card-head"><div><h2>Dados e funcionamento da empresa</h2><p>Estas informações alimentam a rotina, os documentos e a identidade exibida pelo aplicativo.</p></div><button class="btn sm" type="button" onclick="openPermissionCompanySettings()">Editar dados</button></div><div class="permission-hub-info"><div><small>Nome da empresa</small><b>${safe(value.company)}</b></div><div><small>Responsável</small><b>${safe(value.responsible)}</b></div><div><small>WhatsApp da empresa</small><b>${safe(value.phone)}</b></div><div><small>WhatsApp comercial</small><b>${safe(value.salesWhatsapp)}</b></div><div><small>Início do ciclo</small><b>${value.cycleStart ? new Date(`${value.cycleStart}T12:00:00`).toLocaleDateString('pt-BR') : 'Não configurado'}</b></div><div><small>Identidade visual</small><b>${value.companyLogo ? 'Logo configurada' : 'Usando logo do aplicativo'}</b></div><div><small>Obras em andamento</small><b>${activeCount('works')}</b></div><div><small>Funcionários ativos</small><b>${activeCount('employees')}</b></div></div><div class="permission-hub-buttons"><button class="btn" type="button" onclick="openPermissionCompanySettings()">⚙️ Abrir configurações da empresa</button></div></section><section class="permission-hub-note"><b>Configuração centralizada:</b> alterações só são aplicadas depois que você abre o formulário existente e confirma em “Salvar configurações”. Nenhuma regra operacional foi duplicada.</section>`;
  }

  function subscriptionPanel() {
    const plan = currentPlan();
    const endDate = plan.subscription.trial_ends_at ? new Date(plan.subscription.trial_ends_at).toLocaleDateString('pt-BR') : 'Não se aplica';
    return `<section class="permission-hub-card"><div class="permission-hub-card-head"><div><h2>Assinatura e capacidade</h2><p>Acompanhe o plano atual e quanto da capacidade contratada está em uso.</p></div><span class="badge b">${safe(plan.status)}</span></div><div class="permission-hub-info"><div><small>Plano atual</small><b>${safe(plan.name)}</b></div><div><small>Obras ativas</small><b>${plan.usage.active_works || 0} de ${safe(plan.limits[0])}</b></div><div><small>Usuários ativos</small><b>${plan.usage.active_users || 0} de ${safe(plan.limits[1])}</b></div><div><small>Fotos registradas</small><b>${plan.usage.photo_count || 0}</b></div><div><small>Fim do teste</small><b>${safe(endDate)}</b></div><div><small>Dados da empresa</small><b>Privados e separados</b></div></div><div class="permission-hub-buttons"><button class="btn alt" type="button" onclick="exportPermissionSubscriptionData()">💾 Exportar meus dados</button><button class="btn" type="button" onclick="openPermissionSubscriptionDetails()">Abrir detalhes da assinatura</button></div></section>`;
  }

  function securityPanel() {
    const email = window.CloudSync?.session?.user?.email || '';
    const role = workspace()?.roleLabel?.(workspace()?.current?.role) || workspace()?.current?.role;
    return `<div class="permission-hub-grid"><section class="permission-hub-card"><h2>Conta e sessão</h2><p>Informações da conta conectada neste dispositivo.</p><div class="permission-hub-info" style="margin-top:12px"><div><small>E-mail conectado</small><b>${safe(email, 'Sessão local')}</b></div><div><small>Perfil na empresa</small><b>${safe(role)}</b></div><div><small>Nuvem</small><b>${window.CloudSync?.ready ? 'Conectada' : 'Verificando conexão'}</b></div></div><div class="permission-hub-buttons"><button class="btn alt" type="button" onclick="exportPermissionSubscriptionData()">Exportar dados</button></div></section><section class="permission-hub-card"><h2>Privacidade e proteção</h2><p>Os registros da empresa são separados por conta e as permissões definem quem pode acessar cada área.</p><div class="permission-hub-note" style="margin-top:12px">A exclusão da conta é uma ação separada e exige confirmação. Ela nunca acontece ao sair do aplicativo.</div><div class="permission-hub-buttons"><button class="btn danger" type="button" onclick="openPermissionAccountDeletion()">Solicitar exclusão da conta</button></div></section></div>`;
  }

  function dateKey(value) {
    if (!value) return '';
    const parsed = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }

  function dayDistance(value) {
    const key = dateKey(value);
    if (!key) return null;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.ceil((new Date(`${key}T12:00:00`) - today) / 86400000);
  }

  function commercialDate(value) {
    const key = dateKey(value);
    return key ? new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data';
  }

  function isOpenLead(lead) {
    return !['Resolvido', 'Não fechado'].includes(String(lead?.status || ''));
  }

  function dueLabel(days) {
    if (days === null) return 'Sem próxima ação';
    if (days < 0) return `${Math.abs(days)} dia(s) em atraso`;
    if (days === 0) return 'Retorno para hoje';
    return `Retorno em ${days} dia(s)`;
  }

  function commercialPlanLabel(value) {
    const key = String(value || '').trim().toLocaleLowerCase('pt-BR');
    return PLAN_NAMES[key] || (key ? key[0].toLocaleUpperCase('pt-BR') + key.slice(1) : 'Sem plano');
  }

  function commercialCsvCell(value) {
    let normalized = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    if (/^[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  function commercialSummaryText() {
    if (typeof AdminCenter === 'undefined') return '';
    const leads = Array.isArray(AdminCenter.leads) ? AdminCenter.leads : [];
    const companies = Array.isArray(AdminCenter.companies) ? AdminCenter.companies : [];
    const openLeads = leads.filter(isOpenLead);
    const due = openLeads.filter((lead) => { const days = dayDistance(lead.next_action_at); return days !== null && days <= 0; }).length;
    const withoutAction = openLeads.filter((lead) => !dateKey(lead.next_action_at)).length;
    const renewals = companies.filter((company) => { const days = dayDistance(company.ends_at); return days !== null && days <= 14; }).length;
    return [`Resumo comercial do ObraAtiva — ${new Date().toLocaleDateString('pt-BR')}`, `Contatos abertos: ${openLeads.length}`, `Retornos vencidos ou para hoje: ${due}`, `Contatos sem próxima ação: ${withoutAction}`, `Renovações em até 14 dias: ${renewals}`, `Empresas na carteira: ${companies.length}`].join('\n');
  }

  function exportCommercialReport() {
    if (typeof AdminCenter === 'undefined') return false;
    const leads = Array.isArray(AdminCenter.leads) ? AdminCenter.leads : [];
    const companies = Array.isArray(AdminCenter.companies) ? AdminCenter.companies : [];
    const header = ['Tipo', 'Nome', 'Empresa', 'E-mail', 'Telefone', 'Plano', 'Status', 'Próxima ação', 'Vencimento'];
    const rows = [
      ...leads.map((lead) => ['Contato', lead.name, lead.company, lead.email, lead.phone, commercialPlanLabel(lead.plan), lead.status, dateKey(lead.next_action_at), '']),
      ...companies.map((company) => ['Empresa', company.responsible, company.company_name, company.owner_email, '', commercialPlanLabel(company.plan), company.subscription_status, '', dateKey(company.ends_at)])
    ];
    const csv = `\ufeff${[header, ...rows].map((row) => row.map(commercialCsvCell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `obraativa-comercial-${new Date().toISOString().slice(0, 10)}.csv`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    return true;
  }

  async function copyCommercialSummary() {
    const summary = commercialSummaryText();
    if (!summary) return false;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(summary);
      else {
        const area = document.createElement('textarea');
        area.value = summary;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      alert('Resumo comercial copiado.');
      return true;
    } catch (error) {
      alert('Não foi possível copiar o resumo neste dispositivo.');
      return false;
    }
  }

  function commercialDashboard() {
    const leads = Array.isArray(AdminCenter.leads) ? AdminCenter.leads : [];
    const companies = Array.isArray(AdminCenter.companies) ? AdminCenter.companies : [];
    const openLeads = leads.filter(isOpenLead);
    const due = openLeads.filter((lead) => {
      const days = dayDistance(lead.next_action_at);
      return days !== null && days <= 0;
    }).sort((a, b) => dateKey(a.next_action_at).localeCompare(dateKey(b.next_action_at)));
    const withoutAction = openLeads.filter((lead) => !dateKey(lead.next_action_at));
    const followUps = [...due, ...openLeads.filter((lead) => {
      const days = dayDistance(lead.next_action_at);
      return days !== null && days > 0 && days <= 7;
    }).sort((a, b) => dateKey(a.next_action_at).localeCompare(dateKey(b.next_action_at))), ...withoutAction].slice(0, 5);
    const renewals = companies.filter((company) => {
      const days = dayDistance(company.ends_at);
      return days !== null && days <= 14 && ['active', 'trial', 'payment_due'].includes(String(company.subscription_status || ''));
    }).sort((a, b) => dateKey(a.ends_at).localeCompare(dateKey(b.ends_at))).slice(0, 5);
    const stages = [
      ['Novos', ['Novo contato']],
      ['Em conversa', ['Em conversa']],
      ['Pagamento', ['Pagamento pendente', 'Pagamento confirmado']],
      ['Atendimento', ['Em atendimento']],
      ['Resolvidos', ['Resolvido']]
    ];
    const attention = Number(AdminCenter.summary?.attention || 0);
    const priorityCards = [
      ['⏰', 'Retornos vencidos/hoje', due.length],
      ['📌', 'Sem próxima ação', withoutAction.length],
      ['💳', 'Renovações em 14 dias', renewals.length],
      ['⚠️', 'Assinaturas em atenção', attention]
    ];
    const quality = {
      phone: openLeads.filter((lead) => !String(lead.phone || '').trim()).length,
      email: openLeads.filter((lead) => !String(lead.email || '').trim()).length,
      action: withoutAction.length
    };
    const incomplete = openLeads.filter((lead) => !String(lead.phone || '').trim() || !String(lead.email || '').trim() || !dateKey(lead.next_action_at)).slice(0, 5);
    const planCounts = companies.reduce((result, company) => {
      const plan = commercialPlanLabel(company.plan);
      result[plan] = (result[plan] || 0) + 1;
      return result;
    }, {});
    const maxPlanCount = Math.max(1, ...Object.values(planCounts));
    const followUpMarkup = followUps.length ? followUps.map((lead) => {
      const days = dayDistance(lead.next_action_at);
      return `<div class="commercial-row"><span><b>${safe(lead.company || lead.name, 'Contato sem nome')}</b><small>${safe(lead.status, 'Novo contato')} · ${dueLabel(days)}</small></span><span class="commercial-row-actions"><button class="btn sm alt" type="button" onclick="adminOpenLead('${safe(lead.id, '')}')">Abrir</button>${lead.phone ? `<button class="btn sm" type="button" onclick="adminOpenLeadWhatsapp('${safe(lead.id, '')}')">WhatsApp</button>` : ''}</span></div>`;
    }).join('') : '<div class="commercial-empty">Nenhum retorno comercial precisa de atenção nos próximos 7 dias.</div>';
    const renewalMarkup = renewals.length ? renewals.map((company) => {
      const days = dayDistance(company.ends_at);
      const situation = days < 0 ? `Vencida há ${Math.abs(days)} dia(s)` : days === 0 ? 'Vence hoje' : `Vence em ${days} dia(s)`;
      return `<div class="commercial-row"><span><b>${safe(company.company_name, 'Empresa sem nome')}</b><small>${safe(company.plan, 'Plano não informado')} · ${situation} · ${commercialDate(company.ends_at)}</small></span><span class="commercial-row-actions"><button class="btn sm alt" type="button" onclick="adminOpenSubscription('${safe(company.company_id, '')}')">Gerenciar</button></span></div>`;
    }).join('') : '<div class="commercial-empty">Nenhuma assinatura vence nos próximos 14 dias.</div>';
    const qualityMarkup = incomplete.length ? incomplete.map((lead) => { const missing = [!lead.phone && 'telefone', !lead.email && 'e-mail', !dateKey(lead.next_action_at) && 'próxima ação'].filter(Boolean).join(', '); return `<div class="commercial-row"><span><b>${safe(lead.company || lead.name, 'Contato sem nome')}</b><small>Completar: ${safe(missing)}</small></span><span class="commercial-row-actions"><button class="btn sm alt" type="button" onclick="adminOpenLead('${safe(lead.id, '')}')">Completar</button></span></div>`; }).join('') : '<div class="commercial-empty">Todos os contatos abertos possuem telefone, e-mail e próxima ação.</div>';
    const planMarkup = Object.keys(planCounts).length ? Object.entries(planCounts).sort((a, b) => b[1] - a[1]).map(([plan, count]) => `<div class="commercial-plan-row"><b>${safe(plan)}</b><span class="commercial-plan-track"><i style="width:${Math.round(count / maxPlanCount * 100)}%"></i></span><span>${count}</span></div>`).join('') : '<div class="commercial-empty">A distribuição aparecerá quando houver empresas cadastradas.</div>';
    return `<div class="commercial-dashboard"><section class="commercial-priorities">${priorityCards.map(([icon, label, value]) => `<article class="commercial-priority"><span>${icon}</span><div><small>${label}</small><b>${value}</b></div></article>`).join('')}</section><section class="permission-hub-card"><div class="permission-hub-card-head"><div><h2>Funil comercial</h2><p>Quantidade atual em cada etapa. Abra Vendas e atendimento para editar um contato.</p></div><div class="commercial-toolbar"><button class="btn sm" type="button" onclick="adminOpenLead()">+ Novo contato</button><button class="btn sm alt" type="button" onclick="adminLoad(true)">↻ Atualizar</button></div></div><div class="commercial-pipeline">${stages.map(([label, values]) => { const total = leads.filter((lead) => values.includes(String(lead.status || ''))).length; return `<button class="commercial-stage" type="button" onclick="adminTab('sales')"><small>${label}</small><b>${total}</b><span>${values.join(' + ')}</span></button>`; }).join('')}</div></section><div class="commercial-columns"><section class="permission-hub-card"><div class="permission-hub-card-head"><div><h2>Agenda de retornos</h2><p>Vencidos, de hoje, dos próximos 7 dias e contatos sem data.</p></div><button class="btn sm alt" type="button" onclick="adminTab('sales')">Ver todos</button></div><div class="commercial-list">${followUpMarkup}</div></section><section class="permission-hub-card"><div class="permission-hub-card-head"><div><h2>Renovações próximas</h2><p>Assinaturas vencidas ou com vencimento em até 14 dias.</p></div><button class="btn sm alt" type="button" onclick="adminTab('companies')">Ver clientes</button></div><div class="commercial-list">${renewalMarkup}</div></section></div><div class="commercial-columns"><section class="permission-hub-card"><div class="permission-hub-card-head"><div><h2>Qualidade dos cadastros</h2><p>Dados que faltam para não perder contatos nem próximos passos.</p></div><button class="btn sm alt" type="button" onclick="adminTab('sales')">Abrir contatos</button></div><div class="commercial-quality-summary"><div><small>Sem telefone</small><b>${quality.phone}</b></div><div><small>Sem e-mail</small><b>${quality.email}</b></div><div><small>Sem ação</small><b>${quality.action}</b></div></div><div class="commercial-list">${qualityMarkup}</div></section><section class="permission-hub-card"><div class="permission-hub-card-head"><div><h2>Carteira por plano</h2><p>Distribuição atual das empresas cadastradas.</p></div></div><div class="commercial-plan-list">${planMarkup}</div><div class="commercial-tools"><button class="btn alt" type="button" onclick="exportCommercialReport()">⬇ Exportar relatório CSV</button><button class="btn alt" type="button" onclick="copyCommercialSummary()">📋 Copiar resumo do dia</button></div></section></div><section class="permission-hub-note"><b>Controle seguro:</b> este painel apenas organiza os dados comerciais já registrados. Liberações, renovações, exclusões e mudanças de plano continuam exigindo a ação e a confirmação do proprietário.</section></div>`;
  }

  function commercialPanel() {
    if (!window.CloudSync?.isSalesAdmin) return '<section class="permission-hub-card"><p>Esta área é exclusiva do administrador comercial do produto.</p></section>';
    if (typeof installAdminCenterStyle === 'function') installAdminCenterStyle();
    if (typeof installPresenceStatusStyle === 'function') installPresenceStatusStyle();
    if (typeof AdminCenter === 'undefined') return '<section class="permission-hub-card"><p>A central comercial ainda não está disponível.</p></section>';
    if (!AdminCenter.loaded && !AdminCenter.loading) setTimeout(() => adminLoad(), 0);
    const content = AdminCenter.loading ? '<section class="admin-card admin-loading">Carregando informações comerciais...</section>' : AdminCenter.error ? `<section class="admin-alert">${safe(AdminCenter.error)} <button class="btn sm alt" onclick="adminLoad(true)">Tentar novamente</button></section>` : ({ overview: commercialDashboard, companies: adminCompanies, sales: adminSales, audit: adminAudit }[AdminCenter.tab] || commercialDashboard)();
    return `<section class="permission-hub-card"><div class="permission-hub-commercial-head"><h2>Área comercial do ObraAtiva</h2><span class="permission-hub-exclusive">Exclusivo do proprietário</span></div><p>Clientes, assinaturas, vendas, atendimento e histórico do produto ficam juntos porque somente você visualiza esta área.</p></section><nav class="admin-tabs" aria-label="Seções da área comercial"><button class="${AdminCenter.tab === 'overview' ? 'active' : ''}" onclick="adminTab('overview')">Resumo comercial</button><button class="${AdminCenter.tab === 'companies' ? 'active' : ''}" onclick="adminTab('companies')">Clientes e assinaturas</button><button class="${AdminCenter.tab === 'sales' ? 'active' : ''}" onclick="adminTab('sales')">Vendas e atendimento</button><button class="${AdminCenter.tab === 'audit' ? 'active' : ''}" onclick="adminTab('audit')">Histórico</button></nav>${content}`;
  }

  function cleanChrome() {
    document.getElementById('cloudTopActions')?.setAttribute('hidden', '');
    document.querySelector('.top .top-settings-button')?.setAttribute('hidden', '');
    document.querySelector('.top .landscape-top-company-logo')?.remove();
  }

  async function hydrate() {
    try {
      teamSnapshot = await workspace()?.loadTeam?.();
      if (typeof page !== 'undefined' && page === 'permissions' && permissionHubTab === 'overview' && typeof render === 'function') render();
    } catch (error) {
      teamSnapshot = null;
    }
  }

  function install() {
    if (installed) return;
    if (typeof renderTop !== 'function' || typeof permissionControlCenter !== 'function' || typeof adminPage !== 'function') {
      setTimeout(install, 80);
      return;
    }
    installed = true;
    installStyle();

    const permissionControlCenterOriginal = permissionControlCenter;
    permissionControlCenter = function permissionControlCenterHub() {
      const panels = { overview: overviewPanel, access: () => accessPanel(permissionControlCenterOriginal), company: companyPanel, subscription: subscriptionPanel, security: securityPanel, commercial: commercialPanel };
      const selected = panels[permissionHubTab] || overviewPanel;
      return `<main class="permission-hub">${hero()}${tabs()}<div class="permission-hub-content">${selected()}</div></main>`;
    };

    window.openPermissionHub = function openPermissionHub(tab) {
      permissionHubTab = tab;
      if (typeof page !== 'undefined' && page !== 'permissions') go('permissions');
      else render();
    };
    window.exportPermissionSubscriptionData = () => workspace()?.exportCurrentBackup?.();
    window.exportCommercialReport = exportCommercialReport;
    window.copyCommercialSummary = copyCommercialSummary;
    window.openPermissionSubscriptionDetails = () => workspace()?.showSubscription?.();
    window.openPermissionCompanySettings = () => typeof openOfficeSettingsModal === 'function' ? openOfficeSettingsModal() : openModal('settings');
    window.openPermissionSignOut = () => {
      if (window.ObraAtivaAccountControls?.openSignOut) window.ObraAtivaAccountControls.openSignOut();
      else if (window.CloudSync?.signOut) window.CloudSync.signOut();
    };
    window.openPermissionAccountDeletion = () => typeof openAccountDeletionRequest === 'function' && openAccountDeletionRequest();

    const renderTopOriginal = renderTop;
    renderTop = function renderTopWithAdminHub() {
      renderTopOriginal();
      cleanChrome();
      const permissionsButton = [...document.querySelectorAll('#nav button')].find((button) => String(button.getAttribute('onclick') || '').includes("go('permissions')"));
      const salesButton = [...document.querySelectorAll('#nav button')].find((button) => String(button.getAttribute('onclick') || '').includes("go('sales')"));
      salesButton?.remove();
      if (permissionsButton) {
        permissionsButton.textContent = '🛡️ Administrador';
        permissionsButton.title = 'Acessos, empresa, assinatura, segurança e área comercial';
        permissionsButton.setAttribute('aria-label', 'Administrador');
      }
    };

    if (typeof salesPage === 'function') salesPage = function salesPageInsideAdmin() { permissionHubTab = 'commercial'; return permissionControlCenter(); };
    renderTop();
    render();
    hydrate();
    new MutationObserver(cleanChrome).observe(document.querySelector('.top') || document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
