(function installAssistantObraPhaseThree() {
  'use strict';
  const PAGE_KEY = 'assistant';
  const ENDPOINT = '/.netlify/functions/assistant-obras-report';
  const state = { mode: 'chat', options: null, optionsLoading: false, loading: false, error: '', report: null, type: 'daily', period: 'today', targetId: '' };

  function escapeValue(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }
  function dateLabel(value) { const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return match ? `${match[3]}/${match[2]}/${match[1]}` : '—'; }
  function dateTimeLabel(value) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'agora' : parsed.toLocaleString('pt-BR'); }

  function installStyles() {
    if (document.getElementById('assistantObraPhaseThreeStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="assistantObraPhaseThreeStyle">
      #assistantPhaseNavigation{display:flex;align-items:center;gap:8px;max-width:1500px;margin:0 auto 14px;padding:7px;border:1px solid #d5e5de;border-radius:14px;background:#f8fcfa}
      #assistantPhaseNavigation button{min-height:44px;padding:9px 15px;border:1px solid transparent;border-radius:10px;background:transparent;color:#52707d;font-weight:850;cursor:pointer}
      #assistantPhaseNavigation button.active{border-color:#a7d4c0;background:#fff;color:#126d49;box-shadow:0 4px 12px #173e6210}
      #assistantObraPhase2[hidden],#assistantReportsPhase3[hidden]{display:none!important}#assistantReportsPhase3{display:grid;gap:15px;max-width:1500px;margin:0 auto;color:#173d55}#assistantReportsPhase3 *{box-sizing:border-box}
      .assistant-report-hero{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 22px;border:1px solid #d5e6de;border-radius:19px;background:linear-gradient(135deg,#f6fff9,#eef6ff);box-shadow:0 9px 26px #173e6210}
      .assistant-report-kicker{display:block;color:#16734d;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.assistant-report-hero h1{margin:4px 0 5px;color:#113f5a;font-size:clamp(25px,3vw,38px);line-height:1.08}.assistant-report-hero p{max-width:790px;margin:0;color:#677d87;font-size:14px;line-height:1.5}
      .assistant-report-preview-badge{flex:0 0 auto;padding:10px 13px;border:1px solid #b7decd;border-radius:999px;background:#eaf8f1;color:#146d49;font-size:12px;font-weight:850;white-space:nowrap}
      .assistant-report-form{display:grid;grid-template-columns:minmax(190px,1.25fr) minmax(170px,.85fr) minmax(200px,1fr) auto;gap:11px;align-items:end;padding:16px;border:1px solid #d9e6eb;border-radius:17px;background:#fff;box-shadow:0 8px 24px #173e620d}
      .assistant-report-field{display:grid;gap:6px;min-width:0}.assistant-report-field label{color:#416273;font-size:10px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.assistant-report-field select{width:100%;min-height:44px;padding:9px 11px;border:1px solid #cfdee5;border-radius:10px;background:#fff;color:#173d55;font:inherit;font-weight:700}
      .assistant-report-generate{min-height:44px;padding:10px 16px;border:1px solid #1769d2;border-radius:10px;background:#1d70dc;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 6px 14px #1d70dc2e}.assistant-report-generate:disabled{opacity:.55;cursor:not-allowed}.assistant-report-form-note{grid-column:1/-1;margin:0;color:#6f838d;font-size:10px;line-height:1.45}
      .assistant-report-error{padding:11px 13px;border:1px solid #f0cccc;border-radius:11px;background:#fff0f0;color:#a63d3d;font-size:12px}.assistant-report-loading{display:flex;align-items:center;gap:10px;padding:18px;border:1px solid #cfe1ea;border-radius:14px;background:#f4f9fc;color:#416a7e;font-weight:800}.assistant-report-loading::before{content:'';width:17px;height:17px;border:2px solid #a9c9d8;border-top-color:#1c75d7;border-radius:50%;animation:assistantReportSpin .8s linear infinite}@keyframes assistantReportSpin{to{transform:rotate(360deg)}}
      .assistant-report-empty{padding:32px;border:1px dashed #bfd4dc;border-radius:16px;background:#fafdfe;color:#70838d;text-align:center}.assistant-report-empty b{display:block;margin-bottom:6px;color:#214d63;font-size:18px}
      .assistant-report-paper{display:grid;gap:14px;padding:22px;border:1px solid #d7e5df;border-radius:19px;background:#fff;box-shadow:0 10px 28px #173e6212}.assistant-report-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding-bottom:15px;border-bottom:1px solid #e1ebee}.assistant-report-head h2{margin:3px 0 5px;color:#113f5a;font-size:clamp(22px,2.7vw,34px)}.assistant-report-head p{margin:0;color:#6a7f89;font-size:12px;line-height:1.5}.assistant-report-lock{padding:8px 10px;border-radius:9px;background:#eaf8f1;color:#146d49;font-size:10px;font-weight:900;white-space:nowrap}
      .assistant-report-summary{padding:16px;border-left:4px solid #21815c;border-radius:11px;background:#f3fbf7;color:#214d3c;line-height:1.58}.assistant-report-summary h3{margin:0 0 6px;font-size:15px}.assistant-report-summary p{margin:0}.assistant-report-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.assistant-report-section{min-width:0;padding:15px;border:1px solid #dce8ed;border-radius:13px;background:#fbfdfe}.assistant-report-section.wide{grid-column:1/-1}.assistant-report-section h3{margin:0 0 9px;color:#19475d;font-size:15px}.assistant-report-section ul{display:grid;gap:7px;margin:0;padding-left:18px;color:#566f7b;font-size:12px;line-height:1.45}
      .assistant-report-tags{display:flex;flex-wrap:wrap;gap:7px}.assistant-report-tag{padding:6px 9px;border-radius:999px;background:#edf4f7;color:#416273;font-size:10px;font-weight:750}.assistant-report-numbers{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.assistant-report-number{min-width:0;padding:12px;border:1px solid #dce7ec;border-radius:11px;background:#fff}.assistant-report-number small{display:block;color:#6f818a;font-size:9px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.assistant-report-number b{display:block;margin-top:5px;color:#164e68;font-size:18px;overflow-wrap:anywhere}.assistant-report-number span{display:block;margin-top:5px;color:#788b94;font-size:9px;line-height:1.35}
      .assistant-report-attention{border-color:#efd8a8;background:#fffaf0}.assistant-report-attention li::marker{color:#bc7822}.assistant-report-missing{border-color:#edd7b0;background:#fffaf1}.assistant-report-warnings{padding:12px 14px;border-radius:11px;background:#f3f6f8;color:#617681;font-size:10px;line-height:1.5}.assistant-report-source-details{padding:11px 13px;border:1px solid #dce8ed;border-radius:11px;background:#f9fbfc;color:#617883;font-size:11px}.assistant-report-source-details summary{cursor:pointer;color:#315e72;font-weight:850}.assistant-report-source-details ul{margin:8px 0 0;padding-left:18px}
      @media(max-width:1050px){.assistant-report-form{grid-template-columns:repeat(2,minmax(0,1fr))}.assistant-report-generate{width:100%}.assistant-report-numbers{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.assistant-report-hero{display:grid;padding:16px}.assistant-report-preview-badge{justify-self:start}.assistant-report-form{grid-template-columns:1fr}.assistant-report-grid{grid-template-columns:1fr}.assistant-report-section.wide{grid-column:auto}.assistant-report-numbers{grid-template-columns:1fr 1fr}.assistant-report-head{display:grid}.assistant-report-lock{justify-self:start}.assistant-report-paper{padding:16px}}@media(max-width:480px){#assistantPhaseNavigation{display:grid;grid-template-columns:1fr 1fr}#assistantPhaseNavigation button{width:100%}.assistant-report-numbers{grid-template-columns:1fr}}
    </style>`);
  }

  function requestContext() { const cloud = typeof CloudSync !== 'undefined' ? CloudSync : window.CloudSync; const workspace = typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace : window.CompanyWorkspace; return { token: cloud?.session?.access_token || '', companyId: workspace?.current?.id || '' }; }
  function reportType() { return state.options?.reportTypes?.find((item) => item.type === state.type) || null; }
  function targetMarkup() {
    const definition = reportType();
    if (!definition?.target) return '<div class="assistant-report-field" id="assistantReportTargetField" hidden></div>';
    const rows = definition.target === 'work' ? state.options?.works || [] : state.options?.employees || [];
    const label = definition.target === 'work' ? 'Obra' : 'Funcionário';
    return `<div class="assistant-report-field" id="assistantReportTargetField"><label for="assistantReportTarget">${label}</label><select id="assistantReportTarget" required onchange="AssistantObraPhase3.changeTarget(this.value)"><option value="">Selecione</option>${rows.map((item) => `<option value="${escapeValue(item.id)}" ${state.targetId===item.id?'selected':''}>${escapeValue(item.name)}</option>`).join('')}</select></div>`;
  }
  function periodLocked() { return ['daily', 'weekly', 'fortnightly', 'payments'].includes(state.type); }
  function formMarkup() {
    if (state.optionsLoading) return '<div class="assistant-report-loading">Carregando opções autorizadas</div>';
    if (!state.options) return `<div class="assistant-report-empty"><b>Não foi possível carregar os relatórios</b><span>${escapeValue(state.error || 'Abra novamente esta área para tentar.')}</span></div>`;
    const types = state.options.reportTypes || [];
    if (!types.length) return '<div class="assistant-report-empty"><b>Nenhum relatório disponível</b><span>Seu perfil não possui acesso completo às fontes exigidas pelos relatórios.</span></div>';
    return `<form class="assistant-report-form" onsubmit="return AssistantObraPhase3.submit(event)"><div class="assistant-report-field"><label for="assistantReportType">Tipo de relatório</label><select id="assistantReportType" onchange="AssistantObraPhase3.changeType(this.value)">${types.map((item) => `<option value="${escapeValue(item.type)}" ${state.type===item.type?'selected':''}>${escapeValue(item.label)}</option>`).join('')}</select></div><div class="assistant-report-field"><label for="assistantReportPeriod">Período</label><select id="assistantReportPeriod" onchange="AssistantObraPhase3.changePeriod(this.value)" ${periodLocked()?'disabled':''}><option value="today" ${state.period==='today'?'selected':''}>Hoje</option><option value="current_week" ${state.period==='current_week'?'selected':''}>Semana atual</option><option value="current_fortnight" ${state.period==='current_fortnight'?'selected':''}>Quinzena atual</option><option value="current_month" ${state.period==='current_month'?'selected':''}>Mês atual</option><option value="current_cycle" ${state.period==='current_cycle'?'selected':''}>Ciclo atual</option></select></div>${targetMarkup()}<button class="assistant-report-generate" type="submit" ${state.loading?'disabled':''}>${state.loading?'Preparando…':'Gerar prévia'}</button><p class="assistant-report-form-note">A prévia usa somente fontes autorizadas da empresa atual. Nada será salvo, enviado ou publicado.</p></form>`;
  }
  function listMarkup(items, emptyText) { return Array.isArray(items) && items.length ? `<ul>${items.map((item) => `<li>${escapeValue(typeof item === 'string' ? item : `${item.title}: ${item.detail}`)}</li>`).join('')}</ul>` : `<span style="color:#7b8c94;font-size:11px">${escapeValue(emptyText)}</span>`; }
  function reportMarkup() {
    const report = state.report;
    if (!report) return '<div class="assistant-report-empty"><b>Escolha o relatório</b><span>A prévia aparecerá aqui com fontes, cálculos, dados ausentes e recomendações.</span></div>';
    const works = report.worksAnalyzed || [], found = report.dataFound || [], missing = report.missingData || [], numbers = report.numbers || [], sources = report.sources || [];
    const confidence = ({ low: 'baixa', medium: 'média', high: 'alta' })[report.confidence] || 'baixa';
    return `<article class="assistant-report-paper" aria-label="Prévia do relatório"><header class="assistant-report-head"><div><span class="assistant-report-kicker">PRÉVIA · NÃO SALVA</span><h2>${escapeValue(report.title)}</h2><p>${escapeValue(report.company?.name || 'Empresa atual')} · ${escapeValue(report.period?.label || 'Período')} · ${escapeValue(dateLabel(report.period?.from))} a ${escapeValue(dateLabel(report.period?.to))}<br>Gerado em ${escapeValue(dateTimeLabel(report.generatedAt))} · Confiança ${escapeValue(confidence)}</p></div><span class="assistant-report-lock">🔒 Somente leitura</span></header><section class="assistant-report-summary"><h3>Resumo executivo</h3><p>${escapeValue(report.executiveSummary)}</p></section><div class="assistant-report-grid"><section class="assistant-report-section"><h3>Obras analisadas</h3>${works.length?`<div class="assistant-report-tags">${works.map((item) => `<span class="assistant-report-tag">${escapeValue(item.name)}</span>`).join('')}</div>`:'<span style="color:#7b8c94;font-size:11px">Nenhuma obra com movimentação encontrada no período.</span>'}</section><section class="assistant-report-section"><h3>Dados encontrados</h3>${found.length?`<div class="assistant-report-tags">${found.map((item) => `<span class="assistant-report-tag">${escapeValue(item.label)} · ${escapeValue(item.value)}</span>`).join('')}</div>`:'<span style="color:#7b8c94;font-size:11px">Nenhum registro encontrado nas fontes autorizadas.</span>'}</section><section class="assistant-report-section wide"><h3>Números e cálculos utilizados</h3>${numbers.length?`<div class="assistant-report-numbers">${numbers.map((item) => `<div class="assistant-report-number"><small>${escapeValue(item.label)}</small><b>${escapeValue(item.value)}</b><span>${escapeValue(item.formula)}</span></div>`).join('')}</div>`:'<span style="color:#7b8c94;font-size:11px">Nenhum cálculo disponível com segurança.</span>'}</section><section class="assistant-report-section assistant-report-attention"><h3>Pontos de atenção</h3>${listMarkup(report.attentionPoints, 'Nenhum ponto de atenção comprovado pelas fontes consultadas.')}</section><section class="assistant-report-section"><h3>Recomendações</h3>${listMarkup(report.recommendations, 'Nenhuma recomendação adicional.')}</section><section class="assistant-report-section wide assistant-report-missing"><h3>Dados ausentes</h3>${listMarkup(missing, 'Nenhum dado obrigatório ausente nas fontes consultadas.')}</section></div><details class="assistant-report-source-details"><summary>Ver fontes internas consultadas</summary><ul>${sources.map((item) => `<li>${escapeValue(item.name)}: ${escapeValue(item.count)} registro(s)</li>`).join('')}</ul></details><div class="assistant-report-warnings">${(report.warnings || []).map((item) => `<div>${escapeValue(item)}</div>`).join('')}</div></article>`;
  }
  function areaMarkup() { return `<section id="assistantReportsPhase3" ${state.mode==='reports'?'':'hidden'} aria-labelledby="assistantReportsTitle"><section class="assistant-report-hero"><div><span class="assistant-report-kicker">Fase 3 · Relatórios inteligentes</span><h1 id="assistantReportsTitle">Prévia de relatórios</h1><p>Gere análises organizadas com período, fontes, cálculos e dados ausentes. Nenhuma prévia é salva, enviada ou publicada automaticamente.</p></div><div class="assistant-report-preview-badge">📄 Pré-visualização</div></section><div id="assistantReportFormHost">${formMarkup()}</div>${state.error&&!state.optionsLoading?`<div class="assistant-report-error" role="alert">${escapeValue(state.error)}</div>`:''}<div id="assistantReportPreviewHost">${state.loading?'<div class="assistant-report-loading">Analisando dados da sua empresa e montando a prévia</div>':reportMarkup()}</div></section>`; }
  function navigationMarkup() { return `<nav id="assistantPhaseNavigation" aria-label="Áreas do Assistente da Obra"><button type="button" class="${state.mode==='chat'?'active':''}" onclick="AssistantObraPhase3.switchMode('chat')">💬 Conversa</button><button type="button" class="${state.mode==='reports'?'active':''}" onclick="AssistantObraPhase3.switchMode('reports')">📄 Relatórios</button></nav>`; }
  function decorate() {
    installStyles();
    const phase2 = document.getElementById('assistantObraPhase2');
    if (!phase2) return;
    document.getElementById('assistantPhaseNavigation')?.remove(); document.getElementById('assistantReportsPhase3')?.remove();
    phase2.insertAdjacentHTML('beforebegin', navigationMarkup()); phase2.insertAdjacentHTML('afterend', areaMarkup()); phase2.hidden = state.mode === 'reports';
  }
  async function api(payload) {
    const { token, companyId } = requestContext();
    if (!token || !companyId) throw new Error('Entre na sua conta e selecione uma empresa para usar os relatórios.');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const requestId = window.crypto?.randomUUID?.() || `report-${Date.now()}`;
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-request-id': requestId }, body: JSON.stringify({ ...payload, companyId, requestId }), signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok !== true) throw new Error(body?.error || 'Não foi possível preparar o relatório agora.');
      return body;
    } catch (error) { if (error?.name === 'AbortError') throw new Error('A preparação demorou mais que o esperado. Tente novamente.'); throw error; } finally { clearTimeout(timeout); }
  }
  async function loadOptions() {
    if (state.options || state.optionsLoading) return;
    state.optionsLoading = true; state.error = ''; decorate();
    try { const body = await api({ action: 'options' }); state.options = body.options || { reportTypes: [], works: [], employees: [] }; const first = state.options.reportTypes?.[0]; if (!state.options.reportTypes?.some((item) => item.type === state.type) && first) state.type = first.type; state.period = reportType()?.defaultPeriod || 'current_month'; }
    catch (error) { state.error = error?.message || 'Não foi possível carregar as opções.'; }
    finally { state.optionsLoading = false; decorate(); }
  }
  function switchMode(mode) { state.mode = mode === 'reports' ? 'reports' : 'chat'; renderTop(); decorate(); if (state.mode === 'reports') loadOptions(); }
  function changeType(type) { if (!state.options?.reportTypes?.some((item) => item.type === type)) return; state.type = type; state.period = reportType()?.defaultPeriod || 'current_month'; state.targetId = ''; state.report = null; state.error = ''; decorate(); }
  function changePeriod(period) { state.period = period || 'current_month'; state.report = null; }
  function changeTarget(targetId) { state.targetId = String(targetId || ''); state.report = null; }
  async function submit(event) {
    event?.preventDefault?.(); if (state.loading) return false;
    const definition = reportType(); if (definition?.target && !state.targetId) { state.error = definition.target === 'work' ? 'Selecione uma obra.' : 'Selecione um funcionário.'; decorate(); return false; }
    state.loading = true; state.error = ''; state.report = null; decorate();
    try { const body = await api({ action: 'preview', type: state.type, targetId: state.targetId, period: { kind: state.period } }); state.report = body.report || null; }
    catch (error) { state.error = error?.message || 'Não foi possível preparar a prévia.'; }
    finally { state.loading = false; decorate(); document.getElementById('assistantReportsPhase3')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }
    return false;
  }
  const renderBeforePhaseThree = render;
  render = function renderWithAssistantPhaseThree() { const result = renderBeforePhaseThree(); if (page === PAGE_KEY) setTimeout(decorate, 0); return result; };
  const renderTopBeforePhaseThree = renderTop;
  renderTop = function renderTopWithAssistantPhaseThree() { const result = renderTopBeforePhaseThree(); if (page === PAGE_KEY && state.mode === 'reports') { const title = document.getElementById('headerPage'); if (title) title.textContent = 'Assistente da Obra · Relatórios'; } return result; };
  window.AssistantObraPhase3 = Object.freeze({ switchMode, changeType, changePeriod, changeTarget, submit, loadOptions, phase: 3, readOnly: true, previewOnly: true });
})();
