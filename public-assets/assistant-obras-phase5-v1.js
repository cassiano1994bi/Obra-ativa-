(function installAssistantObraPhaseFive() {
  'use strict';
  const ENDPOINT = '/.netlify/functions/assistant-obras-performance';
  const trackedFilters = { range: 'fortnight', from: '', to: '', workId: '' };
  const requestState = new Map();
  let installed = false;

  function escapeValue(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }
  function currency(value) { return Number.isFinite(Number(value)) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)) : '—'; }
  function decimal(value, digits = 1) { return Number.isFinite(Number(value)) ? Number(value).toLocaleString('pt-BR', { maximumFractionDigits: digits }) : '—'; }
  function requestContext() { const cloud = typeof CloudSync !== 'undefined' ? CloudSync : window.CloudSync; const workspace = typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace : window.CompanyWorkspace; return { token: cloud?.session?.access_token || '', companyId: workspace?.current?.id || '' }; }

  function installStyles() {
    if (document.getElementById('assistantPerformancePhaseFiveStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="assistantPerformancePhaseFiveStyle">
      .assistant-performance-v5{display:grid;gap:12px;padding:15px;border:1px solid #b9daca;border-radius:14px;background:linear-gradient(135deg,#f7fff9,#f2f8ff);color:#183f52}.assistant-performance-v5 *{box-sizing:border-box}
      .assistant-performance-v5-head{display:flex;align-items:flex-start;justify-content:space-between;gap:13px}.assistant-performance-v5-kicker{display:block;color:#14734c;font-size:9px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.assistant-performance-v5 h3{margin:4px 0;color:#174b3b;font-size:18px}.assistant-performance-v5-head p,.assistant-performance-v5-intro{margin:4px 0 0;color:#607a73;font-size:11px;line-height:1.5}.assistant-performance-v5-lock{flex:0 0 auto;padding:7px 9px;border:1px solid #aed7c3;border-radius:999px;background:#eaf8f1;color:#126c48;font-size:9px;font-weight:900;white-space:nowrap}
      .assistant-performance-v5-action{justify-self:start;min-height:43px;padding:10px 15px;border:1px solid #176bd7;border-radius:10px;background:#1d70dc;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 6px 14px #1d70dc2b}.assistant-performance-v5-action:disabled{opacity:.58;cursor:wait}.assistant-performance-v5-loading{display:flex;align-items:center;gap:9px;padding:12px;border-radius:10px;background:#edf6fb;color:#3c687d;font-size:11px;font-weight:800}.assistant-performance-v5-loading:before{content:'';width:15px;height:15px;border:2px solid #aac9d8;border-top-color:#1d70dc;border-radius:50%;animation:assistantPerformanceSpin .8s linear infinite}@keyframes assistantPerformanceSpin{to{transform:rotate(360deg)}}.assistant-performance-v5-error{padding:11px 12px;border:1px solid #efcaca;border-radius:10px;background:#fff1f1;color:#9a3939;font-size:11px}
      .assistant-performance-v5-score{display:grid;grid-template-columns:minmax(145px,.65fr) minmax(0,2fr);gap:10px}.assistant-performance-v5-score article,.assistant-performance-v5-summary{padding:12px;border:1px solid #d9e7e1;border-radius:11px;background:#fff}.assistant-performance-v5-score small{display:block;color:#6b8178;font-size:8px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}.assistant-performance-v5-score b{display:block;margin-top:5px;color:#166b49;font-size:26px}.assistant-performance-v5-score span{display:block;margin-top:3px;color:#71837c;font-size:9px}.assistant-performance-v5-summary{color:#4f6f63;font-size:11px;line-height:1.55}
      .assistant-performance-v5-criteria{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.assistant-performance-v5-criteria div{min-width:0;padding:9px;border:1px solid #dce9e3;border-radius:9px;background:#fff}.assistant-performance-v5-criteria small,.assistant-performance-v5-criteria b{display:block}.assistant-performance-v5-criteria small{color:#70837b;font-size:8px;line-height:1.3}.assistant-performance-v5-criteria b{margin-top:4px;color:#235442;font-size:12px}.assistant-performance-v5-criteria .missing b{color:#926423}
      .assistant-performance-v5 h4{margin:2px 0 0;color:#1d4d3e;font-size:13px}.assistant-performance-v5-evidence,.assistant-performance-v5-recommendations{display:grid;gap:6px;margin:0;padding-left:18px;color:#526f65;font-size:10px;line-height:1.45}.assistant-performance-v5-works{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.assistant-performance-v5-work{padding:10px;border:1px solid #dbe7e2;border-radius:10px;background:#fff}.assistant-performance-v5-work b{display:block;color:#214e3f;font-size:11px}.assistant-performance-v5-work p{margin:5px 0 0;color:#667b74;font-size:9px;line-height:1.5}.assistant-performance-v5-quality{padding:10px 12px;border-radius:10px;background:#fff8e9;color:#7e622b;font-size:10px;line-height:1.5}.assistant-performance-v5-safeguards{padding:10px 12px;border:1px dashed #bcd5c8;border-radius:10px;background:#f8fcfa}.assistant-performance-v5-safeguards summary{cursor:pointer;color:#365f50;font-size:10px;font-weight:900}.assistant-performance-v5-safeguards ul{margin:8px 0 0;padding-left:18px;color:#637970;font-size:9px;line-height:1.5}
      @media(max-width:950px){.assistant-performance-v5-criteria{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:700px){.assistant-performance-v5-head{display:grid}.assistant-performance-v5-lock{justify-self:start}.assistant-performance-v5-score{grid-template-columns:1fr}.assistant-performance-v5-works{grid-template-columns:1fr}.assistant-performance-v5-criteria{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:430px){.assistant-performance-v5-criteria{grid-template-columns:1fr}.assistant-performance-v5-action{width:100%}}
    </style>`);
  }

  function initialMarkup(employeeId) {
    return `<section class="assistant-performance-v5" id="assistantPerformancePhase5" data-employee-id="${escapeValue(employeeId)}"><header class="assistant-performance-v5-head"><div><span class="assistant-performance-v5-kicker">Fase 5 · Explicação inteligente</span><h3>Entenda a pontuação oficial</h3><p>A Assistente cruza as evidências já autorizadas e explica a nota existente. Ela não substitui nem recalcula a fórmula oficial.</p></div><span class="assistant-performance-v5-lock">🔒 Fórmula preservada</span></header><p class="assistant-performance-v5-intro">A explicação considera presença, escala, obras, custos, recebimentos efetivos, despesas, avanço e histórico disponíveis. Resultado associado nunca é apresentado como culpa ou mérito individual.</p><button class="assistant-performance-v5-action" type="button">Explicar com a Assistente</button><div class="assistant-performance-v5-result" aria-live="polite"></div></section>`;
  }

  function criteriaMarkup(rows) {
    return `<div class="assistant-performance-v5-criteria">${(rows || []).map((item) => `<div class="${item.available ? '' : 'missing'}"><small>${escapeValue(item.label)} · peso ${escapeValue(item.weight)}</small><b>${item.available ? `${decimal(item.points)} pts` : 'Sem dados'}</b></div>`).join('')}</div>`;
  }

  function worksMarkup(rows) {
    if (!rows?.length) return '<div class="assistant-performance-v5-quality">Nenhuma obra ficou associada às presenças deste período.</div>';
    return `<div class="assistant-performance-v5-works">${rows.map((item) => `<article class="assistant-performance-v5-work"><b>🏗️ ${escapeValue(item.name)}</b><p>${decimal(item.workedUnits)} diária(s) · participação estatística ${decimal(item.participation * 100)}%<br>Mão de obra: ${currency(item.laborCost)} · recebido: ${currency(item.received)} · medido: ${currency(item.measured)}<br>Despesas: ${currency(item.expenses)} · resultado associado: ${currency(item.associatedResult)}<br>Avanço registrado: ${Number.isFinite(item.progressPercent) ? `${decimal(item.progressPercent)}% em ${item.phaseCount} fase(s)` : 'sem fases suficientes'}${item.financialComplete ? '' : `<br><strong>Financeiro incompleto:</strong> ${escapeValue(item.financialIssue || 'sem recebimento efetivo')}`}</p></article>`).join('')}</div>`;
  }

  function loadedMarkup(value) {
    const official = value.official || {};
    const status = official.sufficient ? 'Nota completa' : official.rankable ? 'Nota provisória' : 'Sem nota';
    const quality = value.quality?.missing || [];
    return `<div class="assistant-performance-v5-score"><article><small>Pontuação da fórmula oficial</small><b>${official.rankable ? Math.round(official.displayScore) : '—'}</b><span>${escapeValue(status)} · ${escapeValue(value.period?.label || '')}</span></article><div class="assistant-performance-v5-summary">${escapeValue(value.explanation?.summary || '')}</div></div><h4>Como a fórmula oficial foi composta</h4>${criteriaMarkup(official.criteria)}<h4>Evidências usadas na explicação</h4><ul class="assistant-performance-v5-evidence">${(value.explanation?.evidence || []).map((item) => `<li>${escapeValue(item)}</li>`).join('')}</ul><h4>Participação nas obras</h4>${worksMarkup(value.works)}${quality.length ? `<div class="assistant-performance-v5-quality"><b>Dados que pedem conferência:</b> ${escapeValue(quality.join('; '))}.</div>` : ''}<h4>Próximas conferências sugeridas</h4><ul class="assistant-performance-v5-recommendations">${(value.explanation?.recommendations || []).map((item) => `<li>${escapeValue(item)}</li>`).join('')}</ul><details class="assistant-performance-v5-safeguards"><summary>Limites e proteção desta explicação</summary><ul>${(value.explanation?.safeguards || []).map((item) => `<li>${escapeValue(item)}</li>`).join('')}</ul></details>`;
  }

  async function api(employeeId) {
    const { token, companyId } = requestContext();
    if (!token || !companyId) throw new Error('Entre na sua conta e selecione uma empresa para visualizar a explicação.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const requestId = window.crypto?.randomUUID?.() || `performance-${Date.now()}`;
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-request-id': requestId }, body: JSON.stringify({ action: 'explain', companyId, employeeId, filters: { ...trackedFilters }, requestId }), signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok !== true) throw new Error(body?.error || 'Não foi possível explicar a pontuação agora.');
      return body.performance;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('A explicação demorou mais que o esperado. Tente novamente.');
      throw error;
    } finally { clearTimeout(timeout); }
  }

  async function explain(employeeId, panel) {
    if (!panel || requestState.get(employeeId) === 'loading') return;
    const result = panel.querySelector('.assistant-performance-v5-result');
    const button = panel.querySelector('.assistant-performance-v5-action');
    requestState.set(employeeId, 'loading');
    if (button) { button.disabled = true; button.textContent = 'Explicando…'; }
    if (result) result.innerHTML = '<div class="assistant-performance-v5-loading">Cruzando a fórmula oficial com as evidências autorizadas</div>';
    try {
      const value = await api(employeeId);
      requestState.set(employeeId, 'loaded');
      if (result) result.innerHTML = loadedMarkup(value);
      if (button) button.remove();
    } catch (error) {
      requestState.set(employeeId, 'error');
      if (result) result.innerHTML = `<div class="assistant-performance-v5-error" role="alert">${escapeValue(error?.message || 'Não foi possível explicar a pontuação.')}</div>`;
      if (button) { button.disabled = false; button.textContent = 'Tentar novamente'; }
    }
  }

  function decorateProfile(employeeId) {
    installStyles();
    const dialog = document.getElementById('dialog');
    const profile = dialog?.querySelector('.employee-performance-profile');
    if (!dialog || !profile) return;
    dialog.querySelector('#assistantPerformancePhase5')?.remove();
    const footer = dialog.querySelector(':scope > footer');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = initialMarkup(employeeId);
    const panel = wrapper.firstElementChild;
    if (!panel) return;
    if (footer) dialog.insertBefore(panel, footer); else dialog.appendChild(panel);
    panel.querySelector('.assistant-performance-v5-action')?.addEventListener('click', () => explain(employeeId, panel));
  }

  function installWrappers() {
    if (installed || typeof window.openEmployeePerformanceProfile !== 'function' || typeof window.setEmployeePerformanceFilter !== 'function') return false;
    installed = true;
    installStyles();
    const originalFilter = window.setEmployeePerformanceFilter;
    window.setEmployeePerformanceFilter = function setEmployeePerformanceFilterWithAssistant(key, value) {
      if (Object.prototype.hasOwnProperty.call(trackedFilters, key)) trackedFilters[key] = value;
      return originalFilter.apply(this, arguments);
    };
    const originalProfile = window.openEmployeePerformanceProfile;
    window.openEmployeePerformanceProfile = function openEmployeePerformanceProfileWithAssistant(employeeId) {
      const result = originalProfile.apply(this, arguments);
      setTimeout(() => decorateProfile(employeeId), 0);
      return result;
    };
    return true;
  }

  function attemptInstall() {
    if (installWrappers()) return;
    let attempts = 0;
    const timer = setInterval(() => { attempts += 1; if (installWrappers() || attempts >= 40) clearInterval(timer); }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attemptInstall, { once: true });
  else attemptInstall();
  window.AssistantObraPhase5 = Object.freeze({ phase: 5, readOnly: true, officialFormulaPreserved: true, filters: () => ({ ...trackedFilters }) });
})();
