(function installAssistantObraPhaseOne() {
  'use strict';

  const PAGE_KEY = 'assistant';
  const ENDPOINT = '/.netlify/functions/assistant-obras';
  const STATUS_CACHE_MS = 30000;
  const MODULE_LABELS = Object.freeze({
    works: 'Obras',
    clients: 'Clientes',
    team: 'Equipe',
    planning: 'Escala',
    attendance: 'Presença',
    payments: 'Pagamentos',
    financial: 'Financeiro',
    vehicles: 'Veículos',
    reports: 'Relatórios'
  });
  const state = {
    companyId: '',
    lastLoadedAt: 0,
    loading: false,
    status: null,
    error: ''
  };

  function escapeValue(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function installStyles() {
    if (document.getElementById('assistantObraPhaseOneStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="assistantObraPhaseOneStyle">
      #assistantObraPhase1{display:grid;gap:18px;max-width:1500px;margin:0 auto;color:#173d55}
      #assistantObraPhase1 *{box-sizing:border-box}
      .assistant-phase-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:24px;border:1px solid #d7e7df;border-radius:20px;background:linear-gradient(135deg,#f7fffb 0%,#eef7ff 100%);box-shadow:0 10px 28px #163e5b12}
      .assistant-phase-heading{display:grid;gap:8px;min-width:0}
      .assistant-phase-kicker{color:#18744e;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}
      .assistant-phase-heading h1{margin:0;color:#103e5b;font-size:clamp(26px,3vw,40px);line-height:1.05}
      .assistant-phase-heading p{max-width:760px;margin:0;color:#647b86;font-size:15px;line-height:1.55}
      .assistant-readonly-badge{display:flex;align-items:center;gap:10px;flex:0 0 auto;padding:12px 15px;border:1px solid #abd9c5;border-radius:999px;background:#eaf8f1;color:#146c48;font-weight:850;white-space:nowrap}
      .assistant-readonly-badge::before{content:'✓';display:grid;place-items:center;width:23px;height:23px;border-radius:50%;background:#18865b;color:#fff}
      .assistant-phase-notice{padding:16px 18px;border:1px solid #f0d9a0;border-radius:15px;background:#fff9ea;color:#735311;line-height:1.5}
      .assistant-phase-notice b{display:block;margin-bottom:3px;color:#5f4309}
      .assistant-phase-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .assistant-phase-card{min-width:0;padding:18px;border:1px solid #dbe7ed;border-radius:17px;background:#fff;box-shadow:0 7px 20px #173e6210}
      .assistant-phase-card small{display:block;margin-bottom:8px;color:#71838e;font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
      .assistant-phase-card h2{margin:0 0 7px;color:#173f55;font-size:18px}
      .assistant-phase-card p{margin:0;color:#6a7d87;font-size:13px;line-height:1.5}
      .assistant-phase-card.is-ready{border-color:#bfe3d2;background:linear-gradient(145deg,#fff,#f3fbf7)}
      .assistant-phase-card.is-locked{border-color:#e9dfc3;background:linear-gradient(145deg,#fff,#fffbf1)}
      .assistant-phase-status{padding:19px;border:1px solid #d7e4eb;border-radius:18px;background:#fff}
      .assistant-status-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:15px}
      .assistant-status-head h2{margin:0;color:#133f58;font-size:20px}
      .assistant-status-head p{margin:5px 0 0;color:#70828b;font-size:13px;line-height:1.45}
      .assistant-status-pill{padding:7px 10px;border-radius:999px;background:#eef4f7;color:#526b78;font-size:11px;font-weight:850;white-space:nowrap}
      .assistant-status-pill.ready{background:#e8f7ef;color:#14734b}
      .assistant-status-pill.error{background:#fff0f0;color:#a63d3d}
      .assistant-status-details{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .assistant-status-details article{min-width:0;padding:13px;border:1px solid #e0e9ed;border-radius:12px;background:#f9fbfc}
      .assistant-status-details small{display:block;color:#70828b;font-size:9px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}
      .assistant-status-details strong{display:block;margin-top:6px;color:#153f55;font-size:14px;overflow-wrap:anywhere}
      .assistant-module-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:14px}
      .assistant-module-list span{padding:6px 9px;border-radius:999px;background:#eef5fa;color:#325e77;font-size:11px;font-weight:800}
      .assistant-phase-footnote{padding:14px 16px;border:1px dashed #cbdde5;border-radius:14px;color:#647b86;font-size:12px;line-height:1.5}
      .assistant-phase-loading{height:12px;border-radius:999px;background:linear-gradient(90deg,#eef4f7 20%,#dbe9ef 50%,#eef4f7 80%);background-size:220% 100%;animation:assistantPhaseLoading 1.2s infinite}
      @keyframes assistantPhaseLoading{to{background-position:-220% 0}}
      @media(max-width:1050px){.assistant-phase-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.assistant-status-details{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){#assistantObraPhase1{gap:13px}.assistant-phase-hero{display:grid;padding:17px}.assistant-readonly-badge{justify-self:start}.assistant-phase-grid{grid-template-columns:1fr}.assistant-status-head{display:grid}.assistant-status-pill{justify-self:start}.assistant-status-details{grid-template-columns:1fr 1fr}}
      @media(max-width:430px){.assistant-status-details{grid-template-columns:1fr}}
    </style>`);
  }

  function pageMarkup() {
    installStyles();
    return `<main id="assistantObraPhase1" aria-labelledby="assistantObraTitle">
      <section class="assistant-phase-hero">
        <div class="assistant-phase-heading">
          <span class="assistant-phase-kicker">Fase 1 · Estrutura segura</span>
          <h1 id="assistantObraTitle">Assistente da Obra</h1>
          <p>Uma área separada para consultar informações da empresa com segurança. Nesta fase, o assistente apenas verifica acesso, permissões, assinatura e proteção do servidor.</p>
        </div>
        <div class="assistant-readonly-badge">Somente leitura</div>
      </section>

      <div class="assistant-phase-notice" role="note">
        <b>Nenhuma função da empresa foi alterada.</b>
        A conversa e as análises serão liberadas somente na Fase 2, após novo teste e sua autorização. Agora não existe comando capaz de salvar, editar ou apagar dados.
      </div>

      <section class="assistant-phase-grid" aria-label="Proteções da Fase 1">
        <article class="assistant-phase-card is-ready"><small>Contexto</small><h2>Consulta por permissão</h2><p>O serviço prepara somente as fontes liberadas para o perfil e o período solicitado.</p></article>
        <article class="assistant-phase-card is-ready"><small>Segurança</small><h2>Chave apenas no servidor</h2><p>Nenhum segredo do provedor de IA é enviado ao navegador ou salvo nos dados da empresa.</p></article>
        <article class="assistant-phase-card is-ready"><small>Resposta</small><h2>Formato validado</h2><p>Fontes, período, cálculos, confiança e dados ausentes terão estrutura obrigatória.</p></article>
        <article class="assistant-phase-card is-ready"><small>Proteção</small><h2>Limite por plano</h2><p>O servidor identifica o plano e prepara um limite diário antes de qualquer chamada paga.</p></article>
        <article class="assistant-phase-card is-ready"><small>Auditoria</small><h2>Registro sem dados da obra</h2><p>O log técnico guarda resultado e identificadores, nunca a pergunta nem os dados empresariais.</p></article>
        <article class="assistant-phase-card is-locked"><small>Fase 2</small><h2>Conversa bloqueada</h2><p>A IA ainda não responde perguntas e não consome créditos nesta primeira fase.</p></article>
      </section>

      <section class="assistant-phase-status" aria-live="polite">
        <div id="assistantPhaseStatus">${statusMarkup()}</div>
      </section>

      <p class="assistant-phase-footnote">Esta tela não acessa nem modifica obras, funcionários, presenças, pagamentos ou configurações. A validação é feita usando apenas sua sessão, a empresa selecionada, o perfil de acesso e a assinatura.</p>
    </main>`;
  }

  function moduleMarkup(modules) {
    if (!Array.isArray(modules) || !modules.length) return '';
    return `<div class="assistant-module-list" aria-label="Áreas permitidas">${modules.map((module) => `<span>${escapeValue(MODULE_LABELS[module] || module)}</span>`).join('')}</div>`;
  }

  function statusMarkup() {
    if (state.loading) {
      return `<div class="assistant-status-head"><div><h2>Validando a estrutura</h2><p>Conferindo sessão, empresa, permissões e assinatura sem abrir os dados da obra.</p></div><span class="assistant-status-pill">Verificando</span></div><div class="assistant-phase-loading"></div>`;
    }
    if (state.error) {
      return `<div class="assistant-status-head"><div><h2>Estrutura local preservada</h2><p>${escapeValue(state.error)}</p></div><span class="assistant-status-pill error">Não validado</span></div><p class="assistant-phase-footnote">Nenhum dado foi modificado durante esta tentativa.</p>`;
    }
    const status = state.status;
    if (!status) {
      return `<div class="assistant-status-head"><div><h2>Validação segura</h2><p>A verificação começará automaticamente quando sua conta e empresa estiverem carregadas.</p></div><span class="assistant-status-pill">Aguardando</span></div>`;
    }
    const providerText = status.provider?.configured ? 'Servidor preparado' : 'Chave será configurada antes da Fase 2';
    return `<div class="assistant-status-head"><div><h2>Fase 1 validada para esta empresa</h2><p>A área está separada, autenticada e bloqueada para qualquer gravação.</p></div><span class="assistant-status-pill ready">Estrutura pronta</span></div>
      <div class="assistant-status-details">
        <article><small>Acesso</small><strong>${escapeValue(status.access?.role || 'Validado')}</strong></article>
        <article><small>Plano</small><strong>${escapeValue(status.subscription?.plan || '—')}</strong></article>
        <article><small>Limite preparado</small><strong>${escapeValue(status.limits?.daily || 0)} consultas/dia</strong></article>
        <article><small>Provedor</small><strong>${escapeValue(providerText)}</strong></article>
      </div>${moduleMarkup(status.access?.allowedModules)}`;
  }

  function renderStatus() {
    const target = document.getElementById('assistantPhaseStatus');
    if (target) target.innerHTML = statusMarkup();
  }

  async function loadStatus() {
    const cloud = typeof CloudSync !== 'undefined' ? CloudSync : window.CloudSync;
    const workspace = typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace : window.CompanyWorkspace;
    const token = cloud?.session?.access_token || '';
    const companyId = workspace?.current?.id || '';
    if (!token || !companyId) {
      state.error = 'Entre na sua conta e selecione uma empresa para concluir a validação.';
      renderStatus();
      return;
    }
    if (state.loading) return;
    if (state.companyId === companyId && state.status && Date.now() - state.lastLoadedAt < STATUS_CACHE_MS) return;

    state.loading = true;
    state.error = '';
    renderStatus();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const requestId = window.crypto?.randomUUID?.() || `phase1-${Date.now()}`;
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-request-id': requestId
        },
        body: JSON.stringify({ action: 'status', companyId, requestId }),
        signal: controller.signal
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok !== true) throw new Error(body?.error || 'O servidor seguro não respondeu à validação.');
      state.companyId = companyId;
      state.status = body;
      state.lastLoadedAt = Date.now();
    } catch (error) {
      state.error = error?.name === 'AbortError'
        ? 'A verificação demorou mais que o esperado. Tente novamente ao reabrir esta área.'
        : (error?.message || 'Não foi possível validar a estrutura agora.');
    } finally {
      clearTimeout(timeout);
      state.loading = false;
      renderStatus();
    }
  }

  function mount() {
    renderStatus();
    Promise.resolve().then(loadStatus);
  }

  function installNavigation() {
    if (typeof navs !== 'undefined' && Array.isArray(navs) && !navs.some((item) => item[0] === PAGE_KEY)) {
      const before = navs.findIndex((item) => item[0] === 'textpdf');
      navs.splice(before >= 0 ? before : navs.length, 0, [PAGE_KEY, '🤖 Assistente da Obra']);
    }
    if (typeof MOBILE_NAV_META !== 'undefined' && MOBILE_NAV_META) {
      MOBILE_NAV_META[PAGE_KEY] = ['🤖', 'Assistente'];
    }

    const renderBeforeAssistant = render;
    render = function renderWithAssistantPhaseOne() {
      if (page === PAGE_KEY) {
        const view = document.getElementById('view');
        if (view) view.innerHTML = pageMarkup();
        mount();
        return undefined;
      }
      return renderBeforeAssistant();
    };

    const renderTopBeforeAssistant = renderTop;
    renderTop = function renderTopWithAssistantPhaseOne() {
      const result = renderTopBeforeAssistant();
      if (page === PAGE_KEY) {
        const title = document.getElementById('headerPage');
        if (title) title.textContent = 'Assistente da Obra';
      }
      return result;
    };

    renderTop();
  }

  window.AssistantObraPhase1 = Object.freeze({
    phase: 1,
    readOnly: true,
    pageMarkup,
    mount
  });

  installNavigation();
})();
