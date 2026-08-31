(function installAssistantObraPhaseFour() {
  'use strict';
  const PAGE_KEY = 'assistant';
  const ENDPOINT = '/.netlify/functions/assistant-obras-insights';
  const state = { mode: 'chat', loading: false, loaded: false, error: '', insights: null, period: 'current_month', severity: 'all', type: 'all', usage: null };

  function escapeValue(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }
  function dateLabel(value) { const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return match ? `${match[3]}/${match[2]}/${match[1]}` : '—'; }
  function dateTimeLabel(value) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'agora' : parsed.toLocaleString('pt-BR'); }
  function requestContext() { const cloud = typeof CloudSync !== 'undefined' ? CloudSync : window.CloudSync; const workspace = typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace : window.CompanyWorkspace; return { token: cloud?.session?.access_token || '', companyId: workspace?.current?.id || '' }; }

  function installStyles() {
    if (document.getElementById('assistantObraPhaseFourStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="assistantObraPhaseFourStyle">
      #assistantPhaseNavigation{display:none!important}#assistantPhaseNavigationV4{display:flex;align-items:center;gap:8px;max-width:1500px;margin:0 auto 14px;padding:7px;border:1px solid #d5e5de;border-radius:14px;background:#f8fcfa}
      #assistantPhaseNavigationV4 button{min-height:44px;padding:9px 15px;border:1px solid transparent;border-radius:10px;background:transparent;color:#52707d;font-weight:850;cursor:pointer}
      #assistantPhaseNavigationV4 button.active{border-color:#a7d4c0;background:#fff;color:#126d49;box-shadow:0 4px 12px #173e6210}
      #assistantObraPhase2[hidden],#assistantReportsPhase3[hidden],#assistantInsightsPhase4[hidden]{display:none!important}
      #assistantInsightsPhase4{display:grid;gap:15px;max-width:1500px;margin:0 auto;color:#173d55}#assistantInsightsPhase4 *{box-sizing:border-box}
      .assistant-insight-hero{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 22px;border:1px solid #d5e6de;border-radius:19px;background:linear-gradient(135deg,#f7fff9,#eef7ff);box-shadow:0 9px 26px #173e6210}
      .assistant-insight-kicker{display:block;color:#16734d;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.assistant-insight-hero h1{margin:4px 0 5px;color:#113f5a;font-size:clamp(25px,3vw,38px);line-height:1.08}.assistant-insight-hero p{max-width:850px;margin:0;color:#677d87;font-size:14px;line-height:1.5}.assistant-insight-lock{flex:0 0 auto;padding:10px 13px;border:1px solid #b7decd;border-radius:999px;background:#eaf8f1;color:#146d49;font-size:12px;font-weight:850;white-space:nowrap}
      .assistant-insight-toolbar{display:grid;grid-template-columns:minmax(190px,.8fr) minmax(160px,.65fr) minmax(210px,1fr) auto;gap:11px;align-items:end;padding:16px;border:1px solid #d9e6eb;border-radius:17px;background:#fff;box-shadow:0 8px 24px #173e620d}.assistant-insight-field{display:grid;gap:6px;min-width:0}.assistant-insight-field label{color:#416273;font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.assistant-insight-field select{width:100%;min-height:44px;padding:9px 11px;border:1px solid #cfdee5;border-radius:10px;background:#fff;color:#173d55;font:inherit;font-weight:700}.assistant-insight-refresh{min-height:44px;padding:10px 16px;border:1px solid #1769d2;border-radius:10px;background:#1d70dc;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 6px 14px #1d70dc2e}.assistant-insight-refresh:disabled{opacity:.55;cursor:not-allowed}.assistant-insight-toolbar-note{grid-column:1/-1;margin:0;color:#6f838d;font-size:10px;line-height:1.45}
      .assistant-insight-loading{display:flex;align-items:center;gap:10px;padding:20px;border:1px solid #cfe1ea;border-radius:14px;background:#f4f9fc;color:#416a7e;font-weight:800}.assistant-insight-loading::before{content:'';width:17px;height:17px;border:2px solid #a9c9d8;border-top-color:#1c75d7;border-radius:50%;animation:assistantInsightSpin .8s linear infinite}@keyframes assistantInsightSpin{to{transform:rotate(360deg)}}.assistant-insight-error{padding:12px 14px;border:1px solid #efcbcb;border-radius:12px;background:#fff1f1;color:#9d3c3c;font-size:12px}
      .assistant-insight-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.assistant-insight-summary article{min-width:0;padding:14px;border:1px solid #dae7e2;border-radius:13px;background:#fff}.assistant-insight-summary small{display:block;color:#6c8189;font-size:9px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.assistant-insight-summary b{display:block;margin-top:5px;color:#164e68;font-size:24px}.assistant-insight-summary article.attention b{color:#a76018}.assistant-insight-summary article.info b{color:#326e94}.assistant-insight-period{grid-column:span 2}.assistant-insight-period b{font-size:15px;line-height:1.35}.assistant-insight-period span{display:block;margin-top:4px;color:#758991;font-size:10px}
      .assistant-insight-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.assistant-insight-card{display:grid;gap:12px;min-width:0;padding:17px;border:1px solid #dce8ed;border-left:5px solid #cb7c27;border-radius:15px;background:#fff;box-shadow:0 7px 20px #173e620c}.assistant-insight-card.info{border-left-color:#4388ae}.assistant-insight-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.assistant-insight-card h2{margin:0;color:#19475d;font-size:17px;line-height:1.25}.assistant-insight-card p{margin:0;color:#617781;font-size:12px;line-height:1.55}.assistant-insight-level{padding:6px 8px;border-radius:999px;background:#fff0d9;color:#a55e0d;font-size:9px;font-weight:900;white-space:nowrap;text-transform:uppercase}.assistant-insight-card.info .assistant-insight-level{background:#eaf5fb;color:#276b91}.assistant-insight-evidence{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.assistant-insight-evidence div{min-width:0;padding:10px;border:1px solid #e1eaee;border-radius:10px;background:#f9fbfc}.assistant-insight-evidence small{display:block;color:#71858e;font-size:9px;font-weight:850;text-transform:uppercase}.assistant-insight-evidence b{display:block;margin-top:4px;color:#214c61;font-size:12px;overflow-wrap:anywhere}.assistant-insight-evidence span{display:block;margin-top:4px;color:#82939a;font-size:9px;line-height:1.35}.assistant-insight-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:2px}.assistant-insight-footer small{color:#71858e;font-size:9px}.assistant-insight-open{min-height:40px;padding:8px 12px;border:1px solid #86c7aa;border-radius:9px;background:#effaf4;color:#166b49;font-weight:850;cursor:pointer}
      .assistant-insight-empty{grid-column:1/-1;padding:34px;border:1px dashed #bfd4dc;border-radius:16px;background:#fafdfe;color:#70838d;text-align:center}.assistant-insight-empty b{display:block;margin-bottom:6px;color:#214d63;font-size:18px}.assistant-insight-checks{padding:14px;border:1px solid #dce8ed;border-radius:13px;background:#f9fbfc}.assistant-insight-checks summary{cursor:pointer;color:#315e72;font-size:12px;font-weight:850}.assistant-insight-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.assistant-insight-check{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px;border:1px solid #e0eaee;border-radius:10px;background:#fff}.assistant-insight-check b{font-size:11px}.assistant-insight-check span{padding:4px 6px;border-radius:999px;background:#edf4f7;color:#4e6d7c;font-size:8px;font-weight:900;text-transform:uppercase}.assistant-insight-check small{display:block;margin-top:4px;color:#7a8c94;font-size:9px;line-height:1.35}.assistant-insight-warnings{padding:13px 15px;border-radius:12px;background:#f3f6f8;color:#617681;font-size:10px;line-height:1.55}
      @media(max-width:1150px){.assistant-insight-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}.assistant-insight-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.assistant-insight-period{grid-column:span 2}}
      @media(max-width:780px){.assistant-insight-hero{display:grid;padding:16px}.assistant-insight-lock{justify-self:start}.assistant-insight-toolbar{grid-template-columns:1fr 1fr}.assistant-insight-list{grid-template-columns:1fr}.assistant-insight-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.assistant-insight-period{grid-column:span 2}.assistant-insight-check-grid{grid-template-columns:1fr}}
      @media(max-width:520px){#assistantPhaseNavigationV4{display:grid;grid-template-columns:1fr 1fr}#assistantPhaseNavigationV4 button{width:100%}#assistantPhaseNavigationV4 button:last-child{grid-column:1/-1}.assistant-insight-toolbar{grid-template-columns:1fr}.assistant-insight-summary{grid-template-columns:1fr 1fr}.assistant-insight-period{grid-column:1/-1}.assistant-insight-evidence{grid-template-columns:1fr}.assistant-insight-footer{display:grid}.assistant-insight-open{width:100%}}
    </style>`);
  }

  function typeOptions() {
    const rows = state.insights?.checkedRules || [];
    return `<option value="all">Todos os tipos</option>${rows.map((item) => `<option value="${escapeValue(item.type)}" ${state.type===item.type?'selected':''}>${escapeValue(item.label)}</option>`).join('')}`;
  }
  function toolbarMarkup() {
    return `<section class="assistant-insight-toolbar"><div class="assistant-insight-field"><label for="assistantInsightPeriod">Período da análise</label><select id="assistantInsightPeriod" onchange="AssistantObraPhase4.changePeriod(this.value)"><option value="current_week" ${state.period==='current_week'?'selected':''}>Semana atual</option><option value="current_fortnight" ${state.period==='current_fortnight'?'selected':''}>Quinzena atual</option><option value="current_month" ${state.period==='current_month'?'selected':''}>Mês atual</option></select></div><div class="assistant-insight-field"><label for="assistantInsightSeverity">Mostrar</label><select id="assistantInsightSeverity" onchange="AssistantObraPhase4.changeSeverity(this.value)"><option value="all" ${state.severity==='all'?'selected':''}>Todos os alertas</option><option value="attention" ${state.severity==='attention'?'selected':''}>Pontos de atenção</option><option value="info" ${state.severity==='info'?'selected':''}>Avisos informativos</option></select></div><div class="assistant-insight-field"><label for="assistantInsightType">Tipo de verificação</label><select id="assistantInsightType" onchange="AssistantObraPhase4.changeType(this.value)">${typeOptions()}</select></div><button class="assistant-insight-refresh" type="button" onclick="AssistantObraPhase4.reload()" ${state.loading?'disabled':''}>${state.loading?'Verificando…':'Verificar novamente'}</button><p class="assistant-insight-toolbar-note">A análise acontece automaticamente. Você não precisa digitar nada. Ela somente lê as fontes permitidas e nunca altera os registros.</p></section>`;
  }
  function summaryMarkup() {
    const summary = state.insights?.summary || {};
    return `<section class="assistant-insight-summary" aria-label="Resumo dos alertas"><article class="attention"><small>Pontos de atenção</small><b>${escapeValue(summary.attention || 0)}</b></article><article class="info"><small>Informativos</small><b>${escapeValue(summary.info || 0)}</b></article><article><small>Verificações normais</small><b>${escapeValue(summary.clear || 0)}</b></article><article><small>Dados insuficientes</small><b>${escapeValue(summary.insufficient || 0)}</b></article><article class="assistant-insight-period"><small>Período analisado</small><b>${escapeValue(state.insights?.period?.label || '—')}</b><span>${escapeValue(dateLabel(state.insights?.period?.from))} a ${escapeValue(dateLabel(state.insights?.period?.to))} · ${escapeValue(dateTimeLabel(state.insights?.generatedAt))}</span></article></section>`;
  }
  function evidenceMarkup(rows) {
    return `<div class="assistant-insight-evidence">${(rows || []).map((item) => `<div><small>${escapeValue(item.label)}</small><b>${escapeValue(item.value)}</b>${item.formula?`<span>${escapeValue(item.formula)}</span>`:''}</div>`).join('')}</div>`;
  }
  function cardsMarkup() {
    const alerts = (state.insights?.alerts || []).filter((item) => (state.severity === 'all' || item.severity === state.severity) && (state.type === 'all' || item.type === state.type));
    if (!alerts.length) return '<div class="assistant-insight-empty"><b>Nenhum alerta corresponde aos filtros</b><span>As verificações concluídas continuam disponíveis abaixo. Dados insuficientes não são transformados em conclusões.</span></div>';
    return alerts.map((item) => `<article class="assistant-insight-card ${item.severity==='info'?'info':''}"><header><h2>${escapeValue(item.title)}</h2><span class="assistant-insight-level">${item.severity==='info'?'Informativo':'Atenção'}</span></header><p>${escapeValue(item.message)}</p>${evidenceMarkup(item.evidence)}${item.missingData?.length?`<p><b>Dados ausentes:</b> ${escapeValue(item.missingData.join('; '))}</p>`:''}<footer class="assistant-insight-footer"><small>Confiança ${escapeValue(({high:'alta',medium:'média',low:'baixa'})[item.confidence] || 'baixa')} · somente leitura</small><button class="assistant-insight-open" type="button" onclick="AssistantObraPhase4.openTarget('${escapeValue(item.target.page)}','${escapeValue(item.target.entityId || '')}')">${escapeValue(item.target.label)}</button></footer></article>`).join('');
  }
  function checksMarkup() {
    const labels = { alert: 'alerta encontrado', clear: 'sem alerta', insufficient: 'dados insuficientes', restricted: 'sem permissão' };
    return `<details class="assistant-insight-checks"><summary>Ver as 10 verificações automáticas e o que foi possível confirmar</summary><div class="assistant-insight-check-grid">${(state.insights?.checkedRules || []).map((item) => `<div class="assistant-insight-check"><div><b>${escapeValue(item.label)}</b>${item.detail?`<small>${escapeValue(item.detail)}</small>`:''}</div><span>${escapeValue(labels[item.status] || item.status)}</span></div>`).join('')}</div></details>`;
  }
  function resultMarkup() {
    if (state.loading) return '<div class="assistant-insight-loading">Cruzando somente as fontes autorizadas e procurando evidências</div>';
    if (state.error) return `<div class="assistant-insight-error" role="alert">${escapeValue(state.error)}</div>`;
    if (!state.insights) return '<div class="assistant-insight-empty"><b>Preparando as verificações</b><span>Os alertas serão carregados automaticamente ao abrir esta área.</span></div>';
    return `${summaryMarkup()}<section class="assistant-insight-list">${cardsMarkup()}</section>${checksMarkup()}<div class="assistant-insight-warnings">${(state.insights.warnings || []).map((item) => `<div>${escapeValue(item)}</div>`).join('')}</div>`;
  }
  function areaMarkup() {
    return `<section id="assistantInsightsPhase4" ${state.mode==='alerts'?'':'hidden'} aria-labelledby="assistantInsightsTitle"><section class="assistant-insight-hero"><div><span class="assistant-insight-kicker">Fase 4 · Alertas e insights automáticos</span><h1 id="assistantInsightsTitle">O que merece conferência</h1><p>Dez verificações automáticas procuram sinais nos registros autorizados, mostram as evidências encontradas e abrem a área certa para conferência humana.</p></div><span class="assistant-insight-lock">🔒 Somente leitura</span></section>${toolbarMarkup()}${resultMarkup()}</section>`;
  }
  function navigationMarkup() {
    return `<nav id="assistantPhaseNavigationV4" aria-label="Áreas do Assistente da Obra"><button type="button" class="${state.mode==='chat'?'active':''}" onclick="AssistantObraPhase4.switchMode('chat')">💬 Conversa</button><button type="button" class="${state.mode==='reports'?'active':''}" onclick="AssistantObraPhase4.switchMode('reports')">📄 Relatórios</button><button type="button" class="${state.mode==='alerts'?'active':''}" onclick="AssistantObraPhase4.switchMode('alerts')">⚠️ Alertas automáticos</button></nav>`;
  }

  function decorate() {
    installStyles();
    const phase2 = document.getElementById('assistantObraPhase2');
    if (!phase2) return;
    document.getElementById('assistantPhaseNavigation')?.remove();
    document.getElementById('assistantPhaseNavigationV4')?.remove();
    document.getElementById('assistantInsightsPhase4')?.remove();
    phase2.insertAdjacentHTML('beforebegin', navigationMarkup());
    const reports = document.getElementById('assistantReportsPhase3');
    (reports || phase2).insertAdjacentHTML('afterend', areaMarkup());
    phase2.hidden = state.mode !== 'chat';
    if (reports) reports.hidden = state.mode !== 'reports';
  }

  async function api(payload) {
    const { token, companyId } = requestContext();
    if (!token || !companyId) throw new Error('Entre na sua conta e selecione uma empresa para visualizar os alertas.');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const requestId = window.crypto?.randomUUID?.() || `insight-${Date.now()}`;
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-request-id': requestId }, body: JSON.stringify({ ...payload, companyId, requestId }), signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok !== true) throw new Error(body?.error || 'Não foi possível preparar os alertas agora.');
      return body;
    } catch (error) { if (error?.name === 'AbortError') throw new Error('A verificação demorou mais que o esperado. Tente novamente.'); throw error; } finally { clearTimeout(timeout); }
  }

  async function load(force = false) {
    if (state.loading || (state.loaded && !force)) return;
    state.loading = true; state.error = ''; decorate();
    try { const body = await api({ action: 'analyze', period: { kind: state.period } }); state.insights = body.insights || null; state.usage = body.usage || null; state.loaded = true; try { window.dispatchEvent(new CustomEvent('assistant-insights-updated', { detail: { attention: Number(state.insights?.summary?.attention || 0), info: Number(state.insights?.summary?.info || 0) } })); } catch {} }
    catch (error) { state.error = error?.message || 'Não foi possível preparar os alertas.'; state.loaded = false; }
    finally { state.loading = false; decorate(); }
  }
  function switchMode(mode) {
    state.mode = ['chat', 'reports', 'alerts'].includes(mode) ? mode : 'chat';
    if (state.mode === 'reports') window.AssistantObraPhase3?.switchMode?.('reports');
    else window.AssistantObraPhase3?.switchMode?.('chat');
    renderTop(); decorate();
    if (state.mode === 'alerts') load();
  }
  function changePeriod(period) { if (!['current_week', 'current_fortnight', 'current_month'].includes(period)) return; state.period = period; state.loaded = false; state.insights = null; state.type = 'all'; load(true); }
  function changeSeverity(value) { state.severity = ['all', 'attention', 'info'].includes(value) ? value : 'all'; decorate(); }
  function changeType(value) { state.type = value || 'all'; decorate(); }
  function reload() { state.loaded = false; return load(true); }
  function openTarget(targetPage, entityId) {
    const allowedPages = new Set(['works', 'planning', 'attendance', 'financial', 'vehicles', 'team']);
    if (!allowedPages.has(targetPage)) return;
    if (targetPage === 'works' && entityId && typeof openWorkTracker === 'function') { openWorkTracker(entityId); return; }
    try { if (targetPage === 'financial' && entityId && typeof selectedWork !== 'undefined') selectedWork = entityId; } catch (error) { /* navegação sem seleção específica */ }
    if (typeof go === 'function') go(targetPage);
  }

  const renderBeforePhaseFour = render;
  render = function renderWithAssistantPhaseFour() { const result = renderBeforePhaseFour(); if (page === PAGE_KEY) setTimeout(decorate, 0); return result; };
  const renderTopBeforePhaseFour = renderTop;
  renderTop = function renderTopWithAssistantPhaseFour() { const result = renderTopBeforePhaseFour(); if (page === PAGE_KEY && state.mode === 'alerts') { const title = document.getElementById('headerPage'); if (title) title.textContent = 'Assistente da Obra · Alertas'; } return result; };
  window.AssistantObraPhase4 = Object.freeze({ switchMode, changePeriod, changeSeverity, changeType, reload, openTarget, phase: 4, readOnly: true, automatic: true });
})();
