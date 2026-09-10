(function () {
  'use strict';

  if (window.ObraAtivaWorkHub || typeof workTrackerPage !== 'function') return;

  const previousWorkTrackerPage = workTrackerPage;
  const previousOpenWorkTracker = typeof openWorkTracker === 'function' ? openWorkTracker : null;
  const receiptChoices = new Map();
  const scheduleDrafts = new Map();
  const costViews = new Map();
  let draftScope = '';
  function scope() {
    const context = workControlContext();
    const next = `${context.companyId || ''}|${context.userId || ''}`;
    if (next !== draftScope) { scheduleDrafts.clear(); costViews.clear(); draftScope = next; }
    return next;
  }
  const draftKey = (workId, date) => `${scope()}|${workId}|${date}`;
  function isDraftDirty(workId, date, rows) {
    return rows.some(row => {
      const saved = distribution(row.id, date), selected = saved?.workId === workId;
      return row.checked !== selected || (row.checked && (row.phaseId !== (saved?.phaseId || '') || row.contractId !== (saved?.contractId || '')));
    });
  }
  function captureScheduleDraft() {
    const section = document.querySelector('.oa-work-hub-schedule[data-work][data-date]');
    if (!section || section.dataset.scope !== scope()) return;
    const rows = [...section.querySelectorAll('[data-plan-employee]')].map(input => {
      const row = input.closest('tr');
      return { id: input.dataset.planEmployee, checked: input.checked, phaseId: row.querySelector('[data-wc-plan-person]')?.value || '', contractId: row.querySelector('[data-oa-contract-person]')?.value || '' };
    });
    const key = draftKey(section.dataset.work, section.dataset.date);
    const dirty = isDraftDirty(section.dataset.work, section.dataset.date, rows);
    if (dirty) scheduleDrafts.set(key, { workId: section.dataset.work, date: section.dataset.date, rows }); else scheduleDrafts.delete(key);
    const hint = section.querySelector('[data-oa-draft-status]');
    if (hint) { hint.textContent = dirty ? 'Alterações ainda não salvas. Seu rascunho será mantido ao trocar de aba. Use Salvar escala para confirmar.' : 'Escala salva. Marcar a pessoa não confirma presença nem gera diária.'; hint.classList.toggle('pending', dirty); }
  }
  const TAB_LABELS = Object.freeze({
    summary: ['Visão geral', 'Resumo'],
    team: ['Equipe e escala', 'Equipe'],
    phases: ['Fases da obra', 'Fases'],
    contracts: ['Empreitas', 'Empreitas'],
    financial: ['Financeiro da obra', 'Financeiro']
  });

  const html = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const cash = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 2
  }).format(number(value));
  const percent = (value) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(number(value))}%`;
  const list = (value) => Array.isArray(value) ? value : [];

  function workControlContext() {
    try { return window.ObraAtivaWorkControl?.context?.() || {}; }
    catch (error) { return {}; }
  }

  function modules() {
    const context = workControlContext();
    if (Array.isArray(context.modules)) return context.modules;
    try { return window.AccessControl?.allowedModules?.() || []; }
    catch (error) { return []; }
  }

  function maySee(area) {
    const current = typeof CompanyWorkspace === 'undefined' ? {} : CompanyWorkspace.current || {};
    if (['owner', 'manager'].includes(current.role)) return true;
    return modules().includes(area);
  }

  function mayEdit(area) {
    try { return !!window.ObraAtivaWorkControl?.canEdit?.(area); }
    catch (error) { return false; }
  }

  function safeModel(workId) {
    try { return window.ObraAtivaWorkControl?.model?.(workId) || null; }
    catch (error) { return null; }
  }

  function phasesFor(workId) {
    try { return typeof workPhasesFor === 'function' ? list(workPhasesFor(workId)) : list(db?.workPhases).filter((phase) => phase.workId === workId); }
    catch (error) { return []; }
  }

  function currentPhase(workId, phases) {
    try {
      const selected = typeof workCurrentPhase === 'function' ? workCurrentPhase(workId) : null;
      return selected || phases.find((phase) => ['Em andamento', 'Atrasada'].includes(phase.status)) || phases[0] || null;
    } catch (error) { return phases.find((phase) => ['Em andamento', 'Atrasada'].includes(phase.status)) || phases[0] || null; }
  }

  function distribution(employeeId, date) {
    try { return typeof distributionFor === 'function' ? distributionFor(employeeId, date) : list(db?.distributions).find((item) => item.employeeId === employeeId && item.date === date); }
    catch (error) { return null; }
  }

  function activePeople() {
    try { return typeof activeEmployees === 'function' ? list(activeEmployees()) : list(db?.employees).filter((person) => !person.archived && (!person.status || person.status === 'Ativo')); }
    catch (error) { return []; }
  }

  function financeRow(workId) {
    try { return typeof workCashRows === 'function' ? list(workCashRows()).find((row) => row.work?.id === workId) || null : null; }
    catch (error) { return null; }
  }

  function financeSnapshot(workId, model) {
    if (window.ObraAtivaWorkCosts) return { ...window.ObraAtivaWorkCosts.snapshot(workId, model), row: financeRow(workId) };
    const finance = model?.finance || null;
    const row = financeRow(workId);
    const received = row ? number(row.received) : number(finance?.received?.total);
    const labor = row ? number(row.labor) : number(finance?.labor);
    const expected = row ? number(row.expected) : number(finance?.outstanding);
    const totalCost = Math.max(labor, number(finance?.costs?.total, labor));
    const otherCosts = Math.max(0, totalCost - labor);
    return {
      contract: finance?.contract == null ? null : number(finance.contract),
      received,
      expected,
      labor,
      otherCosts,
      totalCost,
      balanceAfterLabor: received - labor,
      balanceAfterCosts: received - totalCost,
      margin: finance?.knownMargin == null ? null : number(finance.knownMargin),
      warnings: list(finance?.warnings),
      row
    };
  }

  function physicalProgress(model, phases) {
    if (model?.physical?.value != null) return number(model.physical.value);
    if (model?.physical?.needsReview) return null;
    if (!phases.length) return 0;
    return phases.reduce((sum, phase) => sum + Math.max(0, Math.min(100, number(phase.percent))), 0) / phases.length;
  }

  function todayValue() {
    try { return typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10); }
    catch (error) { return new Date().toISOString().slice(0, 10); }
  }

  function tomorrowValue() {
    try { return typeof tomorrow === 'function' ? tomorrow() : todayValue(); }
    catch (error) { return todayValue(); }
  }

  function dateLabel(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '—';
    try {
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${value}T12:00:00Z`));
    } catch (error) { return String(value); }
  }

  function tabList() {
    return ['summary', ...(maySee('planning') ? ['team'] : []), 'phases', ...(maySee('financial') ? ['contracts', 'financial'] : [])];
  }

  function normalizedTab() {
    const available = tabList();
    const aliases = { panel: 'summary', media: 'phases', photos: 'phases' };
    const requested = aliases[activeWorkTrackerTab] || activeWorkTrackerTab || 'summary';
    return available.includes(requested) ? requested : 'summary';
  }

  function setTab(tab) {
    if (!tabList().includes(tab)) return;
    activeWorkTrackerTab = tab;
    render();
    requestAnimationFrame(() => document.querySelector(`[data-oa-work-hub-tab="${tab}"]`)?.focus({ preventScroll: true }));
  }

  function tabNavigation(active) {
    return `<nav class="oa-work-hub-tabs" aria-label="Áreas desta obra" role="tablist">${tabList().map((tab) => {
      const labels = TAB_LABELS[tab];
      return `<button type="button" role="tab" aria-label="${html(labels[0])}" aria-selected="${active === tab}" class="oa-work-hub-tab ${active === tab ? 'active' : ''}" data-oa-work-hub-tab="${tab}" onclick="ObraAtivaWorkHub.openTab('${tab}')"><span>${html(labels[0])}</span><small>${html(labels[1])}</small></button>`;
    }).join('')}</nav>`;
  }

  function hubHeader(work, model, phases) {
    const progress = physicalProgress(model, phases);
    const status = work.archived || work.status === 'Finalizada' ? 'Finalizada' : work.status || 'Em andamento';
    return `<header class="oa-work-hub-head">
      <div class="oa-work-hub-head-main">
        <button type="button" class="oa-work-hub-back" onclick="go('works')" aria-label="Voltar para todas as obras">← <span>Todas as obras</span></button>
        <div class="oa-work-hub-identity"><small>CENTRAL DA OBRA <span class="oa-work-hub-status">${html(status)}</span></small><h1>${html(work.name)}</h1></div>
        ${mayEdit('works') && !work.archived ? `<button type="button" class="oa-work-hub-edit" onclick="openInternalWorkModal('${html(work.id)}')">Editar obra</button>` : ''}
      </div>
      <div class="oa-work-hub-progress"><span><b>Avanço informado</b><strong>${progress == null ? 'A conferir' : percent(progress)}</strong></span><i aria-hidden="true"><b style="--oa-work-progress:${Math.max(0, Math.min(100, progress || 0))}%"></b></i></div>
    </header>`;
  }

  function summaryMarkup(work, model, phases) {
    const date = todayValue();
    const finance = financeSnapshot(work.id, model);
    const team = list(db?.distributions).filter((item) => item.workId === work.id && item.date === date);
    const current = currentPhase(work.id, phases);
    const late = phases.filter((phase) => phase.status !== 'Concluída' && (phase.status === 'Atrasada' || (phase.plannedEnd && phase.plannedEnd < date)));
    const unassigned = number(model?.finance?.unassigned);
    const alerts = [];
    if (late.length) alerts.push(`${late.length} fase${late.length === 1 ? '' : 's'} com prazo atrasado.`);
    if (unassigned > 0) alerts.push(`${cash(unassigned)} em custos ainda estão sem fase definida.`);
    if (!phases.length) alerts.push('Cadastre a primeira fase para acompanhar o avanço da obra.');
    const financeCards = maySee('financial') ? `
      <article><small>TOTAL GASTO</small><b>${cash(finance.totalCost)}</b><span>Diárias, empreitas pagas e extras</span></article>
      <article><small>RECEBIDO</small><b>${cash(finance.received)}</b><span>Entradas desta obra</span></article>` : '';
    const nextStep = !phases.length && mayEdit('works') ? `<span><b>Comece pelas fases.</b> Use uma sugestão pronta ou cadastre só as etapas que você precisa.</span><button class="btn" type="button" data-wc-action="template" data-work="${html(work.id)}">Sugerir fases</button>` :
      !activePeople().length && mayEdit('team') ? '<span><b>Agora cadastre sua equipe.</b> Depois você poderá escolher quem trabalha nesta obra.</span><button class="btn" type="button" onclick="openModal(\'employee\')">Cadastrar funcionário</button>' :
      finance.contract == null && mayEdit('financial') ? `<span><b>Informe o valor combinado com o cliente.</b> Assim você acompanha quanto ainda falta receber.</span><button class="btn" type="button" onclick="ObraAtivaWorkHub.editExpected('${html(work.id)}')">Informar contrato</button>` : '';
    return `<section class="oa-work-hub-summary" aria-labelledby="oaWorkHubSummaryTitle">
      <div class="oa-work-hub-section-title"><h2 id="oaWorkHubSummaryTitle">Resumo de hoje</h2><span>${dateLabel(date)}</span></div>
      <div class="oa-work-hub-kpis">
        <article><small>FASE ATUAL</small><b>${html(current?.name || 'Ainda não definida')}</b><span>${current ? `${percent(current.percent)} concluída` : 'Comece pelas fases'}</span></article>
        <article><small>EQUIPE DE HOJE</small><b>${team.length}</b><span>${team.length === 1 ? 'pessoa escalada' : 'pessoas escaladas'}</span></article>
        ${financeCards}
      </div>
      ${maySee('financial') ? `<p class="oa-work-hub-contract-value"><span>Valor do contrato com o cliente</span><strong>${finance.contract == null ? 'Não informado' : cash(finance.contract)}</strong></p>` : ''}
      ${nextStep ? `<div class="oa-work-hub-next-step">${nextStep}</div>` : ''}
      <div class="oa-work-hub-actions">
        ${maySee('planning') ? '<button type="button" onclick="ObraAtivaWorkHub.openTab(\'team\')"><span>👷</span><b>Escalar equipe</b><small>Escolher pessoas e fases</small></button>' : ''}
        <button type="button" onclick="ObraAtivaWorkHub.openTab('phases')"><span>▤</span><b>Atualizar fases</b><small>Percentual e prazos</small></button>
        ${maySee('financial') ? '<button type="button" onclick="ObraAtivaWorkHub.openTab(\'financial\')"><span>R$</span><b>Ver financeiro</b><small>Entradas, gastos e compromissos</small></button>' : ''}
      </div>
      ${alerts.length ? `<div class="oa-work-hub-alerts" role="status" aria-label="Pontos de atenção"><b>Pontos de atenção</b>${alerts.slice(0, 3).map((alert) => `<span>${html(alert)}</span>`).join('')}</div>` : '<div class="oa-work-hub-ok" role="status"><span>✓</span><b>Nenhum alerta importante nesta obra agora.</b></div>'}
    </section>`;
  }

  function phaseOptions(phases, selected) {
    return `<option value="">Sem fase definida</option>${phases.map((phase) => `<option value="${html(phase.id)}" ${phase.id === selected ? 'selected' : ''}>${html(phase.name)}</option>`).join('')}`;
  }

  function scheduleMarkup(work) {
    const date = planningDate || todayValue();
    planningDate = date;
    planningWorkId = work.id;
    const phases = phasesFor(work.id);
    const people = activePeople();
    const draft = scheduleDrafts.get(draftKey(work.id, date));
    const editable = mayEdit('planning') && !work.archived && work.status !== 'Finalizada';
    const selectedCount = draft ? draft.rows.filter(row => row.checked).length : people.filter((person) => distribution(person.id, date)?.workId === work.id).length;
    const rows = people.map((person) => {
      const current = distribution(person.id, date);
      const draftRow = draft?.rows.find(row => row.id === person.id);
      const checked = draftRow ? draftRow.checked : current?.workId === work.id;
      const other = current && current.workId !== work.id;
      const otherWork = other && typeof workById === 'function' ? workById(current.workId) : null;
      const attendance = list(db?.attendance).find((item) => item.employeeId === person.id && item.date === date && (!item.workId || item.workId === work.id));
      const availability = other ? `Em ${html(otherWork?.name || 'outra obra')}` : checked ? 'Nesta obra' : 'Disponível';
      return `<tr class="${checked ? 'selected' : ''}">
        <td data-label="Escalar"><input type="checkbox" data-plan-employee="${html(person.id)}" ${checked ? 'checked' : ''} ${editable ? '' : 'disabled'} onchange="ObraAtivaWorkHub.togglePerson(this)"></td>
        <td data-label="Funcionário"><b>${html(person.name)}</b><small>${html(person.role || 'Função não informada')}</small></td>
        <td data-label="Situação"><span class="oa-work-hub-availability ${other ? 'other' : checked ? 'here' : ''}">${availability}</span>${attendance ? `<small>Presença: ${html(attendance.status || 'registrada')}</small>` : ''}</td>
        <td data-label="Fase do dia"><select class="wc-phase-select" aria-label="Fase de ${html(person.name)}" data-wc-plan-person="${html(person.id)}" ${editable ? '' : 'disabled'}>${phaseOptions(phases, draftRow?.phaseId ?? (checked ? current?.phaseId : ''))}</select>${window.ObraAtivaWorkCosts?.contractSelect(work.id, person.id, draftRow?.contractId ?? (checked ? current?.contractId || '' : ''), !editable) || ''}</td>
      </tr>`;
    }).join('');
    return `<section class="oa-work-hub-schedule" aria-labelledby="oaWorkHubScheduleTitle" data-work="${html(work.id)}" data-date="${html(date)}" data-scope="${html(scope())}">
      <div class="oa-work-hub-section-title"><div><small>EQUIPE E ESCALA</small><h2 id="oaWorkHubScheduleTitle">Quem vai trabalhar nesta obra</h2><p>Marque as pessoas, escolha a fase e salve a escala.</p></div><label class="oa-work-hub-date"><span>${date === todayValue() ? 'Hoje' : date === tomorrowValue() ? 'Amanhã' : 'Data da escala'}</span><input type="date" value="${html(date)}" onchange="ObraAtivaWorkHub.changeDate(this.value)"></label></div>
      <div class="oa-work-hub-schedule-bar"><span id="planCount"><b>${selectedCount}</b> ${selectedCount === 1 ? 'pessoa selecionada' : 'pessoas selecionadas'}</span>${editable ? `<div>${typeof repeatPreviousScale === 'function' ? '<button type="button" class="btn alt" onclick="ObraAtivaWorkHub.repeatPrevious()">↶ Repetir dia anterior</button>' : ''}<button type="button" class="btn" onclick="ObraAtivaWorkHub.saveSchedule()">Salvar escala</button></div>` : '<small>Somente consulta</small>'}</div>
      <p class="oa-work-hub-draft-status ${draft ? 'pending' : ''}" data-oa-draft-status role="status">${draft ? 'Alterações ainda não salvas. Seu rascunho foi mantido. Use Salvar escala para confirmar.' : 'Marcar a pessoa não confirma presença nem gera diária.'}</p>
      ${phases.length ? '' : '<p class="oa-work-hub-note">Ainda não há fases. Você pode escalar mesmo assim ou usar “Sugerir fases” na área Fases.</p>'}
      <div class="oa-work-hub-secondary-actions">${mayEdit('team') ? '<button class="btn alt" type="button" onclick="openModal(\'employee\')">Cadastrar funcionário</button>' : ''}${maySee('attendance') ? '<button class="btn alt" type="button" onclick="ObraAtivaWorkHub.openAttendance()">Confirmar presença / falta</button>' : ''}</div>
      <div class="table-wrap oa-work-hub-team-table"><table class="table"><thead><tr><th>Escalar</th><th>Funcionário</th><th>Situação</th><th>Fase do dia (opcional)</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">Nenhum funcionário ativo cadastrado.</td></tr>'}</tbody></table></div>
      <p class="oa-work-hub-footnote">Diária: a presença confirma o custo. Empreita: a presença registra quem trabalhou, sem gerar diária; o custo entra ao registrar o pagamento.</p>
    </section>`;
  }

  function phasesMarkup(work) {
    if (typeof workTrackerPhaseList !== 'function') {
      return '<section class="oa-work-hub-phases" aria-label="Fases da obra"><p class="notice">As fases não estão disponíveis neste momento.</p></section>';
    }
    const container = document.createElement('div');
    container.innerHTML = workTrackerPhaseList(work);
    // A Central da Obra não possui mais galeria nem ações para adicionar fotos.
    // Os registros antigos permanecem preservados, sem serem exibidos ou alterados.
    container.querySelectorAll([
      '[data-work-phase-action="add-photo"]',
      '[data-work-phase-action="open-folder"]',
      '.simple-phase-add-photo',
      '.work-phase-folder-preview',
      '.work-phase-folder-empty'
    ].join(',')).forEach((control) => control.remove());
    container.querySelectorAll('.simple-phase-folder').forEach((card) => {
      card.classList.add('oa-work-hub-phase-card');
      card.removeAttribute('tabindex');
      const icon = card.querySelector('.work-phase-folder-icon');
      if (icon) icon.textContent = '▤';
      const oldPhotoCount = card.querySelector('.work-phase-folder-top > div > small');
      if (oldPhotoCount && /foto|pasta/i.test(oldPhotoCount.textContent || '')) oldPhotoCount.remove();
    });
    const title = container.querySelector('.simple-phase-head h2');
    if (title) title.textContent = 'Fases da obra';
    const review = window.ObraAtivaWorkCore?.workProgress(db, work.id).needsReview;
    return `<section class="oa-work-hub-phases" aria-label="Fases da obra">${review ? `<div class="oa-work-phase-review" role="status"><p><b>Excluir fase não é concluir serviço.</b> O avanço anterior foi mantido. Confira os percentuais das fases restantes antes de recalcular o total.</p>${mayEdit('works') && !work.archived && work.status !== 'Finalizada' ? `<button type="button" class="btn alt" data-wc-action="review-removed-phase" data-work="${html(work.id)}">Conferir fases restantes</button>` : ''}</div>` : ''}${container.innerHTML}<p class="oa-work-hub-footnote">O avanço da obra usa as fases principais. Subetapas detalham cada fase, sem entrar novamente na média. Atualize o percentual da fase principal conforme o serviço avançar.</p>${maySee('financial') ? '<button class="btn alt oa-work-hub-phase-link" type="button" onclick="ObraAtivaWorkHub.openPhaseCosts()">Ver gastos por fase</button>' : ''}</section>`;
  }

  function financeHistory(workId, row) {
    if (row && typeof workCashHistoryMarkup === 'function') {
      try { return workCashHistoryMarkup(row); }
      catch (error) { /* usa a lista simples abaixo */ }
    }
    const model = safeModel(workId);
    const rows = list(model?.finance?.rows).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 20);
    if (!rows.length) return '<p class="oa-work-hub-empty">Nenhum lançamento foi encontrado nesta obra.</p>';
    return `<details class="oa-work-hub-history"><summary>Ver últimos lançamentos (${rows.length})</summary><div>${rows.map((rowItem) => `<p><span><b>${html(rowItem.label || (rowItem.kind === 'receipt' ? 'Recebimento' : 'Custo'))}</b><small>${dateLabel(rowItem.date)}</small></span><strong class="${rowItem.kind === 'receipt' ? 'in' : 'out'}">${rowItem.kind === 'receipt' ? '+' : '−'} ${cash(rowItem.value)}</strong></p>`).join('')}</div></details>`;
  }

  function costView(workId) {
    const key = `${scope()}|${workId}`;
    if (!costViews.has(key)) costViews.set(key, { mode: 'total', ending: '', details: false });
    return costViews.get(key);
  }
  const validCostDay = value => window.ObraAtivaWorkCore?.day(value);
  const shiftCostDay = (value, days) => typeof paymentAddDays === 'function' ? paymentAddDays(value, days) : new Date(Date.parse(`${value}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  function currentCostEnding() {
    return typeof nextFriday === 'function' ? nextFriday() : todayValue();
  }
  function costPeriod(ending) {
    // Mesmas datas do calendário de Pagamentos, sem mudar sua seleção global.
    const native = typeof paymentPeriod === 'function' ? paymentPeriod(ending) : null;
    if (validCostDay(native?.from) && validCostDay(native?.to) && native.from <= native.to) return native;
    return { from: shiftCostDay(ending, -13), to: ending, group: '' };
  }
  function previousCostEnding(period) {
    const initial = typeof paymentCalendar === 'function' ? paymentCalendar().initialPeriodStart : '';
    if (validCostDay(initial) && period.from <= initial) return '';
    const previous = shiftCostDay(period.to, -14), candidate = costPeriod(previous);
    // O primeiro período configurado pode ter duração diferente. Não criar
    // uma segunda quinzena sobre os mesmos dias desse período inicial.
    return candidate.to < period.from ? previous : '';
  }
  function periodDetailsMarkup(values) {
    const formatDays = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
    const phaseName = id => values.byPhase.find(phase => phase.id === id)?.name || 'Sem fase definida';
    const otherRows = values.rows.filter(row => row.kind !== 'labor').slice().sort((a, b) => b.date.localeCompare(a.date));
    return `<div class="oa-work-period-detail-body">
      <section><h3>Recebimentos do cliente</h3><ul class="oa-work-period-list">${values.receiptRows.slice().sort((a, b) => b.date.localeCompare(a.date)).map(row => `<li><div><b>${dateLabel(row.date)}</b><small>${html(row.label || 'Recebimento do cliente')}${row.note ? ` · ${html(row.note)}` : ''}</small></div><strong class="oa-work-period-in">${cash(row.value)}</strong></li>`).join('') || '<li class="oa-work-period-empty">Nenhum recebimento registrado nesta quinzena.</li>'}</ul></section>
      <section><h3>Custos por fase</h3><ul class="oa-work-period-list">${values.byPhase.map(phase => `<li><div><b>${html(phase.name)}</b><small>Diárias: ${cash(phase.daily)} · Empreitas: ${cash(phase.contractPaid)} · Extras: ${cash(phase.extras)}</small></div><strong>${cash(phase.total)}</strong></li>`).join('')}</ul></section>
      <section><h3>Mão de obra por funcionário</h3><p>Dias com presença confirmada. Meio período conta como meia diária.</p><ul class="oa-work-period-list">${values.byEmployee.map(person => `<li><div><b>${html(person.name)}</b><small>${person.days} ${person.days === 1 ? 'dia com presença' : 'dias com presença'} · ${formatDays(person.units)} ${person.units === 1 ? 'diária equivalente' : 'diárias equivalentes'}</small></div><strong>${cash(person.total)}</strong></li>`).join('') || '<li class="oa-work-period-empty">Nenhuma diária confirmada nesta quinzena. Só escalar a pessoa não gera custo; falta também não.</li>'}</ul></section>
      <section><h3>Pagamentos de empreita e extras</h3><ul class="oa-work-period-list">${otherRows.map(row => `<li><div><b>${html(row.costType === 'contractPayment' ? 'Empreita paga' : row.category || 'Custo extra')}</b><small>${dateLabel(row.date)} · ${html(phaseName(row.phaseId))}${row.label ? ` · ${html(row.label)}` : ''}</small></div><strong>${cash(row.value)}</strong></li>`).join('') || '<li class="oa-work-period-empty">Nenhum pagamento de empreita ou custo extra neste período.</li>'}</ul></section>
    </div>`;
  }
  function periodFinancialMarkup(work, all, view) {
    const ending = view.ending || currentCostEnding(), period = costPeriod(ending);
    const companyId = workControlContext().companyId;
    const ledger = (window.ObraAtivaWorkControl?.ledger() || all.rows).filter(row => !row.companyId || row.companyId === companyId);
    const values = window.ObraAtivaWorkCostCore.periodBreakdown(db, work.id, ledger, period, all.totalCost, todayValue(), all.received);
    const status = values.future ? 'Quinzena futura' : values.partial ? `Parcial até ${dateLabel(todayValue())}` : 'Período anterior';
    const resultState = values.result > 0 ? 'positive' : values.result < 0 ? 'negative' : 'neutral';
    const resultLabel = values.result > 0 ? 'Positivo' : values.result < 0 ? 'Negativo' : 'Sem diferença';
    return `<div class="oa-work-period" data-from="${html(period.from)}" data-to="${html(period.to)}">
      <div class="oa-work-period-heading"><div><h3>Resultado da quinzena</h3><p>O que entrou, quanto custou e a diferença nesta obra.</p></div><span class="oa-work-period-status">${html(status)}</span></div>
      <div class="oa-work-period-navigation" aria-label="Escolher quinzena">
        <button type="button" class="btn alt" data-oa-period-action="previous" aria-label="Quinzena anterior" ${previousCostEnding(period) ? '' : 'disabled'}><span aria-hidden="true">←</span> Anterior</button>
        <div class="oa-work-period-dates" aria-live="polite"><b>${dateLabel(period.from)} a ${dateLabel(period.to)}</b><small>Mesmo calendário de Pagamentos · todas as pessoas desta obra</small></div>
        <button type="button" class="btn alt" data-oa-period-action="next" aria-label="Próxima quinzena">Próxima <span aria-hidden="true">→</span></button>
      </div>
      ${view.ending && view.ending !== currentCostEnding() ? '<button type="button" class="btn alt oa-work-period-current" data-oa-period-action="current">Voltar à quinzena atual</button>' : ''}
      <div class="oa-work-period-metrics" aria-live="polite" aria-atomic="true">
        <article class="oa-work-period-received"><small>RECEBIDO NA QUINZENA</small><b data-oa-period-received>${cash(values.received)}</b><span>Entradas do cliente no período</span></article>
        <article><small>CUSTO DA QUINZENA</small><b data-oa-period-total>${cash(values.totalCost)}</b><span>Diárias + empreitas pagas + extras</span></article>
        <article class="oa-work-period-result ${resultState}"><small>RESULTADO DA QUINZENA · ${resultLabel.toUpperCase()}</small><b data-oa-period-result>${cash(values.result)}</b><span>Recebido − custo registrado</span></article>
      </div>
      <div class="oa-work-hub-cost-composition oa-work-period-costs" aria-label="O que compõe o custo da quinzena">
        <article><small>MÃO DE OBRA POR DIÁRIA</small><b data-oa-period-daily>${cash(values.daily)}</b><span>Presenças confirmadas</span></article>
        <article><small>EMPREITAS PAGAS</small><b data-oa-period-contract>${cash(values.contractPaid)}</b><span>Pagamentos no período</span></article>
        <article><small>CUSTOS EXTRAS</small><b data-oa-period-extras>${cash(values.extras)}</b><span>Gastos com data no período</span></article>
      </div>
      ${window.ObraAtivaWorkCosts?.clientForecastMarkup(work.id, period) || ''}
      ${values.rows.length || values.receiptRows.length ? '' : `<p class="oa-work-period-notice">${values.future ? 'Esta quinzena ainda não começou. Os valores aparecerão conforme forem realizados e registrados.' : 'Nenhum recebimento ou custo registrado nesta quinzena. Você pode consultar a anterior ou conferir as presenças e os lançamentos.'}</p>`}
      ${values.unallocatedPrior > 0 ? `<p class="oa-work-period-notice">${cash(values.unallocatedPrior)} de custo anterior sem detalhamento por data continua em <b>Total da obra</b>. Esse valor não foi atribuído a esta quinzena.</p>` : ''}
      ${values.unallocatedReceived > 0 ? `<p class="oa-work-period-notice">${cash(values.unallocatedReceived)} recebido anteriormente sem detalhamento por data continua em <b>Total da obra</b>, fora desta quinzena.</p>` : ''}
      ${values.futureCost > 0 ? `<p class="oa-work-period-notice">Há ${cash(values.futureCost)} em lançamentos com data futura neste período. Eles não entram no custo realizado até hoje.</p>` : ''}
      ${values.futureReceived > 0 ? `<p class="oa-work-period-notice">Há ${cash(values.futureReceived)} em recebimentos com data futura neste período. Eles não entram no resultado até hoje.</p>` : ''}
      ${values.warnings.length ? '<p class="oa-work-period-notice">Existem lançamentos incompletos. Só registros com data e valor válidos entram nesta consulta.</p>' : ''}
      <details class="oa-work-period-details" ${view.details ? 'open' : ''}><summary>Ver detalhes da quinzena <span>Recebimentos, fases e funcionários</span></summary>${periodDetailsMarkup(values)}</details>
      <p class="oa-work-period-note">Resultado calculado da obra, não saldo bancário nem lucro final. Diárias entram pelo dia trabalhado, mesmo antes de pagá-las. O pagamento não soma o custo de novo. Falta e escala sem presença confirmada não geram diária.</p>
      <p class="oa-work-period-commitment"><b>Empreitas ainda a pagar na obra: ${cash(values.commitment)}.</b> Saldo acumulado, separado do custo desta quinzena.</p>
    </div>`;
  }
  function totalFinancialMarkup(work, values) {
    return `<div class="oa-work-hub-finance-grid">
        <article><small>CONTRATO DA OBRA</small><b>${values.contract == null ? 'Não informado' : cash(values.contract)}</b><span>Valor inicial + aditivos aprovados</span></article>
        <article><small>JÁ RECEBIDO DO CLIENTE</small><b>${cash(values.received)}</b><span>Dinheiro que já entrou</span></article>
        <article><small>FALTA RECEBER NO TOTAL</small><b>${cash(values.expected)}</b><span>Contrato − recebimentos − descontos</span></article>
        <article><small>TOTAL GASTO</small><b>${cash(values.totalCost)}</b><span>Diárias + empreitas pagas + extras${values.prior > 0 ? ' + custo anterior' : ''}</span></article>
        <article class="${values.balanceAfterCosts >= 0 ? 'positive' : 'negative'}"><small>SALDO ATUAL</small><b>${cash(values.balanceAfterCosts)}</b><span>Recebido − total gasto</span></article>
      </div>
      <div class="oa-work-hub-cost-composition" aria-label="Composição dos custos e valores a pagar">
        <article><small>MÃO DE OBRA POR DIÁRIA</small><b>${cash(values.labor)}</b><span>Presença confirmada × diária</span></article>
        <article><small>EMPREITAS PAGAS</small><b>${cash(values.contractPaid)}</b><span>Pagamentos já registrados</span></article>
        <article><small>CUSTOS EXTRAS</small><b>${cash(values.extras)}</b><span>Outros gastos desta obra</span></article>
        <article><small>EMPREITAS A PAGAR</small><b>${cash(values.commitment)}</b><span>Ainda não entram no total gasto</span></article>
      </div>
      ${values.undatedReceived > 0 ? `<p class="oa-work-period-notice">Há ${cash(values.undatedReceived)} em recebimentos sem data válida, preservados no histórico. Eles não entram em uma quinzena específica.${values.receivedNeedsReview ? ' Como também existe um saldo inicial recebido, o painel conserva o maior total comprovado. Confira as datas para distinguir esses recibos do saldo inicial, sem contá-los em dobro.' : ' O valor continua no total já recebido da obra.'}</p>` : ''}
      <div class="oa-work-hub-finance-explain"><span><b>Resultado estimado:</b> ${values.estimated == null ? 'Informe o contrato para estimar' : cash(values.estimated)}</span><span>Contrato com o cliente − total gasto − empreitas ainda a pagar. Custos futuros não cadastrados não entram nesta estimativa.</span>${values.prior > 0 ? `<span>Custo anterior preservado: ${cash(values.prior)}</span>` : ''}</div>
      ${window.ObraAtivaWorkCosts?.clientAgreementMarkup(work.id) || ''}
      ${window.ObraAtivaWorkCosts?.clientForecastMarkup(work.id) || ''}
      ${window.ObraAtivaWorkCosts?.phaseCostsMarkup(work.id, values) || ''}
      ${window.ObraAtivaWorkCosts?.financialHistoryMarkup(work.id) || financeHistory(work.id, values.row)}
      <p class="oa-work-hub-footnote">Saldo calculado da obra, não saldo bancário: inclui diárias confirmadas, mesmo antes de quitá-las. Contrato e previsão não são dinheiro recebido. Empreitas e extras são custos.</p>`;
  }
  function financialMarkup(work, model) {
    const values = financeSnapshot(work.id, model), view = costView(work.id);
    const editable = mayEdit('financial') && !work.archived && work.status !== 'Finalizada';
    const hasPeriods = !!window.ObraAtivaWorkCostCore?.periodBreakdown && Array.isArray(values.rows);
    const periodMode = hasPeriods && view.mode === 'fortnight';
    return `<section class="oa-work-hub-financial" aria-labelledby="oaWorkHubFinancialTitle" data-work="${html(work.id)}" data-scope="${html(scope())}">
      <div class="oa-work-hub-section-title"><div><h2 id="oaWorkHubFinancialTitle">Financeiro desta obra</h2><p>O que o cliente pagou, o que falta receber e quanto a obra está custando.</p></div>${editable ? `<div class="oa-work-hub-finance-actions"><button type="button" class="btn alt" onclick="ObraAtivaWorkHub.editExpected('${html(work.id)}')">${values.contract == null ? 'Informar contrato' : 'Editar contrato'}</button><button type="button" class="btn alt" data-oa-cost-action="addendum" data-work="${html(work.id)}">+ Aditivo</button><button type="button" class="btn" onclick="ObraAtivaWorkHub.receive('${html(work.id)}')">Registrar recebimento</button><button type="button" class="btn alt" data-oa-cost-action="extra" data-work="${html(work.id)}">Registrar custo extra</button></div>` : ''}</div>
      ${hasPeriods ? `<div class="oa-work-cost-view" role="group" aria-label="Visão financeira da obra"><button type="button" data-oa-period-action="total" aria-pressed="${!periodMode}">Total da obra</button><button type="button" data-oa-period-action="fortnight" aria-pressed="${periodMode}">Por quinzena</button></div>` : ''}
      ${periodMode ? periodFinancialMarkup(work, values, view) : totalFinancialMarkup(work, values)}
    </section>`;
  }

  function updateCostView(button) {
    const section = button.closest('.oa-work-hub-financial');
    if (!section || section.dataset.scope !== scope() || section.dataset.work !== activeWorkTrackerId || !maySee('financial')) return;
    const action = button.dataset.oaPeriodAction, work = workById(section.dataset.work), view = costView(work.id);
    if (action === 'total' || action === 'fortnight') view.mode = action;
    else if (action === 'current') view.ending = '';
    else if (action === 'next') view.ending = shiftCostDay(view.ending || currentCostEnding(), 14);
    else if (action === 'previous') view.ending = previousCostEnding(costPeriod(view.ending || currentCostEnding())) || view.ending;
    else return;
    // Atualização só deste painel: mantém a obra aberta, a navegação global,
    // a posição de leitura e a escolha de abrir os detalhes da quinzena.
    section.outerHTML = financialMarkup(work, safeModel(work.id));
    const updated = document.querySelector('.oa-work-hub-financial');
    (updated?.querySelector(`[data-oa-period-action="${action}"]:not(:disabled)`) || updated?.querySelector('[data-oa-period-action="fortnight"]'))?.focus({ preventScroll: true });
  }

  function pageMarkup() {
    const work = typeof workById === 'function' ? workById(activeWorkTrackerId) : null;
    if (!work) return previousWorkTrackerPage();
    captureScheduleDraft();
    const model = safeModel(work.id);
    const phases = phasesFor(work.id);
    const active = normalizedTab();
    activeWorkTrackerTab = active;
    const contents = {
      summary: () => summaryMarkup(work, model, phases),
      team: () => scheduleMarkup(work),
      phases: () => phasesMarkup(work),
      contracts: () => window.ObraAtivaWorkCosts?.contractsMarkup(work) || '',
      financial: () => financialMarkup(work, model)
    };
    return `<div class="oa-work-hub" data-oa-work-id="${html(work.id)}">${hubHeader(work, model, phases)}${tabNavigation(active)}<div class="oa-work-hub-content" role="tabpanel">${contents[active]()}</div></div>`;
  }

  function togglePerson(input) {
    planningWorkId = activeWorkTrackerId;
    if (typeof togglePlanEmployee === 'function') togglePlanEmployee(input);
    const row = input.closest('tr');
    row?.classList.toggle('selected', input.checked);
    const count = document.querySelectorAll('.oa-work-hub [data-plan-employee]:checked').length;
    const counter = document.getElementById('planCount');
    if (counter) counter.innerHTML = `<b>${count}</b> ${count === 1 ? 'pessoa selecionada' : 'pessoas selecionadas'}`;
    captureScheduleDraft();
  }

  function changeDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return;
    captureScheduleDraft();
    planningDate = value;
    planningWorkId = activeWorkTrackerId;
    render();
  }

  function saveSchedule() {
    planningWorkId = activeWorkTrackerId;
    if (typeof saveBulkDistribution === 'function') saveBulkDistribution();
  }
  function openAttendance() {
    captureScheduleDraft();
    attendanceDate = planningDate || todayValue();
    if (maySee('attendance') && typeof go === 'function') go('attendance');
  }
  function openPhaseCosts() {
    if (!maySee('financial')) return;
    costView(activeWorkTrackerId).mode = 'total';
    setTab('financial');
    const report = document.querySelector('.oa-work-hub .oa-cost-phase-breakdown');
    if (report) { report.open = true; report.scrollIntoView({ block: 'start', behavior: 'auto' }); }
  }

  function repeatPrevious() {
    planningWorkId = activeWorkTrackerId;
    if (!mayEdit('planning')) return;
    if (!window.ObraAtivaWorkCore || typeof previousPlanningDate !== 'function') return;
    const date = planningDate || tomorrowValue(), sourceDate = previousPlanningDate(date);
    const current = list(db.distributions).filter((row) => row.date === date);
    const people = new Set(activePeople().map((person) => person.id));
    const additions = list(db.distributions).filter((row) => row.workId === activeWorkTrackerId && row.date === sourceDate && people.has(row.employeeId) && !current.some((today) => today.employeeId === row.employeeId));
    if (!additions.length) return window.alert('Não há pessoas desta obra para repetir. A escala já registrada foi mantida.');
    if (!window.confirm(`Repetir ${additions.length} pessoa(s) desta obra de ${dateLabel(sourceDate)} para ${dateLabel(date)}? A escala já registrada será mantida.`)) return;
    try {
      const selected = [...current.filter((row) => row.workId === activeWorkTrackerId), ...additions].map((row) => ({ employeeId: row.employeeId, phaseId: row.phaseId || '', contractId: row.contractId || '' }));
      const next = window.ObraAtivaWorkCore.schedulePhases(db, activeWorkTrackerId, date, selected, workControlContext());
      window.ObraAtivaWorkControl.commit(next, 'Escala desta obra repetida', dateLabel(date), 'planning'); render();
    } catch (problem) { window.alert(problem.message); }
  }

  function editExpected(workId) {
    if (window.ObraAtivaWorkCosts?.clientContractForm) return window.ObraAtivaWorkCosts.clientContractForm(workId);
    if (typeof financeEditExpected === 'function') return financeEditExpected(workId);
    if (typeof openModal === 'function') return openModal('receivable', workId);
  }

  function receive(workId) {
    if (window.ObraAtivaWorkCosts?.receiptForm) return window.ObraAtivaWorkCosts.receiptForm(workId);
    if (typeof financeClientReceiptTargets !== 'function' || typeof financeSelectClientReceiptTarget !== 'function') {
      if (typeof openModal === 'function') return openModal('receipt', workId);
      return;
    }
    const targets = list(financeClientReceiptTargets()).filter((target) => target.workId === workId);
    if (!targets.length) {
      window.alert('Defina primeiro o valor desta obra. Depois você poderá registrar o recebimento do cliente aqui.');
      return;
    }
    if (targets.length === 1) return financeSelectClientReceiptTarget(targets[0]);
    receiptChoices.set(workId, targets);
    const dialog = document.getElementById('dialog');
    if (!dialog) return;
    dialog.innerHTML = `<h2>Registrar recebimento</h2><p class="sub">Escolha a etapa financeira de ${html(typeof workById === 'function' ? workById(workId)?.name || 'esta obra' : 'esta obra')}.</p><form class="form" id="oaWorkHubReceiptForm"><div class="field wide"><label for="oaWorkHubReceiptTarget">Valor a receber</label><select id="oaWorkHubReceiptTarget" required>${targets.map((target, index) => `<option value="${index}">${html(target.label || `Opção ${index + 1}`)}</option>`).join('')}</select></div></form><footer><button type="button" class="btn alt" onclick="closeModal()">Cancelar</button><button type="button" class="btn" onclick="ObraAtivaWorkHub.continueReceipt('${html(workId)}')">Continuar</button></footer>`;
    document.getElementById('modal')?.classList.add('show');
  }

  function continueReceipt(workId) {
    const index = number(document.getElementById('oaWorkHubReceiptTarget')?.value, -1);
    const target = receiptChoices.get(workId)?.[index];
    if (target) financeSelectClientReceiptTarget(target);
  }

  function openHub(workId) {
    if (!previousOpenWorkTracker) return;
    previousOpenWorkTracker(workId);
    if (activeWorkTrackerId !== workId || page !== 'worktracker') return;
    activeWorkTrackerTab = 'summary';
    render();
  }

  workTrackerPage = pageMarkup;
  const previousWorksGlobal = typeof worksGlobal === 'function' ? worksGlobal : null;
  if (previousWorksGlobal) {
    worksGlobal = function () {
      const container = document.createElement('div'); container.innerHTML = previousWorksGlobal();
      const intro = container.querySelector('.works-grid-head .sub');
      if (intro) intro.textContent = 'Abra uma obra para organizar equipe, fases, empreitas e valores em um lugar só.';
      container.querySelectorAll('.internal-work-status > span').forEach(el => { if (/foto/i.test(el.textContent)) el.remove(); });
      container.querySelectorAll('.internal-work-current > span').forEach(el => { if (/registrar fotos/i.test(el.textContent)) el.textContent = 'Abra a obra para organizar o trabalho e acompanhar os custos.'; });
      return container.innerHTML;
    };
    window.worksGlobal = worksGlobal;
  }
  document.addEventListener('change', event => {
    if (event.target.matches?.('.oa-work-hub [data-wc-plan-person],.oa-work-hub [data-oa-contract-person],.oa-work-hub [data-plan-employee]')) captureScheduleDraft();
  });
  document.addEventListener('click', event => {
    const button = event.target.closest?.('.oa-work-hub [data-oa-period-action]');
    if (button && !button.disabled) { event.preventDefault(); updateCostView(button); }
  });
  document.addEventListener('toggle', event => {
    const target = event.target, section = target.closest?.('.oa-work-hub-financial');
    if (target.matches?.('.oa-work-period-details') && target.isConnected && section?.dataset.scope === scope()) costView(section.dataset.work).details = target.open;
  }, true);
  window.addEventListener('beforeunload', event => {
    captureScheduleDraft();
    if ([...scheduleDrafts.values()].some(draft => isDraftDirty(draft.workId, draft.date, draft.rows))) { event.preventDefault(); event.returnValue = ''; }
  });
  if (previousOpenWorkTracker) {
    openWorkTracker = openHub;
    window.openWorkTracker = openHub;
  }
  window.ObraAtivaWorkHub = Object.freeze({
    openTab: setTab,
    togglePerson,
    changeDate,
    saveSchedule,
    openAttendance,
    openPhaseCosts,
    repeatPrevious,
    editExpected,
    receive,
    continueReceipt,
    snapshot: financeSnapshot
  });
})();
