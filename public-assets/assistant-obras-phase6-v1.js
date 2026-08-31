(function installAssistantObraPhaseSix() {
  'use strict';
  const PAGE_KEY = 'assistant';
  const ENDPOINT = '/.netlify/functions/assistant-obras-actions';
  const state = { mode: 'chat', options: null, loadingOptions: false, type: 'scale', proposal: null, error: '', success: '', confirming: false };

  function escapeValue(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
  function dateNow() { return typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10); }
  function dateTomorrow() { if (typeof tomorrow === 'function') return tomorrow(); const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); }
  function companyId() { return String((typeof CompanyWorkspace !== 'undefined' ? CompanyWorkspace : window.CompanyWorkspace)?.current?.id || ''); }
  function userId() { return String((typeof CloudSync !== 'undefined' ? CloudSync : window.CloudSync)?.session?.user?.id || ''); }
  function token() { return String((typeof CloudSync !== 'undefined' ? CloudSync : window.CloudSync)?.session?.access_token || ''); }
  function selectedAction() { return state.options?.find((item) => item.type === state.type) || null; }
  function actionAllowed(type) { return state.options?.some((item) => item.type === type && item.allowed) === true; }
  function formatMoney(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0)); }

  function installStyles() {
    if (document.getElementById('assistantObraPhaseSixStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="assistantObraPhaseSixStyle">
      #assistantPhaseNavigationV6{display:flex;align-items:center;gap:7px;max-width:1500px;margin:0 auto 14px;padding:7px;border:1px solid #d5e5de;border-radius:14px;background:#f8fcfa;overflow-x:auto;scrollbar-width:none}#assistantPhaseNavigationV6::-webkit-scrollbar{display:none}#assistantPhaseNavigationV6 button{flex:0 0 auto;min-height:44px;padding:9px 14px;border:1px solid transparent;border-radius:10px;background:transparent;color:#52707d;font-weight:850;cursor:pointer}#assistantPhaseNavigationV6 button.active{border-color:#a7d4c0;background:#fff;color:#126d49;box-shadow:0 4px 12px #173e6210}
      #assistantActionsPhase6[hidden],#assistantObraPhase2[hidden],#assistantReportsPhase3[hidden],#assistantInsightsPhase4[hidden]{display:none!important}#assistantActionsPhase6{display:grid;gap:15px;max-width:1500px;margin:0 auto;color:#173d55}#assistantActionsPhase6 *{box-sizing:border-box}
      .assistant-action-hero{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:20px 22px;border:1px solid #d5e6de;border-radius:19px;background:linear-gradient(135deg,#f7fff9,#eef7ff);box-shadow:0 9px 26px #173e6210}.assistant-action-kicker{display:block;color:#16734d;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.assistant-action-hero h1{margin:4px 0 5px;color:#113f5a;font-size:clamp(25px,3vw,38px)}.assistant-action-hero p{max-width:850px;margin:0;color:#677d87;font-size:13px;line-height:1.5}.assistant-action-lock{flex:0 0 auto;padding:9px 12px;border:1px solid #b7decd;border-radius:999px;background:#eaf8f1;color:#146d49;font-size:10px;font-weight:900;white-space:nowrap}
      .assistant-action-types{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.assistant-action-type{min-height:76px;padding:11px;border:1px solid #d8e6e0;border-radius:12px;background:#fff;color:#315b4d;font-weight:850;cursor:pointer;line-height:1.3}.assistant-action-type.active{border-color:#69a9e7;background:#ebf4ff;color:#125fae;box-shadow:inset 0 0 0 1px #b9d7f4}.assistant-action-type:disabled{opacity:.45;cursor:not-allowed}.assistant-action-type small{display:block;margin-top:4px;color:#7a8a84;font-size:8px;font-weight:700}
      .assistant-action-workspace{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1.45fr);gap:13px}.assistant-action-form,.assistant-action-preview{min-width:0;padding:16px;border:1px solid #d9e6e0;border-radius:15px;background:#fff;box-shadow:0 7px 20px #173e620b}.assistant-action-form{display:grid;align-content:start;gap:11px}.assistant-action-form h2,.assistant-action-preview h2{margin:0;color:#174b3b;font-size:18px}.assistant-action-form p{margin:0;color:#6a7f77;font-size:10px;line-height:1.5}.assistant-action-field{display:grid;gap:5px;min-width:0}.assistant-action-field label{color:#4c685e;font-size:9px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}.assistant-action-field input,.assistant-action-field select,.assistant-action-field textarea{width:100%;min-height:43px;padding:9px 10px;border:1px solid #cfdee5;border-radius:9px;background:#fff;color:#173d55;font:inherit}.assistant-action-field textarea{min-height:72px;resize:vertical}.assistant-action-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.assistant-action-prepare{min-height:46px;padding:10px 15px;border:1px solid #1769d2;border-radius:10px;background:#1d70dc;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 6px 14px #1d70dc2e}.assistant-action-prepare:disabled{opacity:.55}.assistant-action-payment-list{display:grid;gap:6px;max-height:230px;overflow:auto;padding:8px;border:1px solid #dbe5ea;border-radius:10px;background:#f9fbfc}.assistant-action-payment-row{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:8px;border-radius:8px;background:#fff;font-size:10px}.assistant-action-payment-row label{display:flex;align-items:center;gap:7px;font-weight:800}.assistant-action-payment-row input{width:17px;height:17px}
      .assistant-action-preview{display:grid;align-content:start;gap:11px}.assistant-action-empty{padding:28px;border:1px dashed #c6d8d0;border-radius:12px;background:#fafdfb;color:#6f827a;text-align:center;font-size:11px;line-height:1.5}.assistant-action-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.assistant-action-meta div{padding:9px;border-radius:9px;background:#f2f7f5}.assistant-action-meta small,.assistant-action-meta b{display:block}.assistant-action-meta small{color:#72837d;font-size:8px}.assistant-action-meta b{margin-top:3px;color:#214d3f;font-size:11px;overflow-wrap:anywhere}.assistant-action-compare{display:grid;grid-template-columns:1fr 1fr;gap:8px}.assistant-action-compare section{padding:10px;border:1px solid #dfe8e4;border-radius:10px;background:#fafcfb}.assistant-action-compare h3{margin:0 0 6px;font-size:11px}.assistant-action-compare ul{display:grid;gap:4px;margin:0;padding-left:16px;color:#61766e;font-size:9px;line-height:1.4}.assistant-action-warnings{padding:10px;border-radius:9px;background:#fff6e5;color:#866223;font-size:9px;line-height:1.5}.assistant-action-status-grid{display:grid;gap:6px}.assistant-action-status-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(140px,.7fr);gap:8px;align-items:center;padding:8px;border:1px solid #e0e9e5;border-radius:9px}.assistant-action-status-row b{font-size:10px}.assistant-action-status-row small{display:block;margin-top:3px;color:#76877f;font-size:8px}.assistant-action-status-row select{min-height:38px;border:1px solid #cfdee5;border-radius:8px;background:#fff}.assistant-action-reinforced{display:grid;gap:6px;padding:10px;border:1px solid #efcf9b;border-radius:10px;background:#fffaf0}.assistant-action-reinforced label{color:#7e5e29;font-size:9px;font-weight:900}.assistant-action-reinforced input{min-height:42px;padding:9px;border:1px solid #dcc18e;border-radius:8px}.assistant-action-confirm{min-height:48px;padding:11px 16px;border:1px solid #178154;border-radius:10px;background:#19875a;color:#fff;font-weight:900;cursor:pointer;box-shadow:0 7px 16px #19875a2d}.assistant-action-confirm:disabled{opacity:.55;cursor:wait}.assistant-action-error,.assistant-action-success{padding:11px 13px;border-radius:10px;font-size:10px;line-height:1.45}.assistant-action-error{border:1px solid #efcccc;background:#fff1f1;color:#9a3b3b}.assistant-action-success{border:1px solid #b9dec9;background:#edf9f2;color:#176b48}.assistant-action-safety{padding:12px;border:1px dashed #bcd5c8;border-radius:11px;background:#f8fcfa;color:#5e756c;font-size:9px;line-height:1.5}
      @media(max-width:1180px){.assistant-action-types{grid-template-columns:repeat(3,minmax(0,1fr))}.assistant-action-meta{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:780px){.assistant-action-hero{display:grid;padding:16px}.assistant-action-lock{justify-self:start}.assistant-action-workspace{grid-template-columns:1fr}.assistant-action-types{grid-template-columns:repeat(2,minmax(0,1fr))}.assistant-action-compare{grid-template-columns:1fr}.assistant-action-status-row{grid-template-columns:1fr}}
      @media(max-width:480px){#assistantPhaseNavigationV6{display:grid;grid-template-columns:1fr 1fr;overflow:visible}#assistantPhaseNavigationV6 button{width:100%}.assistant-action-fields,.assistant-action-types,.assistant-action-meta{grid-template-columns:1fr}.assistant-action-type{min-height:54px}}
    </style>`);
  }

  function actionTypeMarkup() {
    const icons = { scale: '📋', attendance: '🗓️', reminder: '⏰', whatsapp: '💬', report: '📄', payments: '💰' };
    return `<section class="assistant-action-types">${(state.options || []).map((item) => `<button class="assistant-action-type ${state.type === item.type ? 'active' : ''}" type="button" onclick="AssistantObraPhase6.selectType('${escapeValue(item.type)}')" ${item.allowed ? '' : 'disabled'}>${icons[item.type] || '✓'} ${escapeValue(item.label)}<small>${item.allowed ? (item.reinforced ? 'confirmação reforçada' : 'confirmação explícita') : 'sem permissão'}</small></button>`).join('')}</section>`;
  }

  function workOptions(selected = '') { return `<option value="">Sem obra específica</option>${(db?.works || []).filter((item) => item && !item.archived).map((item) => `<option value="${escapeValue(item.id)}" ${String(item.id) === String(selected) ? 'selected' : ''}>${escapeValue(item.name)}</option>`).join('')}`; }
  function payrollRowsMarkup() {
    let date = typeof selectedPaymentCycle === 'function' ? selectedPaymentCycle() : typeof nextFriday === 'function' ? nextFriday() : dateNow();
    let rows = typeof payroll === 'function' ? payroll(date).filter((row) => Number(row.balance || 0) > 0) : [];
    return `<div class="assistant-action-field"><label>Ciclo oficial</label><input id="assistantActionCycle" type="date" value="${escapeValue(date)}" readonly></div><div class="assistant-action-payment-list">${rows.length ? rows.map((row) => `<div class="assistant-action-payment-row"><label><input type="checkbox" data-action-payment="${escapeValue(row.e.id)}"><span>${escapeValue(row.e.name)}</span></label><b>${escapeValue(formatMoney(row.balance))}</b></div>`).join('') : '<span style="font-size:10px;color:#74877f">Nenhum saldo pendente encontrado no ciclo oficial.</span>'}</div>`;
  }

  function formFields() {
    if (state.type === 'scale') return `<div class="assistant-action-fields"><div class="assistant-action-field"><label>Copiar escala de</label><input id="assistantActionSourceDate" type="date" value="${dateNow()}"></div><div class="assistant-action-field"><label>Para a data</label><input id="assistantActionDate" type="date" value="${dateTomorrow()}"></div></div>`;
    if (state.type === 'attendance') return `<div class="assistant-action-field"><label>Data da presença</label><input id="assistantActionDate" type="date" value="${dateNow()}"></div><p>Os status não serão adivinhados: você escolherá cada um na prévia antes de confirmar.</p>`;
    if (state.type === 'reminder') return `<div class="assistant-action-field"><label>Título do lembrete</label><input id="assistantActionTitle" maxlength="180" placeholder="Descreva o compromisso"></div><div class="assistant-action-fields"><div class="assistant-action-field"><label>Data</label><input id="assistantActionDate" type="date" value="${dateTomorrow()}"></div><div class="assistant-action-field"><label>Horário</label><input id="assistantActionTime" type="time"></div></div><div class="assistant-action-field"><label>Obra</label><select id="assistantActionWork">${workOptions()}</select></div><div class="assistant-action-field"><label>Observação</label><textarea id="assistantActionNotes" maxlength="600"></textarea></div>`;
    if (state.type === 'whatsapp') return `<div class="assistant-action-field"><label>Data da escala</label><input id="assistantActionDate" type="date" value="${dateTomorrow()}"></div><p>A Assistente somente copiará a lista. Ela não abrirá conversa nem enviará mensagem.</p>`;
    if (state.type === 'report') return `<div class="assistant-action-field"><label>Tipo de relatório</label><select id="assistantActionReportType"><option value="daily">Diário</option><option value="weekly">Semanal</option><option value="fortnightly">Quinzenal</option><option value="financial">Financeiro</option><option value="payments">Pagamentos</option><option value="team">Equipe</option><option value="vehicles">Veículos</option><option value="performance">Desempenho</option></select></div><p>A confirmação somente abrirá a área oficial de relatórios. Nada será salvo ou publicado.</p>`;
    if (state.type === 'payments') return `${payrollRowsMarkup()}<p>A Assistente não marcará ninguém como pago. Após a confirmação reforçada, abrirá a lista oficial para você conferir e usar o botão original.</p>`;
    return '';
  }

  function formMarkup() {
    const action = selectedAction();
    if (!action) return '<div class="assistant-action-empty">Carregando ações autorizadas…</div>';
    return `<section class="assistant-action-form"><div><h2>${escapeValue(action.label)}</h2><p>Primeiro prepare a prévia. Nenhuma ação ocorre neste passo.</p></div><div class="assistant-action-field"><label>Pedido original</label><textarea id="assistantActionRequest" maxlength="500">${escapeValue(action.label)}</textarea></div>${formFields()}<button class="assistant-action-prepare" type="button" onclick="AssistantObraPhase6.prepare()">Preparar prévia</button>${state.error ? `<div class="assistant-action-error" role="alert">${escapeValue(state.error)}</div>` : ''}${state.success ? `<div class="assistant-action-success">${escapeValue(state.success)}</div>` : ''}<div class="assistant-action-safety">A prévia não grava nada. Antes da confirmação, a empresa, o usuário, as permissões e o estado atual dos registros serão verificados novamente.</div></section>`;
  }

  function attendanceControls(proposal) {
    if (proposal.type !== 'attendance') return '';
    return `<div class="assistant-action-status-grid">${proposal.items.map((item) => `<div class="assistant-action-status-row"><div><b>${escapeValue(item.employeeName)}</b><small>${escapeValue(item.workName)} · ${escapeValue(item.date)}</small></div><select data-attendance-status="${escapeValue(item.employeeId)}"><option value="">Escolha o status</option>${AssistantActionsCore.ATTENDANCE_STATUSES.map((status) => `<option value="${escapeValue(status)}">${escapeValue(status)}</option>`).join('')}</select></div>`).join('')}</div>`;
  }

  function previewMarkup() {
    const proposal = state.proposal;
    if (!proposal) return '<section class="assistant-action-preview"><h2>Prévia da ação</h2><div class="assistant-action-empty">Escolha uma ação e clique em <b>Preparar prévia</b>. Aqui aparecerão registros, datas, obras, funcionários, valores e a comparação antes/depois.</div></section>';
    const phrase = proposal.type === 'payments' ? 'CONFIRMAR PAGAMENTOS' : proposal.type === 'whatsapp' ? 'CONFIRMAR CÓPIA' : '';
    return `<section class="assistant-action-preview"><h2>Prévia — ${escapeValue(proposal.label)}</h2><div class="assistant-action-meta"><div><small>REGISTROS</small><b>${proposal.items.length}</b></div><div><small>DATA</small><b>${escapeValue(proposal.date || '—')}</b></div><div><small>OBRAS</small><b>${proposal.workIds?.length || 0}</b></div><div><small>VALORES</small><b>${proposal.values?.total ? escapeValue(formatMoney(proposal.values.total)) : '—'}</b></div></div>${attendanceControls(proposal)}<div class="assistant-action-compare"><section><h3>Antes</h3><ul>${(proposal.before || []).map((item) => `<li>${escapeValue(item)}</li>`).join('') || '<li>Sem alteração registrada.</li>'}</ul></section><section><h3>Depois da confirmação</h3><ul>${(proposal.after || []).map((item) => `<li>${escapeValue(item)}</li>`).join('') || '<li>Nenhuma gravação será feita.</li>'}</ul></section></div>${proposal.message ? `<div class="assistant-action-field"><label>Texto preparado</label><textarea readonly>${escapeValue(proposal.message)}</textarea></div>` : ''}${proposal.warnings?.length ? `<div class="assistant-action-warnings"><b>Conferir:</b><br>${proposal.warnings.map(escapeValue).join('<br>')}</div>` : ''}${phrase ? `<div class="assistant-action-reinforced"><label>Confirmação reforçada: digite ${escapeValue(phrase)}</label><input id="assistantActionPhrase" autocomplete="off" placeholder="${escapeValue(phrase)}"></div>` : ''}<button class="assistant-action-confirm" type="button" onclick="AssistantObraPhase6.confirm()" ${state.confirming ? 'disabled' : ''}>${state.confirming ? 'Confirmando…' : proposal.type === 'payments' ? 'Confirmar e abrir pagamentos' : proposal.type === 'report' ? 'Confirmar e abrir relatórios' : proposal.type === 'whatsapp' ? 'Confirmar e copiar lista' : 'Confirmar ação'}</button></section>`;
  }

  function areaMarkup() {
    return `<section id="assistantActionsPhase6" ${state.mode === 'actions' ? '' : 'hidden'}><section class="assistant-action-hero"><div><span class="assistant-action-kicker">Fase 6 · Ações com confirmação</span><h1>A Assistente prepara. Você decide.</h1><p>Nada é executado a partir de uma mensagem ambígua. Primeiro aparece a prévia completa; depois o servidor reconfirma empresa e permissões; somente então o botão explícito pode usar o fluxo nativo.</p></div><span class="assistant-action-lock">🛡️ Confirmação obrigatória</span></section>${actionTypeMarkup()}<section class="assistant-action-workspace">${formMarkup()}${previewMarkup()}</section></section>`;
  }

  function navigationMarkup() { return `<nav id="assistantPhaseNavigationV6" aria-label="Áreas do Assistente da Obra"><button type="button" class="${state.mode === 'chat' ? 'active' : ''}" onclick="AssistantObraPhase6.switchMode('chat')">💬 Conversa</button><button type="button" class="${state.mode === 'reports' ? 'active' : ''}" onclick="AssistantObraPhase6.switchMode('reports')">📄 Relatórios</button><button type="button" class="${state.mode === 'alerts' ? 'active' : ''}" onclick="AssistantObraPhase6.switchMode('alerts')">⚠️ Alertas</button><button type="button" class="${state.mode === 'actions' ? 'active' : ''}" onclick="AssistantObraPhase6.switchMode('actions')">✅ Ações</button></nav>`; }

  function decorate() {
    installStyles();
    const phase2 = document.getElementById('assistantObraPhase2');
    if (!phase2) return;
    document.getElementById('assistantPhaseNavigationV4')?.remove(); document.getElementById('assistantPhaseNavigationV6')?.remove(); document.getElementById('assistantActionsPhase6')?.remove();
    phase2.insertAdjacentHTML('beforebegin', navigationMarkup());
    const insights = document.getElementById('assistantInsightsPhase4');
    (insights || document.getElementById('assistantReportsPhase3') || phase2).insertAdjacentHTML('afterend', areaMarkup());
    phase2.hidden = state.mode !== 'chat';
    const reports = document.getElementById('assistantReportsPhase3'); if (reports) reports.hidden = state.mode !== 'reports';
    if (insights) insights.hidden = state.mode !== 'alerts';
  }

  async function api(payload) {
    if (!token() || !companyId()) throw new Error('Entre na sua conta e selecione uma empresa para preparar ações.');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const requestId = window.crypto?.randomUUID?.() || `action-${Date.now()}`;
      const response = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token()}`, 'x-request-id': requestId }, body: JSON.stringify({ ...payload, companyId: companyId(), requestId }), signal: controller.signal });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok !== true) throw new Error(body?.error || 'Não foi possível validar a ação.');
      return body;
    } catch (error) { if (error?.name === 'AbortError') throw new Error('A validação demorou mais que o esperado. Tente novamente.'); throw error; } finally { clearTimeout(timeout); }
  }

  async function loadOptions() {
    if (state.options || state.loadingOptions) return;
    state.loadingOptions = true; decorate();
    try { const body = await api({ action: 'options' }); state.options = body.actions || []; if (!actionAllowed(state.type)) state.type = state.options.find((item) => item.allowed)?.type || ''; }
    catch (error) { state.error = error?.message || 'Não foi possível carregar as ações.'; state.options = []; }
    finally { state.loadingOptions = false; decorate(); }
  }

  function switchMode(mode) {
    state.mode = ['chat', 'reports', 'alerts', 'actions'].includes(mode) ? mode : 'chat';
    window.AssistantObraPhase4?.switchMode?.(state.mode === 'actions' ? 'chat' : state.mode);
    setTimeout(() => { decorate(); if (state.mode === 'actions') loadOptions(); const title = document.getElementById('headerPage'); if (title && state.mode === 'actions') title.textContent = 'Assistente da Obra · Ações'; }, 0);
  }
  function selectType(type) { if (!actionAllowed(type)) return; state.type = type; state.proposal = null; state.error = ''; state.success = ''; decorate(); }

  function setField(id, value) {
    if (value == null || value === '') return;
    const field = document.getElementById(id);
    if (field) field.value = String(value);
  }

  async function startCommand(type, payload = {}) {
    if (!Object.prototype.hasOwnProperty.call(AssistantActionsCore.ACTION_DEFINITIONS, type)) return { ok: false, message: 'Essa ação não pertence à lista segura da Assistente.' };
    state.mode = 'actions'; state.error = ''; state.success = ''; state.proposal = null;
    window.AssistantObraPhase4?.switchMode?.('chat');
    decorate();
    await loadOptions();
    if (!actionAllowed(type)) { state.error = 'Seu perfil não possui permissão para preparar essa ação.'; decorate(); return { ok: false, message: state.error }; }
    state.type = type; decorate();
    setField('assistantActionRequest', payload.originalRequest || AssistantActionsCore.ACTION_DEFINITIONS[type].label);
    setField('assistantActionDate', payload.date || payload.targetDate);
    setField('assistantActionSourceDate', payload.sourceDate);
    setField('assistantActionReportType', payload.reportType);
    setField('assistantActionTitle', payload.title);
    setField('assistantActionTime', payload.time);
    setField('assistantActionNotes', payload.notes);
    setField('assistantActionWork', payload.workId);
    if (payload.prepare === true) prepare();
    const title = document.getElementById('headerPage');
    if (title) title.textContent = 'Assistente da Obra · Ações';
    return { ok: true, message: payload.prepare === true ? 'Prévia segura preparada. Confira e confirme no aplicativo.' : 'A ação foi aberta para você completar e confirmar.' };
  }

  function originalRequest() { return document.getElementById('assistantActionRequest')?.value?.trim() || selectedAction()?.label || ''; }
  function prepare() {
    state.error = ''; state.success = ''; state.proposal = null;
    try {
      const common = { data: db, companyId: companyId(), originalRequest: originalRequest() };
      if (state.type === 'scale') state.proposal = AssistantActionsCore.buildScaleProposal({ ...common, sourceDate: document.getElementById('assistantActionSourceDate')?.value, targetDate: document.getElementById('assistantActionDate')?.value });
      else if (state.type === 'attendance') state.proposal = AssistantActionsCore.buildAttendanceProposal({ ...common, date: document.getElementById('assistantActionDate')?.value });
      else if (state.type === 'reminder') state.proposal = AssistantActionsCore.buildReminderProposal({ ...common, title: document.getElementById('assistantActionTitle')?.value, date: document.getElementById('assistantActionDate')?.value, time: document.getElementById('assistantActionTime')?.value, workId: document.getElementById('assistantActionWork')?.value, notes: document.getElementById('assistantActionNotes')?.value });
      else if (state.type === 'whatsapp') state.proposal = AssistantActionsCore.buildWhatsAppProposal({ ...common, date: document.getElementById('assistantActionDate')?.value });
      else if (state.type === 'report') state.proposal = AssistantActionsCore.buildReportProposal({ ...common, reportType: document.getElementById('assistantActionReportType')?.value });
      else if (state.type === 'payments') {
        const cycleDate = document.getElementById('assistantActionCycle')?.value;
        const payrollRows = typeof payroll === 'function' ? payroll(cycleDate).map((row) => ({ employeeId: row.e.id, employeeName: row.e.name, balance: Number(row.balance || 0) })) : [];
        const selectedEmployeeIds = [...document.querySelectorAll('[data-action-payment]:checked')].map((item) => item.dataset.actionPayment);
        state.proposal = AssistantActionsCore.buildPaymentsProposal({ ...common, cycleDate, payrollRows, selectedEmployeeIds });
      }
    } catch (error) { state.error = error?.message || 'Não foi possível preparar a prévia.'; }
    decorate();
  }

  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); return true; }
    catch { const area = document.createElement('textarea'); area.value = value; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); const ok = document.execCommand('copy'); area.remove(); return ok; }
  }

  async function confirm() {
    if (!state.proposal || state.confirming) return;
    const selectedStatuses = {};
    document.querySelectorAll('[data-attendance-status]').forEach((select) => { selectedStatuses[select.dataset.attendanceStatus] = select.value; });
    const reinforcedPhrase = document.getElementById('assistantActionPhrase')?.value || '';
    state.error = ''; state.success = '';
    try {
      let proposal = state.proposal;
      if (proposal.type === 'attendance') {
        proposal = AssistantActionsCore.withAttendanceStatuses(proposal, selectedStatuses);
        state.proposal = proposal;
      }
      AssistantActionsCore.validateProposal(proposal, { requireReady: true });
      if (typeof save !== 'function') throw new Error('O fluxo nativo de salvamento não está disponível.');
      state.confirming = true; decorate();
      const body = await api({ action: 'confirm', proposal, explicit: true, confirmationPhrase: reinforcedPhrase });
      const result = AssistantActionsCore.applyConfirmedProposal({ data: db, proposal, confirmation: body.confirmation, currentCompanyId: companyId(), currentUserId: userId(), uid: typeof uid === 'function' ? uid : undefined });
      save('Assistente da Obra: ação confirmada', `${proposal.label} · ${result.affectedRecords.length} registro(s) afetado(s) · confirmação ${body.confirmation.id}`);
      if (proposal.type === 'whatsapp') { const copied = await copyText(proposal.message || ''); if (!copied) throw new Error('A ação foi confirmada, mas não foi possível copiar o texto.'); }
      state.success = result.dataChanged ? 'Ação confirmada e salva pelo fluxo oficial da empresa.' : 'Preparação confirmada. Nenhum pagamento, envio ou publicação foi realizado pela Assistente.';
      state.proposal = null;
      if (proposal.type === 'report') { window.AssistantObraPhase3?.switchMode?.('reports'); state.mode = 'reports'; }
      if (proposal.type === 'payments' && typeof go === 'function') go('payments');
      if (typeof render === 'function' && ['scale', 'attendance', 'reminder'].includes(proposal.type)) render();
    } catch (error) { state.error = error?.message || 'Não foi possível confirmar a ação.'; }
    finally { state.confirming = false; setTimeout(decorate, 0); }
  }

  const renderBeforePhaseSix = render;
  render = function renderWithAssistantPhaseSix() { const result = renderBeforePhaseSix(); if (page === PAGE_KEY) setTimeout(decorate, 0); return result; };
  const renderTopBeforePhaseSix = renderTop;
  renderTop = function renderTopWithAssistantPhaseSix() { const result = renderTopBeforePhaseSix(); if (page === PAGE_KEY && state.mode === 'actions') { const title = document.getElementById('headerPage'); if (title) title.textContent = 'Assistente da Obra · Ações'; } return result; };
  window.AssistantObraPhase6 = Object.freeze({ switchMode, selectType, prepare, confirm, loadOptions, startCommand, phase: 6, confirmationRequired: true, noAmbiguousAuthorization: true });
})();
