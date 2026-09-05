(function () {
  'use strict';
  const C = window.ObraAtivaWorkCore;
  if (!C || typeof workTrackerPage !== 'function' || window.ObraAtivaWorkControl) return;
  const local = { section: 'panel', collection: 'list', filter: 'all', historyFilter: 'all', historyLimit: 100, operation: '', saving: false };
  const serverHistory = new Map();
  const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cash = (v) => v == null ? 'Não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const dt = (v) => v ? String(v).slice(0, 10).split('-').reverse().join('/') : 'Não informado';
  const pct = (v) => v == null ? 'Sem medição' : `${v}%`;
  const planValue = (work, key) => Object.hasOwn(work.control?.plan || {}, key) ? work.control.plan[key] : work.control?.baseline?.[key];
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
    target.className = `wc-message ${error ? 'error' : ''}`; target.textContent = text;
  }
  function commit(next, action, detail, area = 'works') {
    C.context(ctx(), area);
    if (!window.ObraAtivaWorkSync?.ready(ctx().companyId)) throw new Error(window.ObraAtivaWorkSync?.error(ctx().companyId) || 'O controle seguro das obras está em preparação. Ative a atualização do banco antes de salvar nesta versão.');
    const before = db;
    try { db = next; WorkTrackingService.persist(action, detail); }
    catch (error) { db = before; throw error; }
  }
  function input(name, label, value = '', type = 'text', extra = '') {
    return `<label class="wc-field"><span>${h(label)}</span><input name="${name}" type="${type}" value="${h(value ?? '')}" ${extra}></label>`;
  }
  function options(items, selected) { return items.map(([id, label]) => `<option value="${h(id)}" ${String(id) === String(selected) ? 'selected' : ''}>${h(label)}</option>`).join(''); }
  function choose(name, label, items, selected = '') { return `<label class="wc-field"><span>${h(label)}</span><select name="${name}">${options(items, selected)}</select></label>`; }
  function memo(name, label, value = '') { return `<label class="wc-field wide"><span>${h(label)}</span><textarea name="${name}" maxlength="4000" rows="2">${h(value)}</textarea></label>`; }
  function peopleField(selected = []) { return `<details class="wc-disclosure wide"><summary>Equipe de referência (opcional)</summary><p>Não gera presença nem custo. A equipe do dia vem da escala.</p><div class="wc-people">${C.list(db.employees).map((e) => `<label><input type="checkbox" name="teamIds" value="${h(e.id)}" ${selected.includes(e.id) ? 'checked' : ''}> ${h(e.name)}</label>`).join('') || '<p>Nenhum funcionário cadastrado.</p>'}</div></details>`; }
  function dialog(title, contents, submit, label = 'Salvar') {
    $('#dialog').innerHTML = `<section class="wc-dialog"><h2>${h(title)}</h2><form id="wc-form" class="wc-form">${contents}<div id="wc-message" role="status"></div><footer class="wide">${b('close', 'Cancelar')}<button class="wc-button primary" type="submit">${h(label)}</button></footer></form></section>`;
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
    const baselineFields = `<p class="wc-copy wide">O marco inicial separa o histórico informado dos novos registros. Deixe em branco o que não souber.</p>
      ${choose('entry', 'Situação ao entrar no sistema', [['new', 'Obra iniciando agora'], ['ongoing', 'Obra já em andamento'], ['final', 'Obra em fase final']], work ? 'ongoing' : 'new')}
      ${input('asOfDate', 'Valores anteriores até esta data', today(), 'date', 'required')}
      ${input('startedAt', 'Data de início real ou aproximada', '', 'date')}
      <label class="wc-field"><span>Precisão da data</span><span><input type="checkbox" name="approximateStart"> Data aproximada</span></label>
      ${input('plannedEnd', 'Prazo previsto da obra', '', 'date')}
      ${ctx().modules.includes('financial') ? `${input('contractValue', 'Valor contratado da obra (R$)', '', 'number', 'min="0" step="0.01"')}${input('budgetValue', 'Custo total orçado (R$)', '', 'number', 'min="0" step="0.01"')}<div class="wc-prior wide" hidden>${input('priorReceived', 'Já recebido até o marco (R$)', '', 'number', 'min="0" step="0.01"')}${input('priorCost', 'Já gasto até o marco (R$)', '', 'number', 'min="0" step="0.01"')}<p class="wc-copy wide">São totais acumulados, incluindo lançamentos antigos já cadastrados. O painel fará a conciliação.</p></div>` : ''}
      ${work ? choose('currentPhaseId', 'Fase atual (opcional)', [['', 'Ainda não definida'], ...workPhasesFor(work.id).map((p) => [p.id, p.name])]) : `${input('initialPhase', 'Fase atual (opcional)', '')}${input('initialPercent', 'Percentual dessa fase', 0, 'number', 'min="0" max="100" step="0.1"')}`}
      ${work ? `<details class="wc-disclosure wide"><summary>Percentuais conhecidos de cada fase (opcional)</summary><div class="wc-form">${workPhasesFor(work.id).map((p) => input(`phasePercent:${p.id}`, p.name, C.unconfirmedLegacy(p) ? '' : p.percent, 'number', 'min="0" max="100" step="0.1"')).join('')}</div></details>` : ''}
      ${peopleField()}${memo('notes', 'Observações do marco')}<label class="wc-check wide"><input type="checkbox" name="photoAfter"> Adicionar foto da fase atual após salvar</label>`;
    dialog(work ? 'Editar obra' : 'Cadastrar obra', `${input('name', 'Nome da obra', work?.name || '', 'text', 'required maxlength="160"')}
      ${work?.control?.baseline ? `<p class="wc-copy wide">Marco inicial preservado. Mudanças no planejamento atual ficam registradas no histórico.</p>${ctx().modules.includes('financial') ? `${input('contractValue', 'Valor contratado atual (R$)', planValue(work, 'contractValue'), 'number', 'min="0" step="0.01"')}${input('budgetValue', 'Custo orçado atual (R$)', planValue(work, 'budgetValue'), 'number', 'min="0" step="0.01"')}` : ''}${input('plannedEnd', 'Prazo previsto atual', planValue(work, 'plannedEnd'), 'date')}` : `${work ? '<label class="wc-check wide"><input name="registerBaseline" type="checkbox"> Quero registrar o marco inicial desta obra agora</label>' : ''}<details class="wc-disclosure wide" ${work ? '' : 'open'}><summary>Marco inicial no sistema</summary><div class="wc-form">${baselineFields}</div></details>`}`, (data) => {
      const values = Object.fromEntries(data), initial = !work?.control?.baseline && (!work || data.has('registerBaseline'));
      if (initial && data.has('photoAfter') && !values.currentPhaseId && !values.initialPhase?.trim()) throw new Error('Informe a fase atual para escolher a pasta da foto.');
      const base = initial ? { ...values, teamIds: data.getAll('teamIds'), approximateStart: data.has('approximateStart') } : undefined;
      const plan = work?.control?.baseline ? { plannedEnd: values.plannedEnd, ...(ctx().modules.includes('financial') ? { contractValue: values.contractValue, budgetValue: values.budgetValue } : {}) } : undefined;
      const result = C.saveWork(db, { id, name: values.name, baseline: base, plan }, ctx());
      let next = result.state;
      if (initial && work) for (const p of workPhasesFor(work.id)) {
        const value = values[`phasePercent:${p.id}`];
        if (value === '' || value == null || (Number(value) === C.number(p.percent) && !C.unconfirmedLegacy(p))) continue;
        const percent = Number(value), status = percent === 100 ? 'Concluída' : percent > 0 ? 'Em andamento' : 'Não iniciada';
        next = C.savePhase(next, work.id, { ...p, percent, status, endDate: percent === 100 ? p.endDate : '' }, ctx()).state;
      }
      if (!id && values.initialPhase?.trim()) {
        const percent = Number(values.initialPercent || 0), phase = C.savePhase(next, result.workId, { name: values.initialPhase, percent, status: percent === 100 ? 'Concluída' : percent > 0 ? 'Em andamento' : 'Não iniciada' }, ctx());
        next = phase.state; next.works.find((w) => w.id === result.workId).control.baseline.currentPhaseId = phase.phaseId;
      }
      commit(next, id ? 'Obra atualizada' : 'Obra cadastrada', values.name); closeModal(); openWorkTracker(result.workId);
      const phaseId = next.works.find((w) => w.id === result.workId)?.control?.baseline?.currentPhaseId;
      if (initial && data.has('photoAfter') && phaseId) showWorkPhasePhotoDialog(result.workId, phaseId);
    });
    const select = $('#wc-form [name=entry]');
    select?.addEventListener('change', () => { const fields = $('#wc-form .wc-prior'); if (fields) fields.hidden = select.value === 'new'; });
    if (select) select.dispatchEvent(new Event('change'));
    $('#wc-form [name=registerBaseline]')?.addEventListener('change', (e) => { $('#wc-form > details').open = e.target.checked; });
  }
  function editPhase(workId, id = '') {
    if (!editable()) return message('Seu perfil permite somente consultar as fases.', true);
    const p = id ? WorkTrackingService.phase(id) : {};
    if (id && (!p || p.workId !== workId)) return;
    dialog(id ? 'Planejar e editar fase' : 'Nova fase', `${input('name', 'Nome da fase', p.name, 'text', 'required maxlength="160"')}
      ${choose('status', 'Situação', C.statuses.map((s) => [s, s]), p.status || 'Não iniciada')}${input('percent', 'Percentual executado', p.percent ?? 0, 'number', 'required min="0" max="100" step="0.1"')}
      ${input('plannedStart', 'Início previsto', p.plannedStart, 'date')}${input('plannedEnd', 'Término previsto', p.plannedEnd, 'date')}
      ${input('startDate', 'Início real', p.startDate, 'date')}${input('endDate', 'Término real', p.endDate, 'date')}
      <details class="wc-disclosure wide"><summary>Planejamento, equipe e observações</summary><div class="wc-form">${input('weight', 'Peso no avanço total', p.weight ?? 1, 'number', 'min="0.1" max="1000" step="0.1"')}
      ${ctx().modules.includes('financial') ? input('budgetCost', 'Custo previsto da fase (R$)', p.budgetCost, 'number', 'min="0" step="0.01"') : ''}
      ${input('plannedPersonDays', 'Pessoas-dia previstas', p.plannedPersonDays, 'number', 'min="0" step="0.5"')}
      <p class="wc-copy wide">Peso 1 dá a mesma importância às fases. Pessoas-dia: 3 pessoas por 2 dias = 6. É planejamento, não presença.</p>${peopleField(p.teamIds || [])}${memo('internalNote', 'Observações', p.internalNote)}</div></details>`, (data) => {
      const values = Object.fromEntries(data); if (!ctx().modules.includes('financial')) values.budgetCost = p.budgetCost;
      const result = C.savePhase(db, workId, { ...p, ...values, id, teamIds: data.getAll('teamIds') }, ctx());
      commit(result.state, 'Fase atualizada', values.name); closeModal(); render();
    }, 'Salvar fase');
  }
  function progressDialog(workId, selected = '') {
    const phases = workPhasesFor(workId); if (!phases.length) return editPhase(workId);
    local.operation = uid();
    dialog('Atualizar andamento', `${choose('phaseId', 'Fase da obra', phases.map((p) => [p.id, p.name]), selected || phases[0].id)}
      ${input('percent', 'Percentual executado', (phases.find((p) => p.id === selected) || phases[0]).percent ?? 0, 'number', 'required min="0" max="100" step="0.1"')}
      ${memo('note', 'Observação (opcional)')}<label class="wc-check wide"><input type="checkbox" name="correction"> Estou corrigindo um percentual anterior</label>
      <label class="wc-check wide"><input type="checkbox" name="photoAfter"> Adicionar uma foto após salvar</label><p class="wc-copy wide">Data, horário e responsável serão registrados automaticamente.</p>`, (data) => {
      const values = Object.fromEntries(data), next = C.updateProgress(db, workId, values.phaseId, { ...values, correction: data.has('correction'), operationId: local.operation }, ctx());
      commit(next, 'Andamento atualizado', workById(workId)?.name || 'Obra'); closeModal(); render();
      if (data.has('photoAfter')) showWorkPhasePhotoDialog(workId, values.phaseId);
    }, 'Salvar andamento');
    $('#wc-form [name=phaseId]').addEventListener('change', (e) => { $('#wc-form [name=percent]').value = phases.find((p) => p.id === e.target.value)?.percent ?? 0; });
  }
  function metric(label, value, note = '') { return `<article class="wc-metric"><small>${h(label)}</small><strong>${h(value)}</strong>${note ? `<span>${h(note)}</span>` : ''}</article>`; }
  function healthCard(key, label, value) { return `<button class="wc-health" type="button" data-wc-action="explain" data-indicator="${key}" data-status="${h(value.status)}"><span>${h(label)}</span><strong>${value.value == null ? '—' : `${value.value}<small>/100</small>`}</strong><span>${h(value.status)}</span><small>Ver cálculo</small></button>`; }
  function panel(m) {
    const f = m.finance, p = m.prediction, current = m.active.map((x) => x.name).join(' · ') || m.phases.find((x) => x.id === m.work.control?.baseline?.currentPhaseId)?.name || 'Não definida';
    return `<div class="wc-metrics">${metric('Executado', pct(m.physical.value), `${m.finished}/${m.phases.length} fases concluídas`)}${metric('Fase atual', current)}${metric('Equipe escalada hoje', new Set(m.team.map((t) => t.employeeId)).size, dt(today()))}${metric('Previsão de término', p.endDate ? dt(p.endDate) : 'Aguardando histórico', `Confiança ${p.confidence.toLowerCase()}`)}</div>
      <div class="wc-health-grid">${healthCard('general', 'Saúde geral', m.health.general)}${f ? healthCard('finance', 'Saúde financeira', m.health.finance) : ''}${healthCard('schedule', 'Cronograma', m.health.schedule)}${healthCard('efficiency', 'Eficiência/produção', m.health.efficiency)}</div>
      <div class="wc-two"><section class="wc-card"><h2>Precisa de atenção</h2>${m.alerts.length ? `<ul>${m.alerts.map((a) => `<li>${h(a)}</li>`).join('')}</ul>` : '<p>Nenhum alerta nas informações disponíveis.</p>'}${!m.work.control?.baseline && editable() ? b('edit-work', 'Informar marco inicial', { work: m.work.id }) : ''}</section>
      <section class="wc-card"><h2>Próximos passos</h2><p>${h(p.reason)}</p><small>${h(m.physical.method)} Cobertura das medições: ${m.physical.coverage}%.</small><div class="wc-actions">${b('section', 'Ver fases', { section: 'phases' })}${ctx().modules.includes('planning') ? b('go', 'Escala diária', { page: 'planning' }) : ''}${ctx().modules.includes('reports') ? b('print', 'Imprimir painel') : ''}</div></section></div>
      ${f ? `<section class="wc-card"><div class="wc-heading"><h2>Financeiro da obra</h2>${b('section', 'Ver detalhes', { section: 'finance' })}</div><div class="wc-metrics">${metric('Custo conhecido', cash(f.costs.total), 'Presença + despesas + histórico conciliado')}${metric('Recebido', cash(f.received.total))}${metric('Ainda a receber', cash(f.outstanding), 'Valor contratado menos recebido')}${metric('Saldo conhecido', cash(f.cash), 'Recebido menos custo conhecido')}</div></section>` : ''}`;
  }
  function phaseCards(m) {
    return `<div class="wc-heading"><div><h2>Fases da obra</h2><p>Planeje a etapa, atualize a execução e acompanhe as fotos.</p></div><div class="wc-actions">${editable() ? `${b('template', 'Fases sugeridas', { work: m.work.id })}${b('phase', '+ Nova fase', { work: m.work.id }, true)}` : ''}</div></div>
      <div class="wc-phase-grid">${m.phases.map((p, i) => { const cost = m.finance?.phaseCosts.find((c) => c.phaseId === p.id), photos = workMediaFor(m.work.id, p.id); return `<article class="wc-phase-card"><div class="wc-heading"><h3>${i + 1}. ${h(p.name)}</h3><span class="wc-tag">${h(p.status || 'Não iniciada')}</span></div><div class="wc-progress" role="progressbar" aria-label="Andamento de ${h(p.name)}" aria-valuenow="${C.number(p.percent) ?? 0}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(0, Math.min(100, C.number(p.percent) ?? 0))}%"></span></div><strong>${pct(C.number(p.percent))}</strong><small>Prazo: ${dt(p.plannedEnd)} · ${photos.length} foto(s)</small>${cost ? `<small>Mão de obra: ${cash(cost.labor)} · ${cost.people} pessoa(s) / ${cost.days} dia(s)</small>` : ''}<div class="wc-actions">${editable() ? b('progress', 'Atualizar', { work: m.work.id, phase: p.id }, true) : ''}${b('photos', 'Fotos', { work: m.work.id, phase: p.id })}${editable() ? b('phase', 'Editar', { work: m.work.id, phase: p.id }) : ''}</div><details class="wc-disclosure"><summary>Detalhes da fase</summary><p>${h(p.internalNote || 'Nenhuma observação.')}</p><small>Início previsto: ${dt(p.plannedStart)}<br>Início real: ${dt(p.startDate)}<br>Término real: ${dt(p.endDate)}<br>Peso: ${p.weight ?? 1}</small>${cost ? `<small>Custo conhecido: ${cash(cost.total)} · Pessoas-dia: ${cost.personDays}</small>` : ''}${editable() ? `<div class="wc-actions">${b('move', '↑', { work: m.work.id, phase: p.id, direction: '-1' })}${b('move', '↓', { work: m.work.id, phase: p.id, direction: '1' })}${b('delete-phase', 'Excluir fase', { work: m.work.id, phase: p.id })}</div>` : ''}</details></article>`; }).join('') || '<p class="wc-card">Nenhuma fase cadastrada. Crie a primeira ou escolha um modelo.</p>'}</div>`;
  }
  function finances(m) {
    const f = m.finance; if (!f) return '<p class="wc-card">O seu perfil não tem acesso ao Financeiro.</p>';
    const categories = { material: 'Materiais registrados', service: 'Serviços registrados', equipment: 'Equipamentos e veículos', other: 'Outros custos registrados' };
    return `<section class="wc-card"><h2>Valores e origem dos dados</h2><div class="wc-metrics">${metric('Valor contratado', cash(f.contract))}${metric('Custo orçado', cash(f.budget))}${metric('Recebido', cash(f.received.total))}${metric('Ainda a receber', cash(f.outstanding))}${f.recordedOutstanding != null ? metric('A receber já lançado no Financeiro', cash(f.recordedOutstanding), 'Reutiliza os fechamentos e recebíveis existentes') : ''}${metric('Custo conhecido', cash(f.costs.total))}${metric('Mão de obra registrada', cash(f.labor))}${f.categories.map((x) => metric(categories[x.kind], cash(x.total))).join('')}${metric('Saldo conhecido', cash(f.cash))}${metric('Margem sobre custo conhecido', f.knownMargin == null ? 'Não calculada' : `${f.knownMargin}%`, 'Não é margem final')}${metric('Custo projetado total', cash(m.prediction.projectedCost), 'Estimativa pelo ritmo observado')}${metric('Lucro projetado', cash(f.contract != null && m.prediction.projectedCost != null ? C.round(f.contract - m.prediction.projectedCost) : null), 'Depende da estimativa e de custos completos')}</div>
      <details class="wc-disclosure"><summary>Como os valores anteriores foram conciliados</summary><p>Custos anteriores informados: ${cash(f.costs.initial)}. Já detalhados até o marco: ${cash(f.costs.recordedBefore)}. Histórico sem detalhamento: ${cash(f.costs.unitemized)}. Novos custos: ${cash(f.costs.recordedAfter)}.</p><p>O maior total anterior é usado uma única vez. Valores não informados permanecem desconhecidos. Pagamentos e vales não repetem a despesa da presença.</p></details></section>
      <section class="wc-card"><h2>Leitura financeira</h2><p><b>O que está bom:</b> ${f.budget != null && f.costs.total <= f.budget ? 'O custo conhecido ainda está dentro do orçamento informado.' : 'Consulte os recebimentos e lançamentos confirmados; faltam dados para afirmar se o resultado é bom.'}</p><p><b>O que preocupa:</b> ${h(m.alerts.filter((a) => /custo|recebido|total/i.test(a)).join(' ') || 'Não há alerta financeiro nos dados conhecidos.')}</p><p><b>O que pode melhorar:</b> confira custos sem fase, valores anteriores e orçamento. ${cash(f.unassigned)} de custos registrados ainda estão sem fase válida.</p><div class="wc-actions">${editable('financial') ? b('expense-link', 'Vincular despesa existente à fase', { work: m.work.id }) : ''}${b('go', 'Abrir Financeiro', { page: 'financial' })}</div></section>`;
  }
  function history(m) {
    const remote = serverHistory.get(`${ctx().companyId}:${m.work.id}`), updates = new Map(C.list(db.workUpdates).map((e) => [e.id, e]));
    for (const e of remote?.rows || []) updates.set(e.id, { ...e, responsible: `${e.responsible || 'Usuário'} · registro do servidor (${String(e.actorId || '').slice(0, 8)})` });
    const rows = C.timeline({ ...db, workUpdates: [...updates.values()] }, m.work.id, ledger(), ctx(), local.historyFilter);
    return `<section class="wc-card"><div class="wc-heading"><h2>Linha do tempo</h2>${choose('historyFilter', 'Tipo de evento', [['all', 'Todos'], ['Cadastro', 'Cadastro'], ['Andamento', 'Andamento'], ['Equipe', 'Equipe'], ['Fotos', 'Fotos'], ['Prazos', 'Prazos'], ...(m.finance ? [['Financeiro', 'Financeiro']] : [])], local.historyFilter)}</div><p role="status">${h(remote?.loading ? 'Conferindo histórico protegido…' : remote?.error || (remote ? 'Histórico local combinado com os registros protegidos do servidor.' : 'Mostrando os registros disponíveis neste aparelho.'))}</p><ol class="wc-timeline">${rows.slice(0, local.historyLimit).map((e) => `<li><time>${dt(e.at)}${e.at.includes('T') ? ` · ${new Date(e.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}</time><div><b>${h(e.title)}</b><p>${h(e.detail)}${e.value != null ? ` · ${cash(e.value)}` : ''}</p>${e.actor ? `<small>Por ${h(e.actor)}</small>` : ''}</div></li>`).join('') || '<li>Nenhum evento neste filtro.</li>'}</ol>${rows.length > local.historyLimit ? b('history-more', 'Mostrar mais eventos') : ''}${remote?.hasMore ? b('history-server', 'Buscar registros antigos', { work: m.work.id }) : ''}${remote?.error ? b('history-server', 'Tentar novamente', { work: m.work.id }) : ''}</section>`;
  }
  async function loadHistory(workId) {
    const companyId = ctx().companyId, key = `${companyId}:${workId}`;
    if (!companyId || !window.ObraAtivaWorkSync?.ready(companyId)) return;
    const item = serverHistory.get(key) || { rows: [], hasMore: true, loading: false };
    if (item.loading || !item.hasMore) return;
    item.loading = true; item.error = ''; serverHistory.set(key, item);
    try {
      const rows = await CloudSync.request('/rest/v1/rpc/read_work_control_history', { method: 'POST', body: JSON.stringify({ p_company_id: companyId, p_work_id: workId, p_offset: item.rows.length }) }, CloudSync.session?.access_token);
      if (!Array.isArray(rows)) throw new Error('Resposta inválida');
      item.rows.push(...rows.filter((e) => e.workId === workId)); item.hasMore = rows.length === 200;
    } catch { item.error = 'Não foi possível conferir o histórico protegido agora. Os registros locais continuam visíveis.'; }
    finally { item.loading = false; if (ctx().companyId === companyId && activeWorkTrackerId === workId && local.section === 'history') render(); }
  }
  function operational(m) {
    return `<section class="wc-card"><h2>Operação e previsão</h2><div class="wc-metrics">${metric('Prazo global informado', dt(m.targetEnd))}${metric('Fases em execução', m.active.length)}${metric('Fases atrasadas', m.late.length)}${metric('Dias com mão de obra registrada', new Set(C.ledgerFor(ledger(), m.work.id).rows.filter((r) => r.kind === 'labor' && r.units > 0).map((r) => r.date)).size)}${metric('Ritmo observado', m.prediction.dailyProgress == null ? 'Dados insuficientes' : `${m.prediction.dailyProgress} pontos/dia`)}</div><p>${h(m.prediction.reason)}</p><p><b>Previsão:</b> ${dt(m.prediction.endDate)} · Confiança ${h(m.prediction.confidence.toLowerCase())} · ${m.prediction.sample || 0} datas de medição.</p><h3>Distribuição de hoje</h3><div class="wc-rows">${m.team.map((d) => `<div><b>${h(emp(d.employeeId)?.name || 'Funcionário indisponível')}</b><span>${h(m.phases.find((p) => p.id === d.phaseId)?.name || 'Sem fase definida')}</span></div>`).join('') || '<p>Nenhuma pessoa escalada nesta obra para hoje.</p>'}</div><details class="wc-disclosure"><summary>Simulações futuras</summary><p>A projeção usa o ritmo observado no histórico, sem simular novas contratações. Cenários para aumentar ou reduzir equipe ficam para uma evolução futura: mais pessoas não garantem ganho proporcional.</p></details></section>`;
  }
  const previousTracker = workTrackerPage, previousWorks = worksGlobal, previousPhaseList = workTrackerPhaseList;
  workTrackerPhaseList = function (work) { return enabled() ? phaseCards(model(work.id)) : previousPhaseList(work); };
  workTrackerPage = function () {
    const work = workById(activeWorkTrackerId); if (!work || !enabled()) return previousTracker();
    if (activeWorkTrackerTab === 'media') return `<div class="wc-root">${nav('photos')}${previousTracker()}</div>`;
    const m = model(work.id), content = { panel, phases: phaseCards, finance: finances, operation: operational, history }[local.section] || panel;
    return `<main class="wc-root"><header class="wc-heading wc-work-heading"><div><div class="wc-title-line">${b('go', '← Obras', { page: 'works' })}<h1>${h(work.name)}</h1></div><span class="wc-tag">${h(m.priority)}</span></div><div class="wc-actions">${editable() && !work.archived ? `${b('edit-work', 'Editar obra', { work: work.id })}${b('progress', 'Atualizar andamento', { work: work.id }, true)}` : ''}</div></header>${nav(local.section)}${content(m)}</main>`;
  };
  function nav(current) { return `<nav class="wc-tabs" aria-label="Áreas da obra">${[['panel', 'Painel da obra'], ['phases', 'Fases e fotos'], ['operation', 'Operação'], ...(ctx().modules.includes('financial') ? [['finance', 'Financeiro']] : []), ['history', 'Linha do tempo']].map(([key, label]) => b('section', label, { section: key, selected: current === key ? 'true' : 'false' })).join('')}</nav>`; }
  const previousOpen = openWorkTracker, previousWorkModal = openInternalWorkModal, previousOfficeModal = openOfficeWorkModal,
    previousInternalPhaseModal = openInternalWorkPhaseModal, previousPhaseModal = openWorkPhaseModal, previousPhaseDialog = window.showWorkPhaseDialog;
  openWorkTracker = function (id) { if (!enabled()) return previousOpen(id); if (!workById(id)) return; activeWorkTrackerId = id; activeWorkTrackerTab = 'panel'; workMediaPhaseFilter = ''; local.section = 'panel'; page = 'worktracker'; renderTop(); render(); };
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
  function collection() {
    const models = C.radar(db, ledger(), ctx(), local.filter);
    return `<div class="wc-heading"><h1>Radar da empresa</h1>${choose('radarFilter', 'Mostrar obras', [['all', 'Todas, inclusive arquivadas'], ['active', 'Em andamento'], ['critical', 'Críticas'], ['attention', 'Precisam de atenção'], ['late', 'Atrasadas'], ['near', 'Próximas da conclusão'], ...(ctx().modules.includes('financial') ? [['financial', 'Saúde financeira']] : [])], local.filter)}</div><div class="wc-radar">${models.map((m) => `<article class="wc-card"><div class="wc-heading"><h2>${h(m.work.name)}</h2><span class="wc-tag">${h(m.priority)}</span></div><p>${m.work.archived ? 'Arquivada · ' : ''}${pct(m.physical.value)} · ${h(m.active.map((p) => p.name).join(', ') || 'Fase não definida')}</p><div class="wc-rows"><div><span>Saúde geral</span><b>${m.health.general.value ?? '—'} · ${h(m.health.general.status)}</b></div>${m.finance ? `<div><span>Saúde financeira</span><b>${m.health.finance.value ?? '—'} · ${h(m.health.finance.status)}</b></div>` : ''}<div><span>Prazo</span><b>${m.deadlineOverdue ? 'Prazo global ultrapassado' : m.late.length ? `${m.late.length} fase(s) atrasada(s)` : 'Sem atraso identificado nos dados conhecidos'}</b></div><div><span>Equipe hoje</span><b>${new Set(m.team.map((d) => d.employeeId)).size}</b></div><div><span>Término estimado</span><b>${dt(m.prediction.endDate)}</b></div></div><p>${h(m.alerts[0] || 'Acompanhe os registros para manter a visão atualizada.')}</p>${b('open', 'Abrir obra', { work: m.work.id }, true)}</article>`).join('') || '<p class="wc-card">Nenhuma obra corresponde ao filtro escolhido.</p>'}</div>`;
  }
  function historyCompany() {
    const stats = C.historical(db, ledger(), ctx()), models = C.radar(db, ledger(), ctx()), compare = C.benchmark(db, ledger(), ctx());
    const comparable = models.filter((m) => m.physical.value === 100 && m.finance?.contract > 0 && m.work.control?.baseline && !m.finance.costs.missingHistory && m.finance.costs.total > 0);
    const bestMargin = comparable.length >= 2 ? [...comparable].sort((a, b) => b.finance.knownMargin - a.finance.knownMargin)[0] : null;
    const highlights = `<section class="wc-card"><h2>Padrões que ajudam a planejar</h2><p>São necessários pelo menos dois registros comparáveis. Resultado financeiro conhecido não equivale a lucro auditado; custos ausentes podem mudar a ordem.</p><div class="wc-metrics">${metric('Menor duração registrada', compare.fastest?.name || 'Dados insuficientes', compare.fastest ? `${compare.fastest.days} dias · datas reais` : '')}${ctx().modules.includes('financial') ? `${metric('Maior resultado conhecido', compare.profit?.name || 'Dados insuficientes', compare.profit ? cash(compare.profit.profit) : '')}${metric('Maior custo conhecido', compare.cost?.name || 'Dados insuficientes', compare.cost ? cash(compare.cost.cost) : '')}${metric('Fase com mais mão de obra', compare.laborPhase?.name || 'Dados insuficientes', compare.laborPhase ? cash(compare.laborPhase.meanLabor) + ' em média' : '')}` : ''}${metric('Fase mais demorada', compare.slowestPhase?.name || 'Dados insuficientes', compare.slowestPhase ? `${compare.slowestPhase.meanDays} dias em média` : '')}</div></section>`;
    return highlights + `<section class="wc-card"><h1>Histórico e comparação da empresa</h1><p>Obras e fases com datas e custos registrados. Tipos, tamanhos e escopos diferentes limitam a comparação.</p><div class="wc-metrics">${metric('Obras consultadas', models.length)}${metric('Obras concluídas comparáveis', comparable.length)}${metric('Melhor margem conhecida', bestMargin?.work.name || 'Dados insuficientes', bestMargin ? `${bestMargin.finance.knownMargin}% · conferir custos completos` : '')}</div></section><section class="wc-card"><h2>Padrões por fase</h2><div class="wc-scroll"><table class="wc-table"><thead><tr><th>Fase</th><th>Obras distintas</th><th>Duração média</th><th>Equipe média</th><th>Ritmo médio</th>${ctx().modules.includes('financial') ? '<th>Custo médio</th><th>Mão de obra média</th>' : ''}<th>Variação de prazo</th><th>Confiança</th></tr></thead><tbody>${stats.map((s) => `<tr><td>${h(s.name)}</td><td>${s.distinctWorks}</td><td>${s.meanDays} dias</td><td>${s.meanPeople ?? '—'}</td><td>${s.meanPace} pontos/dia</td>${ctx().modules.includes('financial') ? `<td>${cash(s.meanCost)}</td><td>${cash(s.meanLabor)}</td>` : ''}<td>${s.meanDelay == null ? '—' : `${s.meanDelay > 0 ? '+' : ''}${s.meanDelay} dias`}</td><td>${h(s.confidence)}</td></tr>`).join('') || '<tr><td colspan="8">Registre início e término reais de fases concluídas para formar o histórico.</td></tr>'}</tbody></table></div><details class="wc-disclosure"><summary>Origem e confiança das médias</summary><p>Fases de mesmo nome, com acentos normalizados, são agrupadas dentro da empresa atual. Nenhum dado de outras empresas é usado. Custos sem vínculo ficam fora da média da fase.</p><p>Baixa: menos de 4 obras ou dados muito variáveis. Média: pelo menos 4 obras e variação relativa de duração até 60%. Alta: pelo menos 10 obras e variação até 25%. Mesmo com alta confiança histórica, o escopo da próxima obra pode ser diferente.</p></details></section>`;
  }
  worksGlobal = function () { if (!enabled()) return previousWorks(); const tabs = `<nav class="wc-tabs" aria-label="Visões das obras">${[['list', 'Obras'], ['radar', 'Radar da empresa'], ['history', 'Histórico e comparação']].map(([key, label]) => b('collection', label, { collection: key, selected: local.collection === key ? 'true' : 'false' })).join('')}</nav>`; return `<div class="wc-root">${tabs}${local.collection === 'radar' ? collection() : local.collection === 'history' ? historyCompany() : previousWorks()}</div>`; };
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
  function expenseLink(id) {
    const entries = ledger().filter((r) => r.workId === id && !['labor', 'receipt'].includes(r.kind));
    dialog('Vincular uma despesa já registrada', `${choose('entry', 'Despesa existente', entries.map((r, i) => [i, `${dt(r.date)} · ${r.label} · ${cash(r.value)}`]))}${choose('phaseId', 'Fase da obra', [['', 'Sem fase'], ...workPhasesFor(id).map((p) => [p.id, p.name])])}<p class="wc-copy wide">Esta ação acrescenta somente o vínculo da fase. O valor não é lançado novamente.</p>`, (data) => {
      const entry = entries[Number(data.get('entry'))]; if (!entry) throw new Error('Nenhuma despesa disponível.');
      const next = JSON.parse(JSON.stringify(db)), record = C.list(next[entry.source]).find((r) => r.id === entry.id && r.workId === id);
      if (!record) throw new Error('A despesa mudou. Abra o formulário novamente.');
      const phaseId = String(data.get('phaseId') || ''); if (phaseId && !workPhasesFor(id).some((p) => p.id === phaseId)) throw new Error('Fase não encontrada na obra.');
      record.phaseId = phaseId; commit(next, 'Despesa vinculada à fase', workById(id)?.name, 'financial'); closeModal(); render();
    }, 'Salvar vínculo');
  }
  document.addEventListener('click', (e) => {
    const target = e.target.closest?.('[data-wc-action]'); if (!target) return;
    e.preventDefault(); e.stopPropagation(); const d = target.dataset;
    try {
      switch (d.wcAction) {
        case 'close': closeModal(); break;
        case 'go': go(d.page); break;
        case 'open': openWorkTracker(d.work); break;
        case 'collection': local.collection = d.collection; render(); break;
        case 'section': local.section = d.section; activeWorkTrackerTab = 'panel'; render(); if (d.section === 'history') void loadHistory(activeWorkTrackerId); break;
        case 'history-more': local.historyLimit += 100; render(); break;
        case 'history-server': void loadHistory(d.work); break;
        case 'edit-work': editWork(d.work); break;
        case 'phase': editPhase(d.work, d.phase); break;
        case 'progress': progressDialog(d.work, d.phase); break;
        case 'photos': openWorkPhaseFolder(d.work, d.phase); break;
        case 'move': if (editable()) moveWorkPhase(d.work, d.phase, Number(d.direction)); break;
        case 'delete-phase': if (editable()) deleteWorkPhase(d.work, d.phase); break;
        case 'expense-link': expenseLink(d.work); break;
        case 'print': window.print(); break;
        case 'explain': { const m = model(activeWorkTrackerId), s = m.health[d.indicator]; dialog('Como a nota é calculada', `<p class="wide">${h(s.explanation)}</p>`, () => closeModal(), 'Entendi'); break; }
        case 'template': dialog('Escolha as fases sugeridas', `${choose('template', 'Tipo de obra', [['construction', 'Construção'], ['renovation', 'Reforma']])}<p class="wide wc-copy">Acrescenta as fases que ainda não existem com esse nome. Você poderá editar nomes, pesos e datas.</p>`, (data) => { commit(C.addTemplate(db, d.work, data.get('template'), ctx()), 'Fases sugeridas adicionadas', workById(d.work)?.name); closeModal(); render(); }, 'Adicionar fases'); break;
      }
    } catch (error) { message(error.message, true); }
  });
  document.addEventListener('change', (e) => { if (e.target.name === 'radarFilter') { local.filter = e.target.value; render(); } if (e.target.name === 'historyFilter') { local.historyFilter = e.target.value; render(); } });
  document.addEventListener('obraativa:work-sync-conflict', () => message(window.ObraAtivaWorkSync.error(ctx().companyId), true));
  window.ObraAtivaWorkControl = Object.freeze({ ledger, model, context: ctx });
  Object.assign(window, { openWorkTracker, openInternalWorkModal, openOfficeWorkModal, openInternalWorkPhaseModal, openWorkPhaseModal, saveBulkDistribution });
})();
