(function () {
  'use strict';
  const C = window.ObraAtivaWorkCore;
  if (!C || typeof workTrackerPage !== 'function' || window.ObraAtivaWorkControl) return;
  const local = { saving: false };
  const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cash = (v) => v == null ? 'Não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const b = (action, label, values = {}, primary = false) => `<button type="button" class="wc-button ${primary ? 'primary' : ''}" data-wc-action="${action}" ${Object.entries(values).map(([k, v]) => `data-${k}="${h(v)}"`).join(' ')}>${label}</button>`;
  function ctx() {
    const current = typeof CompanyWorkspace === 'undefined' ? {} : CompanyWorkspace.current || {};
    const owner = ['owner', 'manager'].includes(current.role);
    const modules = owner ? ['works', 'planning', 'attendance', 'financial', 'reports', 'team'] : window.AccessControl?.allowedModules?.() || [];
    return { companyId: current.id || '', userId: CloudSync.session?.user?.id || '',
      userName: CloudSync.session?.user?.user_metadata?.full_name || db.settings?.responsible || '',
      now: new Date().toISOString(), today: today(), id: uid, modules,
      readOnly: current.role === 'viewer' || current.permissionProfile === 'visualizador' || window.AccessControl?.isReadOnly?.() || false };
  }
  function editable(area = 'works') { const c = ctx(); return !!(c.companyId && !c.readOnly && c.modules.includes(area)); }
  function enabled() { const id = ctx().companyId; return !!(id && (window.ObraAtivaWorkSync?.ready(id) || window.ObraAtivaWorkSync?.error(id))); }
  function ledger() {
    const rows = [];
    if (typeof financeAttendanceLaborRows === 'function') for (const r of financeAttendanceLaborRows()) {
      if (!r.confirmed || r.unassigned) continue;
      const planned = distributionFor(r.employee.id, r.assignment.date), phaseId = r.attendance?.phaseId || (planned?.workId === r.work.id ? planned.phaseId : '') || '';
      rows.push({ id: `${r.employee.id}|${r.assignment.date}`, source: 'attendance', identity: `attendance:${r.employee.id}|${r.assignment.date}`,
        workId: r.work.id, phaseId, employeeId: r.employee.id, date: r.assignment.date, kind: 'labor', units: r.units,
        value: r.value, label: `${r.employee.name} · ${r.attendance.status}` });
    }
    for (const r of C.list(db.receipts)) rows.push({ ...r, source: 'receipts', kind: 'receipt', identity: `receipt:${r.id}`, label: 'Recebimento' });
    for (const closing of C.list(db.workClosings)) for (const r of C.list(closing.receipts)) rows.push({ ...r, workId: closing.workId, source: 'closingReceipts', kind: 'receipt', identity: `receipt:${r.sourceReceiptId || r.id}`, label: 'Recebimento de fechamento' });
    for (const [key, kind, amount] of [['fuel', 'equipment', 'total'], ['maintenance', 'equipment', 'value'], ['tow', 'equipment', 'value'], ['licenses', 'equipment', 'value'], ['otherExpenses', 'other', 'value']]) {
      for (const r of C.list(db[key])) {
        if (key === 'licenses' && r.status !== 'Pago') continue;
        const category = String(r.category || '').toLowerCase();
        rows.push({ ...r, source: key, kind: category.includes('materia') ? 'material' : category.includes('terceir') || category.includes('servi') ? 'service' : kind,
          value: r[amount] ?? r.amount ?? r.total, label: r.description || r.note || r.notes || key,
          identity: r.sourceType && r.sourceId ? `${r.sourceType}:${r.sourceId}` : `${key}:${r.id}` });
      }
    }
    return rows;
  }
  function model(id) {
    const result = C.overview(db, id, ledger(), ctx());
    if (result.finance && typeof workCashExpected === 'function') result.finance.recordedOutstanding = workCashExpected(id);
    return result;
  }
  function message(text, error = false) {
    let target = document.getElementById('wc-message');
    if (!target) { target = document.createElement('div'); target.id = 'wc-message'; target.setAttribute('role', 'status'); (document.querySelector('#dialog form') || document.getElementById('view'))?.prepend(target); }
    target.className = `wc-message ${error ? 'error' : ''}`; target.textContent = plainText(text);
    target.setAttribute('role', error ? 'alert' : 'status');
    if (error) target.scrollIntoView({ block: 'nearest' });
  }
  function commit(next, action, detail, area = 'works') {
    C.context(ctx(), area);
    if (!window.ObraAtivaWorkSync?.ready(ctx().companyId)) throw new Error(window.ObraAtivaWorkSync?.error(ctx().companyId) || 'O controle seguro das obras está em preparação. Ative a atualização do banco antes de salvar nesta versão.');
    const before = db;
    try { db = next; WorkTrackingService.persist(action, detail); }
    catch (error) { db = before; throw error; }
  }
  function input(name, label, value = '', type = 'text', extra = '', hint = '') {
    const required = /\brequired\b/.test(extra), hintId = `wc-hint-${name}`;
    return `<label class="wc-field"><span>${h(label)} <small class="wc-field-flag">${required ? 'Obrigatório' : 'Opcional'}</small></span><input name="${name}" type="${type}" value="${h(value ?? '')}" ${hint ? `aria-describedby="${h(hintId)}"` : ''} ${extra}>${hint ? `<small class="wc-field-hint" id="${h(hintId)}">${h(hint)}</small>` : ''}</label>`;
  }
  function options(items, selected) { return items.map(([id, label]) => `<option value="${h(id)}" ${String(id) === String(selected) ? 'selected' : ''}>${h(label)}</option>`).join(''); }
  function choose(name, label, items, selected = '') { return `<label class="wc-field"><span>${h(label)}</span><select name="${name}">${options(items, selected)}</select></label>`; }
  function dialog(title, contents, submit, label = 'Salvar') {
    $('#dialog').innerHTML = `<section class="wc-dialog"><h2>${h(title)}</h2><form id="wc-form" class="wc-form wc-modal-form"><div class="wc-form wc-form-body">${contents}<div id="wc-message" role="status"></div></div><footer class="wide">${b('close', 'Cancelar')}<button class="wc-button primary" type="submit">${h(label)}</button></footer></form></section>`;
    $('#modal').classList.remove('work-media-viewer'); $('#modal').classList.add('show');
    $('#wc-form').addEventListener('submit', async (e) => {
      e.preventDefault(); if (local.saving || !e.currentTarget.reportValidity()) return;
      local.saving = true; const button = e.currentTarget.querySelector('[type=submit]'); button.disabled = true; button.textContent = 'Salvando…';
      try { await submit(new FormData(e.currentTarget), e.currentTarget); }
      catch (error) { message(error.message || 'Não foi possível salvar. Tente novamente.', true); }
      finally { local.saving = false; button.disabled = false; button.textContent = label; }
    });
    $('#wc-form input, #wc-form select')?.focus();
  }
  function editWork(id = '') {
    if (!editable()) return message('Seu perfil permite somente consultar esta obra.', true);
    const work = id ? workById(id) : null;
    if (id && !work) return;
    dialog(work ? 'Editar obra' : 'Nova obra', input('name', 'Nome da obra', work?.name || '', 'text', 'required maxlength="160"'), (data) => {
      const result = C.saveWork(db, { id, name: data.get('name') }, ctx());
      commit(result.state, id ? 'Obra atualizada' : 'Obra cadastrada', data.get('name'));
      closeModal(); openWorkTracker(result.workId);
    }, 'Salvar obra');
  }
  function phaseValues(phase, name, percent) {
    if (percent === '' || percent == null) throw new Error('Informe o percentual entre 0 e 100.');
    const value = Number(percent);
    return { ...phase, name, percent: value,
      status: value === 100 ? 'Concluída' : value > 0 ? (['Pausada', 'Atrasada'].includes(phase.status) ? phase.status : 'Em andamento') : 'Não iniciada',
      endDate: value === 100 ? phase.endDate || '' : '' };
  }
  function editPhase(workId, id = '', progressOnly = false) {
    if (!editable()) return message('Seu perfil permite somente consultar as fases.', true);
    const p = id ? WorkTrackingService.phase(id) : {};
    if (id && (!p || p.workId !== workId)) return;
    dialog(progressOnly ? p.name : id ? 'Editar fase' : 'Nova fase',
      (progressOnly ? '' : input('name', 'Nome da fase', p.name, 'text', 'required maxlength="160"')) +
      input('percent', 'Quanto está pronto? (%)', p.percent ?? 0, 'number', 'required min="0" max="100" step="0.1"', '0% = não começou · 50% = metade · 100% = concluída.'),
      (data) => {
        const result = C.savePhase(db, workId, phaseValues(p, progressOnly ? p.name : data.get('name'), data.get('percent')), ctx());
        commit(result.state, 'Fase atualizada', result.state.workPhases.find(item => item.id === result.phaseId).name);
        closeModal(); render();
      }, 'Salvar fase');
  }
  function suggestPhases(workId) {
    if (!editable()) return message('Seu perfil permite somente consultar as fases.', true);
    const key = name => String(name).trim().toLocaleLowerCase('pt-BR');
    const existing = new Set(workPhasesFor(workId).map(p => key(p.name)));
    const choices = new Map();
    function list(type) {
      return C.templates[type].map(name => {
        const added = existing.has(key(name)), selected = choices.get(name);
        return '<div class="wc-suggestion"><label class="wc-check"><input type="checkbox" data-wc-suggestion="' + h(name) + '" ' + (added ? 'disabled' : selected != null ? 'checked' : '') + '><span>' + h(name) + (added ? ' <small>Já adicionada</small>' : '') + '</span></label><label class="wc-suggest-percent"><span class="wc-sr-only">Percentual de ' + h(name) + '</span><input type="number" min="0" max="100" step="0.1" required data-wc-suggestion-percent="' + h(name) + '" value="' + h(selected ?? 0) + '" ' + (added || selected == null ? 'disabled' : '') + '><span>%</span></label></div>';
      }).join('');
    }
    dialog('Sugerir fases', choose('template', 'Tipo de obra', [['construction', 'Construção'], ['renovation', 'Reforma']], 'construction') +
      '<p class="wc-suggest-help">Marque só as fases que você quer e informe quanto já está pronto.</p><div class="wc-suggestions wide">' + list('construction') + '</div>',
      () => {
        const available = new Set(Object.values(C.templates).flat());
        const current = new Set(workPhasesFor(workId).map(p => key(p.name)));
        let next = db, count = 0;
        for (const [name, percent] of choices) {
          if (!available.has(name) || current.has(key(name))) continue;
          next = C.savePhase(next, workId, phaseValues({}, name, percent), ctx()).state;
          current.add(key(name)); count++;
        }
        if (!count) throw new Error('Marque pelo menos uma fase que ainda não foi adicionada.');
        commit(next, 'Fases sugeridas adicionadas', workById(workId)?.name);
        closeModal(); render();
      }, 'Adicionar fases');
    const form = $('#wc-form');
    form.addEventListener('change', e => {
      if (e.target.name === 'template') { form.querySelector('.wc-suggestions').innerHTML = list(e.target.value); return; }
      const check = e.target.closest('[data-wc-suggestion]');
      if (check) {
        const field = check.closest('.wc-suggestion').querySelector('input[type=number]');
        field.disabled = !check.checked;
        if (check.checked) choices.set(check.dataset.wcSuggestion, field.value);
        else choices.delete(check.dataset.wcSuggestion);
      }
    });
    form.addEventListener('input', e => {
      if (e.target.matches('[data-wc-suggestion-percent]')) choices.set(e.target.dataset.wcSuggestionPercent, e.target.value);
    });
  }
  // Keep the original folders, photo actions and work navigation. Only augment
  // each phase with its percentage and confirmed labor cost.
  const previousPhaseList = workTrackerPhaseList;
  workTrackerPhaseList = function(work) {
    const html = previousPhaseList(work);
    if (!enabled()) return html;
    const container = document.createElement('div'); container.innerHTML = html;
    const phases = workPhasesFor(work.id), canEdit = editable() && !work.archived && work.status !== 'Finalizada';
    const canSeeCosts = ctx().modules.includes('financial');
    const costs = new Map(), phaseIds = new Set(phases.map(p => p.id));
    let unassigned = 0;
    if (canSeeCosts) for (const row of C.ledgerFor(ledger(), work.id).rows) {
      if (row.kind !== 'labor' || !(row.units > 0)) continue;
      if (phaseIds.has(row.phaseId)) costs.set(row.phaseId, (costs.get(row.phaseId) || 0) + row.value);
      else unassigned += row.value;
    }
    const heading = container.querySelector('.simple-phase-head');
    if (heading && canEdit) {
      const actions = document.createElement('div'); actions.className = 'wc-actions';
      actions.innerHTML = b('template', 'Sugerir fases', {work:work.id});
      const add = heading.querySelector('[data-work-phase-action="new-phase"]');
      if (add) actions.append(add);
      heading.append(actions);
    }
    container.querySelectorAll('.simple-phase-folder').forEach((card,index) => {
      const phase = phases[index]; if (!phase) return;
      card.dataset.wcPhase = phase.id;
      const percent = Math.max(0, Math.min(100, Number(phase.percent) || 0));
      const label = new Intl.NumberFormat('pt-BR', {maximumFractionDigits:2}).format(percent) + '% pronto';
      const info = document.createElement('div'); info.className = 'wc-phase-info';
      info.innerHTML = (canEdit ? b('progress', h(label) + ' <span aria-hidden="true">✎</span>', {work:work.id,phase:phase.id}) : '<strong>' + h(label) + '</strong>') +
        (canSeeCosts ? '<div class="wc-phase-labor"><span>Mão de obra</span><b>' + cash(costs.get(phase.id) || 0) + '</b></div>' : '');
      const button = info.querySelector('button');
      if (button) button.setAttribute('aria-label', 'Atualizar percentual de ' + phase.name);
      card.querySelector('.work-phase-folder-top')?.after(info);
    });
    return '<section class="wc-simple">' + container.innerHTML +
      (canSeeCosts ? '<p class="wc-cost-note">Mão de obra: presença confirmada × diária cadastrada.' +
        (unassigned > 0 ? ' <b>Sem fase definida: ' + cash(unassigned) + '</b>' : '') + '</p>' : '') + '</section>';
  };
  const previousWorkModal = openInternalWorkModal, previousOfficeModal = openOfficeWorkModal,
    previousInternalPhaseModal = openInternalWorkPhaseModal, previousPhaseModal = openWorkPhaseModal, previousPhaseDialog = window.showWorkPhaseDialog;
  openInternalWorkModal = (...args) => enabled() ? editWork(...args) : previousWorkModal(...args);
  openOfficeWorkModal = (...args) => enabled() ? editWork(...args) : previousOfficeModal(...args);
  openInternalWorkPhaseModal = (...args) => enabled() ? editPhase(...args) : previousInternalPhaseModal(...args);
  openWorkPhaseModal = (...args) => enabled() ? editPhase(...args) : previousPhaseModal(...args);
  window.showWorkPhaseDialog = (...args) => enabled() ? editPhase(...args) : previousPhaseDialog?.(...args);
  const previousDeletePhase = deleteWorkPhase, previousMovePhase = moveWorkPhase;
  deleteWorkPhase = function (workId, phaseId) {
    if (!enabled()) return previousDeletePhase(workId, phaseId);
    C.context(ctx()); if (!window.ObraAtivaWorkSync.ready(ctx().companyId)) return message(window.ObraAtivaWorkSync.error(ctx().companyId), true);
    const phase = WorkTrackingService.phase(phaseId); if (!phase || phase.workId !== workId) return;
    const snapshot = JSON.parse(JSON.stringify(phase));
    const protectedUpdates = new Map(C.list(db.workUpdates).filter((e) => e.controlEvent && e.phaseId === phaseId).map((e) => [e.id, JSON.parse(JSON.stringify(e))]));
    const finish = () => {
      if (WorkTrackingService.phase(phaseId)) return;
      // A exclusão vigente mantém as fotos e limpa vínculos antigos. Os novos
      // eventos de controle conservam seus IDs de fase para preservar a trilha.
      db.workUpdates = C.list(db.workUpdates).map((e) => protectedUpdates.get(e.id) || e);
      C.event(db, workId, 'Fase excluída', { phaseId, before: snapshot, description: `${snapshot.name}. Fotos preservadas pelo fluxo existente.` }, ctx());
      WorkTrackingService.persist('Histórico da exclusão preservado', snapshot.name); render();
    };
    const result = previousDeletePhase(workId, phaseId);
    return result?.then ? result.then(finish) : finish();
  };
  moveWorkPhase = function (workId, phaseId, direction) {
    if (!enabled()) return previousMovePhase(workId, phaseId, direction);
    C.context(ctx()); if (!window.ObraAtivaWorkSync.ready(ctx().companyId)) return message(window.ObraAtivaWorkSync.error(ctx().companyId), true);
    const phase = WorkTrackingService.phase(phaseId), order = phase?.order;
    const result = previousMovePhase(workId, phaseId, direction);
    if (phase && phase.order !== order) { C.event(db, workId, 'Fase reorganizada', { phaseId, previousOrder: order, order: phase.order }, ctx()); WorkTrackingService.persist('Ordem da fase registrada', phase.name); }
    return result;
  };
  const previousPlanning = planningDaily;
  planningDaily = function () {
    if (!enabled()) return previousPlanning();
    const container = document.createElement('div'); container.innerHTML = previousPlanning();
    const boxes = container.querySelectorAll('[data-plan-employee]'), phases = workPhasesFor(planningWorkId);
    if (!boxes.length) return container.innerHTML;
    const table = boxes[0].closest('table'); table.querySelector('thead tr')?.insertAdjacentHTML('beforeend', '<th>Fase do dia (opcional)</th>');
    boxes.forEach((box) => {
      const current = distributionFor(box.dataset.planEmployee, planningDate || tomorrow());
      box.closest('tr').insertAdjacentHTML('beforeend', `<td><select class="wc-phase-select" aria-label="Fase de ${h(emp(box.dataset.planEmployee)?.name)}" data-wc-plan-person="${h(box.dataset.planEmployee)}">${options([['', 'Sem fase definida'], ...phases.map((p) => [p.id, p.name])], current?.workId === planningWorkId ? current.phaseId : '')}</select></td>`);
    });
    return container.innerHTML;
  };
  const previousBulk = saveBulkDistribution;
  saveBulkDistribution = function () {
    const selects = document.querySelectorAll('[data-wc-plan-person]'); if (!selects.length) return previousBulk();
    try {
      const selected = [...document.querySelectorAll('[data-plan-employee]:checked')].map((box) => ({ employeeId: box.dataset.planEmployee, phaseId: [...selects].find((s) => s.dataset.wcPlanPerson === box.dataset.planEmployee)?.value || '' }));
      const next = C.schedulePhases(db, planningWorkId, planningDate || tomorrow(), selected, ctx());
      commit(next, 'Distribuição em lote salva', workById(planningWorkId)?.name || 'Obra', 'planning'); render();
    } catch (error) { message(error.message, true); }
  };
  document.addEventListener('click', e => {
    const target = e.target.closest?.('[data-wc-action]'); if (!target) return;
    e.preventDefault(); e.stopPropagation();
    try {
      const d = target.dataset;
      if (d.wcAction === 'close') closeModal();
      else if (d.wcAction === 'template') suggestPhases(d.work);
      else if (d.wcAction === 'progress') editPhase(d.work, d.phase, true);
    } catch (error) { message(error.message, true); }
  }, true);
  // Do not let the legacy folder's Enter/Space handler open photos when
  // activating a percentage button with the keyboard.
  document.addEventListener('keydown', e => {
    if (e.target.closest?.('[data-wc-action]') && ['Enter', ' '].includes(e.key)) e.stopPropagation();
  }, true);
  document.addEventListener('obraativa:work-sync-conflict', () => message(window.ObraAtivaWorkSync.error(ctx().companyId), true));
  window.ObraAtivaWorkControl = Object.freeze({ ledger, model, context: ctx });
  Object.assign(window, { openInternalWorkModal, openOfficeWorkModal, openInternalWorkPhaseModal, openWorkPhaseModal, saveBulkDistribution });
})();
