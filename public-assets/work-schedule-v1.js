(function () {
  'use strict';
  const S = window.ObraAtivaWorkScheduleCore, control = window.ObraAtivaWorkControl;
  if (!S || !control || typeof workTrackerPhaseList !== 'function' || window.ObraAtivaWorkSchedule) return;
  const h = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const dateBR = (value) => S.day(value) ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '—';
  const phaseFor = (id) => (Array.isArray(db.workPhases) ? db.workPhases : []).find((phase) => phase.id === id);
  const phasesFor = (workId) => S.ordered((Array.isArray(db.workPhases) ? db.workPhases : []).filter((phase) => phase.workId === workId));
  const canEdit = () => !!control.canEdit?.('works');
  // Uma única seleção de etapa para os cartões da obra e o cronograma.
  const previousCurrentPhase = typeof workCurrentPhase === 'function' ? workCurrentPhase : null;
  if (previousCurrentPhase) {
    workCurrentPhase = function (workId) {
      const phases = phasesFor(workId), summary = S.summarize(phases, control.context().today);
      return summary.current || phases.filter((p) => S.status(p, control.context().today).complete).at(-1) || null;
    };
    window.workCurrentPhase = workCurrentPhase;
  }

  function feedback(text, error = false) {
    let target = document.getElementById('ws-message');
    if (!target) {
      target = document.createElement('div'); target.id = 'ws-message';
      (document.querySelector('#ws-form .wc-form-body') || document.getElementById('view'))?.prepend(target);
    }
    target.className = `wc-message ${error ? 'error' : ''}`; target.setAttribute('role', error ? 'alert' : 'status'); target.textContent = String(text || '');
  }

  function summaryMarkup(phases) {
    const todayValue = control.context().today, summary = S.summarize(phases, todayValue);
    const current = summary.current ? S.status(summary.current, todayValue) : null;
    return `<section class="ws-summary" aria-label="Resumo do cronograma">
      <article><small>Agora</small><b>${h(summary.current?.name || (summary.total ? 'Fases concluídas' : 'Cadastre uma fase'))}</b><span>${current ? h(current.label) : summary.total ? 'Todas as etapas chegaram a 100%' : '—'}</span></article>
      <article><small>Próxima etapa</small><b>${h(summary.next?.name || 'Ainda não definida')}</b><span>${summary.next?.plannedStart ? `Começa em ${dateBR(summary.next.plannedStart)}` : 'Defina as datas'}</span></article>
      <article><small>Término da obra</small><b>${summary.endDate ? dateBR(summary.endDate) : 'Ainda não calculado'}</b><span>${h(summary.reason)}</span></article>
    </section>`;
  }

  function phaseScheduleMarkup(phase, phases) {
    const info = S.status(phase, control.context().today), parent = phase.parentPhaseId ? phases.find((item) => item.id === phase.parentPhaseId) : null;
    const deadline = info.plannedStart && info.plannedEnd ? `${dateBR(info.plannedStart)} a ${dateBR(info.plannedEnd)}` : 'Defina início e término';
    const duration = info.complete ? 'Etapa concluída — prazo planejado acima' : info.durationDays ? `${info.durationDays} dia${info.durationDays === 1 ? '' : 's'} previstos` : info.remainingLabel;
    const editLabel = info.plannedEnd ? 'Editar prazo' : 'Definir prazo';
    return `<div class="ws-phase-line" data-ws-phase="${h(phase.id)}">
      <div class="ws-phase-main"><span class="ws-state ${h(info.tone)}">${h(info.label)}</span><div class="ws-deadline">${h(deadline)}<span>${h(info.remainingDays == null ? duration : `${info.remainingLabel} · ${duration}`)}</span></div></div>
      ${parent ? `<span class="ws-parent-note">↳ Etapa de ${h(parent.name)}</span>` : ''}
      ${canEdit() ? `<div class="ws-phase-actions"><button type="button" class="ws-action" data-ws-action="deadline" data-work="${h(phase.workId)}" data-phase="${h(phase.id)}">${editLabel}</button>${parent ? '' : `<button type="button" class="ws-action" data-ws-action="substage" data-work="${h(phase.workId)}" data-phase="${h(phase.id)}">+ Dividir em etapas</button>`}</div>` : ''}
    </div>`;
  }

  const previousPhaseList = workTrackerPhaseList;
  workTrackerPhaseList = function (work) {
    const html = previousPhaseList(work), phases = phasesFor(work.id);
    if (!phases.length) return html;
    const container = document.createElement('div'); container.innerHTML = html;
    const heading = container.querySelector('.simple-phase-head');
    if (heading) heading.insertAdjacentHTML('afterend', summaryMarkup(phases));
    const cards = new Map([...container.querySelectorAll('[data-wc-phase]')].map((card) => [card.dataset.wcPhase, card]));
    for (const phase of phases) {
      const card = cards.get(phase.id); if (!card) continue;
      if (phase.parentPhaseId) card.classList.add('ws-substage');
      const percentage = card.querySelector('.wc-phase-info');
      (percentage || card.querySelector('.work-phase-folder-top'))?.insertAdjacentHTML('afterend', phaseScheduleMarkup(phase, phases));
    }
    for (const parent of phases.filter((phase) => !phase.parentPhaseId)) {
      let anchor = cards.get(parent.id); if (!anchor) continue;
      for (const child of phases.filter((phase) => phase.parentPhaseId === parent.id)) {
        const childCard = cards.get(child.id); if (!childCard) continue;
        anchor.after(childCard); anchor = childCard;
      }
    }
    return container.innerHTML;
  };

  function showDialog(title, body, submitLabel, submit) {
    const dialog = document.getElementById('dialog'); if (!dialog) return;
    dialog.innerHTML = `<section class="wc-dialog"><h2>${h(title)}</h2><form id="ws-form" class="wc-form wc-modal-form"><div class="wc-form wc-form-body">${body}<div id="ws-message" role="status"></div></div><footer class="wide"><button class="wc-button" type="button" data-ws-action="close">Cancelar</button><button class="wc-button primary" type="submit">${h(submitLabel)}</button></footer></form></section>`;
    document.getElementById('modal')?.classList.add('show');
    const form = document.getElementById('ws-form');
    form.addEventListener('submit', (event) => {
      event.preventDefault(); if (!form.reportValidity()) return;
      const button = form.querySelector('[type=submit]'); button.disabled = true; button.textContent = 'Salvando…';
      try { submit(new FormData(form)); closeModal(); render(); }
      catch (error) { feedback(error.message || 'Não foi possível salvar o cronograma.', true); button.disabled = false; button.textContent = submitLabel; }
    });
    form.querySelector('input')?.focus();
  }

  function openDeadline(workId, phaseId) {
    const phase = phaseFor(phaseId); if (!phase || phase.workId !== workId || !canEdit()) return;
    showDialog('Prazo da etapa', `<p class="ws-dialog-intro"><b class="ws-dialog-phase">${h(phase.name)}</b>Informe somente quando esta etapa deve começar e terminar.</p><div class="ws-form-grid"><label class="wc-field"><span>Início previsto <small class="wc-field-flag">Obrigatório</small></span><input name="plannedStart" type="date" value="${h(phase.plannedStart || '')}" required></label><label class="wc-field"><span>Término previsto <small class="wc-field-flag">Obrigatório</small></span><input name="plannedEnd" type="date" value="${h(phase.plannedEnd || '')}" required></label></div>`, 'Salvar prazo', (data) => {
      const plan = S.validatePlan(data.get('plannedStart'), data.get('plannedEnd'));
      control.savePhaseSchedule(workId, phaseId, plan);
    });
  }

  function openSubstage(workId, parentId) {
    const phases = phasesFor(workId), parent = S.validateParent(phases, workId, parentId);
    if (!canEdit()) return;
    showDialog('Nova etapa dentro da fase', `<p class="ws-dialog-intro"><b class="ws-dialog-phase">${h(parent.name)}</b>Use somente quando esta fase precisar ser separada, por exemplo: térreo, pavimento superior ou laje.</p><label class="wc-field"><span>Nome da etapa <small class="wc-field-flag">Obrigatório</small></span><input name="name" type="text" maxlength="160" required placeholder="Ex.: Estrutura do térreo"></label><div class="ws-form-grid"><label class="wc-field"><span>Início previsto <small class="wc-field-flag">Obrigatório</small></span><input name="plannedStart" type="date" required></label><label class="wc-field"><span>Término previsto <small class="wc-field-flag">Obrigatório</small></span><input name="plannedEnd" type="date" required></label></div>`, 'Adicionar etapa', (data) => {
      const plan = S.validatePlan(data.get('plannedStart'), data.get('plannedEnd'));
      control.savePhaseSchedule(workId, '', { ...plan, name: data.get('name'), parentPhaseId: parent.id });
    });
  }

  document.addEventListener('click', (event) => {
    const action = event.target.closest?.('[data-ws-action]'); if (!action) return;
    event.preventDefault(); event.stopPropagation();
    try {
      if (action.dataset.wsAction === 'close') closeModal();
      else if (action.dataset.wsAction === 'deadline') openDeadline(action.dataset.work, action.dataset.phase);
      else if (action.dataset.wsAction === 'substage') openSubstage(action.dataset.work, action.dataset.phase);
    } catch (error) { feedback(error.message, true); }
  }, true);

  const previousDeletePhase = deleteWorkPhase;
  deleteWorkPhase = function (workId, phaseId) {
    const children = phasesFor(workId).filter((phase) => phase.parentPhaseId === phaseId);
    if (children.length) return window.alert('Esta fase possui etapas. Exclua primeiro as etapas internas para preservar a organização.');
    return previousDeletePhase(workId, phaseId);
  };

  window.ObraAtivaWorkSchedule = Object.freeze({ status: S.status, summarize: S.summarize, openDeadline, openSubstage });
  Object.assign(window, { workTrackerPhaseList, deleteWorkPhase });
})();
