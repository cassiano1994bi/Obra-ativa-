(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ObraAtivaWorkCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const list = (value) => Array.isArray(value) ? value : [];
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const text = (value) => String(value ?? '').trim();
  const number = (value) => value === null || value === undefined || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
  const day = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
  function fail(message) { throw new Error(message); }
  function date(value, label) { if (!value) return ''; if (!day(value)) fail(`${label}: informe uma data válida.`); return value; }
  function moneyInput(value, label) { if (value === '' || value == null) return null; const n = number(value); if (n == null || n < 0 || n > 1e12) fail(`${label}: informe um valor entre zero e um trilhão.`); return round(n); }
  function context(ctx, area = 'works') {
    if (!ctx?.companyId || !ctx.userId || !ctx.now || !day(ctx.today)) fail('Não foi possível identificar empresa, usuário ou data.');
    if (ctx.readOnly || !list(ctx.modules).includes(area)) fail('Seu acesso não permite esta alteração.');
  }
  function scoped(state, ctx) {
    if (!ctx?.companyId) fail('Selecione a empresa antes de consultar as obras.');
    if (state.companyId && state.companyId !== ctx.companyId) fail('Os dados pertencem a outra empresa.');
    return state;
  }
  function find(state, key, id, ctx) {
    scoped(state, ctx);
    const row = list(state[key]).find((r) => r.id === id);
    if (!row || (row.companyId && row.companyId !== ctx.companyId)) fail('Registro não encontrado nesta empresa.');
    return row;
  }
  function event(state, workId, kind, data, ctx) {
    state.workUpdates ??= [];
    state.workUpdates.push({ id: ctx.id(), workId, date: ctx.today, createdAt: ctx.now,
      title: kind, kind, responsible: ctx.userName || '', actorId: ctx.userId,
      companyId: ctx.companyId, controlEvent: true, ...data });
  }
  function baseline(input, ctx, employees) {
    const entry = input.entry || 'new';
    if (!['new', 'ongoing', 'final'].includes(entry)) fail('Escolha a situação da obra.');
    const startedAt = date(input.startedAt, 'Início da obra');
    const asOfDate = date(input.asOfDate || ctx.today, 'Marco inicial');
    if (asOfDate > ctx.today || startedAt > asOfDate) fail('O início e o marco não podem estar no futuro nem em ordem invertida.');
    if (input.plannedEnd && startedAt && input.plannedEnd < startedAt) fail('O prazo previsto não pode ser anterior ao início da obra.');
    const teamIds = [...new Set(list(input.teamIds))];
    if (teamIds.some((id) => !employees.some((e) => e.id === id))) fail('Selecione pessoas cadastradas nesta empresa.');
    return { version: 1, entry, recordedAt: ctx.now, asOfDate, startedAt,
      approximateStart: !!input.approximateStart, contractValue: moneyInput(input.contractValue, 'Valor contratado'),
      budgetValue: moneyInput(input.budgetValue, 'Custo orçado'),
      priorReceived: entry === 'new' ? 0 : moneyInput(input.priorReceived, 'Recebimentos anteriores'),
      priorCost: entry === 'new' ? 0 : moneyInput(input.priorCost, 'Custos anteriores'),
      plannedEnd: date(input.plannedEnd, 'Prazo da obra'), currentPhaseId: text(input.currentPhaseId),
      teamIds, notes: text(input.notes).slice(0, 4000), actorId: ctx.userId };
  }
  function saveWork(state, input, ctx) {
    context(ctx); scoped(state, ctx);
    const next = copy(state), name = text(input.name);
    if (!name || name.length > 160) fail('Informe o nome da obra com até 160 caracteres.');
    next.works ??= [];
    let work = input.id ? find(next, 'works', input.id, ctx) : null;
    if (!work) { work = { id: ctx.id(), name, status: 'Em andamento', archived: false, createdAt: ctx.now }; next.works.push(work); }
    const oldName = work.name;
    work.name = name;
    if (input.baseline) {
      if (work.control?.baseline) fail('O marco inicial já está registrado. Use os novos lançamentos para manter o histórico.');
      const base = baseline(input.baseline, ctx, list(next.employees));
      if (base.currentPhaseId && !list(next.workPhases).some((p) => p.id === base.currentPhaseId && p.workId === work.id)) fail('A fase atual não pertence a esta obra.');
      work.control = { ...(work.control || {}), version: 1, baseline: base };
      event(next, work.id, 'Marco inicial registrado', { baseline: copy(base) }, ctx);
    }
    if (input.id && oldName !== name) event(next, work.id, 'Obra renomeada', { previousName: oldName, name }, ctx);
    if (input.plan) {
      const before = copy(work.control?.plan || {}), plan = { ...before };
      for (const key of ['contractValue', 'budgetValue']) if (Object.hasOwn(input.plan, key)) {
        if (!ctx.modules.includes('financial')) fail('Seu perfil não permite alterar valores financeiros.');
        plan[key] = moneyInput(input.plan[key], key === 'contractValue' ? 'Valor contratado' : 'Custo orçado');
      }
      if (Object.hasOwn(input.plan, 'plannedEnd')) plan.plannedEnd = date(input.plan.plannedEnd, 'Prazo da obra');
      work.control = { ...(work.control || {}), version: 1, plan };
      if (JSON.stringify(before) !== JSON.stringify(plan)) event(next, work.id, 'Planejamento atualizado', { before, after: copy(plan) }, ctx);
    }
    return { state: next, workId: work.id };
  }
  const statuses = Object.freeze(['Não iniciada', 'Programada', 'Em andamento', 'Pausada', 'Atrasada', 'Concluída']);
  const templates = Object.freeze({
    construction: ['Preparação/canteiro', 'Terraplanagem', 'Fundação', 'Estrutura', 'Alvenaria', 'Lajes', 'Cobertura', 'Impermeabilização', 'Hidráulica', 'Elétrica', 'Chapisco', 'Reboco', 'Contrapiso', 'Revestimentos', 'Pisos', 'Esquadrias', 'Pintura', 'Acabamentos', 'Área externa', 'Paisagismo', 'Limpeza', 'Entrega'],
    renovation: ['Preparação/proteção', 'Demolição', 'Adequações', 'Hidráulica', 'Elétrica', 'Impermeabilização', 'Revestimentos', 'Pintura', 'Acabamentos', 'Limpeza', 'Entrega']
  });
  function percent(value) { const n = number(value); if (n == null || n < 0 || n > 100) fail('O percentual deve estar entre 0 e 100.'); return round(n); }
  function phaseInput(input, ctx, state) {
    const name = text(input.name), status = input.status || 'Não iniciada', value = percent(input.percent ?? 0);
    if (!name || name.length > 160) fail('Informe o nome da fase com até 160 caracteres.');
    if (!statuses.includes(status)) fail('Escolha uma situação válida.');
    if ((status === 'Concluída') !== (value === 100)) fail('Uma fase concluída deve ter 100%.');
    if (['Não iniciada', 'Programada'].includes(status) && value > 0) fail('Uma fase com execução deve estar em andamento, pausada, atrasada ou concluída.');
    const fields = { plannedStart: date(input.plannedStart, 'Início previsto'), startDate: date(input.startDate, 'Início real'), plannedEnd: date(input.plannedEnd, 'Término previsto'), endDate: date(input.endDate, 'Término real') };
    if (fields.plannedStart && fields.plannedEnd && fields.plannedEnd < fields.plannedStart) fail('O término previsto deve ser posterior ao início previsto.');
    if (fields.startDate > ctx.today || fields.endDate > ctx.today || (fields.startDate && fields.endDate && fields.endDate < fields.startDate)) fail('Revise a ordem das datas reais da fase.');
    if (fields.endDate && status !== 'Concluída') fail('Término real só pode ser informado para uma fase concluída.');
    const weight = number(input.weight) ?? 1;
    if (weight <= 0 || weight > 1000) fail('Informe um peso maior que zero, até 1000.');
    const teamIds = [...new Set(list(input.teamIds))];
    if (teamIds.some((id) => !list(state.employees).some((e) => e.id === id))) fail('Equipe não encontrada nesta empresa.');
    return { name, status, percent: value, ...fields, weight, teamIds,
      budgetCost: moneyInput(input.budgetCost, 'Custo previsto da fase'), plannedPersonDays: moneyInput(input.plannedPersonDays, 'Pessoas-dia previstas'), internalNote: text(input.internalNote).slice(0, 4000),
      controlVersion: 1, updatedAt: ctx.now };
  }
  function savePhase(state, workId, input, ctx) {
    context(ctx); const next = copy(state), work = find(next, 'works', workId, ctx);
    if (work.archived || work.status === 'Finalizada') fail('Reabra a obra antes de alterar suas fases.');
    const data = phaseInput(input, ctx, next);
    next.workPhases ??= [];
    let phase = input.id ? find(next, 'workPhases', input.id, ctx) : null;
    if (phase && phase.workId !== workId) fail('A fase não pertence a esta obra.');
    const before = phase ? copy(phase) : null;
    if (phase) Object.assign(phase, data);
    else { phase = { id: ctx.id(), workId, createdAt: ctx.now, order: list(next.workPhases).filter((p) => p.workId === workId).length + 1, showPublic: false, showOwner: false, ...data }; next.workPhases.push(phase); }
    work.control = { ...(work.control || {}), version: 1 };
    event(next, workId, before ? 'Fase atualizada' : 'Fase cadastrada', { phaseId: phase.id, before, after: copy(phase), previousPercent: before ? number(before.percent) : null, percent: phase.percent, delta: before ? round(phase.percent - (number(before.percent) ?? 0)) : null }, ctx);
    return { state: next, phaseId: phase.id };
  }
  function addTemplate(state, workId, template, ctx) {
    context(ctx); find(state, 'works', workId, ctx);
    if (!templates[template]) fail('Modelo não encontrado.');
    const existing = new Set(list(state.workPhases).filter((p) => p.workId === workId).map((p) => text(p.name).toLocaleLowerCase('pt-BR')));
    let next = state;
    for (const name of templates[template]) if (!existing.has(name.toLocaleLowerCase('pt-BR'))) next = savePhase(next, workId, { name, status: 'Não iniciada', percent: 0 }, ctx).state;
    return next;
  }
  function updateProgress(state, workId, phaseId, input, ctx) {
    context(ctx); const phase = find(state, 'workPhases', phaseId, ctx);
    if (phase.workId !== workId) fail('A fase não pertence a esta obra.');
    if (!input.operationId) fail('Identificador da atualização ausente. Abra o formulário novamente.');
    if (list(state.workUpdates).some((e) => e.operationId === input.operationId)) return state;
    const previous = number(phase.percent) ?? 0, value = percent(input.percent), note = text(input.note);
    if (value < previous && (!input.correction || !note)) fail('Para corrigir um percentual para baixo, marque a correção e explique o motivo.');
    const status = value === 100 ? 'Concluída' : value > 0 ? (['Pausada', 'Atrasada'].includes(phase.status) ? phase.status : 'Em andamento') : 'Não iniciada';
    const next = savePhase(state, workId, { ...phase, percent: value, status,
      startDate: phase.startDate || (value > 0 ? ctx.today : ''), endDate: value === 100 ? phase.endDate || ctx.today : '' }, ctx).state;
    const last = next.workUpdates.at(-1);
    Object.assign(last, { kind: 'Andamento atualizado', title: 'Andamento atualizado', operationId: input.operationId,
      correction: value < previous, description: note.slice(0, 4000), previousPercent: previous, percent: value, delta: round(value - previous) });
    return next;
  }
  function schedulePhases(state, workId, assignmentDate, selections, ctx) {
    context(ctx, 'planning'); date(assignmentDate, 'Data da escala');
    const next = copy(state), work = find(next, 'works', workId, ctx);
    if (work.archived || work.status === 'Finalizada') fail('Esta obra não está disponível para a escala.');
    const selected = new Map();
    for (const item of selections) {
      const person = find(next, 'employees', item.employeeId, ctx);
      if (person.status && person.status !== 'Ativo') fail('Escolha apenas funcionários ativos.');
      if (selected.has(person.id)) fail('Funcionário repetido na distribuição.');
      if (item.phaseId) { const phase = find(next, 'workPhases', item.phaseId, ctx); if (phase.workId !== workId) fail('A fase não pertence à obra selecionada.'); }
      selected.set(person.id, item.phaseId || '');
    }
    next.distributions ??= [];
    const before = copy(next.distributions.filter((d) => d.date === assignmentDate));
    for (const [employeeId, phaseId] of selected) {
      const matches = next.distributions.filter((d) => d.employeeId === employeeId && d.date === assignmentDate);
      if (matches.length > 1) fail('Há distribuições duplicadas nesta data. Revise antes de alterar.');
      if (matches.length) Object.assign(matches[0], { workId, phaseId, updatedAt: ctx.now });
      else next.distributions.push({ id: ctx.id(), employeeId, workId, phaseId, date: assignmentDate, createdAt: ctx.now });
    }
    next.distributions = next.distributions.filter((d) => !(d.date === assignmentDate && d.workId === workId && !selected.has(d.employeeId)));
    const after = next.distributions.filter((d) => d.date === assignmentDate);
    // Perfis somente de escala não podem modificar o módulo Obras. O servidor
    // registra o vínculo no histórico sem ampliar os módulos desse perfil.
    if (JSON.stringify(before) !== JSON.stringify(after) && ctx.modules.includes('works')) event(next, workId, 'Equipe distribuída', { assignmentDate, before, after: copy(after) }, ctx);
    return next;
  }
  function ledgerFor(rows, workId) {
    const seen = new Map(), warnings = [], accepted = [];
    for (const row of list(rows).filter((r) => r.workId === workId)) {
      if (!row.id || !row.source || number(row.value) == null || number(row.value) < 0 || !day(row.date)) { warnings.push('Há lançamento sem identificador, data ou valor válido.'); continue; }
      if (row.kind === 'payment' || row.kind === 'advance') continue;
      const key = row.identity || `${row.source}:${row.id}`;
      if (seen.has(key)) { if (seen.get(key).value !== row.value) warnings.push('Há valores divergentes para o mesmo lançamento.'); continue; }
      seen.set(key, row); accepted.push({ ...row, value: round(Number(row.value)) });
    }
    return { rows: accepted, warnings: [...new Set(warnings)] };
  }
  function reconcile(rows, initial, cutoff) {
    const before = rows.filter((r) => cutoff && r.date <= cutoff).reduce((sum, r) => sum + r.value, 0);
    const after = rows.filter((r) => !cutoff || r.date > cutoff).reduce((sum, r) => sum + r.value, 0);
    return { total: round(Math.max(initial ?? 0, before) + after), initial: initial ?? null,
      recordedBefore: round(before), recordedAfter: round(after), unitemized: initial == null ? null : round(Math.max(0, initial - before)),
      inconsistent: initial != null && initial < before, missingHistory: initial == null && !!cutoff };
  }
  function costSummary(state, workId, ledger, ctx) {
    const work = find(state, 'works', workId, ctx), base = work.control?.baseline || {}, { rows, warnings } = ledgerFor(list(ledger).filter((r) => !r.companyId || r.companyId === ctx.companyId), workId);
    const expenses = rows.filter((r) => r.kind !== 'receipt'), receipts = rows.filter((r) => r.kind === 'receipt');
    const costs = reconcile(expenses, base.priorCost, base.asOfDate), received = reconcile(receipts, base.priorReceived, base.asOfDate);
    if (!work.control?.baseline) { costs.missingHistory = true; received.missingHistory = true; }
    const phases = list(state.workPhases).filter((p) => p.workId === workId), phaseIds = new Set(phases.map((p) => p.id));
    const phaseCosts = phases.map((p) => {
      const entries = expenses.filter((e) => e.phaseId === p.id), labor = entries.filter((e) => e.kind === 'labor' && number(e.units) > 0);
      return { phaseId: p.id, total: round(entries.reduce((s, e) => s + e.value, 0)), labor: round(labor.reduce((s, e) => s + e.value, 0)),
        people: new Set(labor.map((e) => e.employeeId)).size, days: new Set(labor.map((e) => e.date)).size,
        personDays: round(labor.reduce((s, e) => s + (number(e.units) ?? 0), 0)), entries };
    });
    if (costs.inconsistent || received.inconsistent) warnings.push('O total informado no marco é menor que os lançamentos antigos. O painel preserva o maior total e pede conferência.');
    return { costs, received, phaseCosts, rows, warnings, labor: round(expenses.filter((r) => r.kind === 'labor').reduce((s, e) => s + e.value, 0)),
      categories: ['material', 'service', 'equipment', 'other'].map((kind) => ({ kind, total: round(expenses.filter((r) => r.kind === kind).reduce((s, e) => s + e.value, 0)) })),
      unassigned: round(expenses.filter((e) => !phaseIds.has(e.phaseId)).reduce((s, e) => s + e.value, 0)) };
  }
  const elapsed = (a, b) => (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000;
  const addDays = (value, n) => new Date(Date.parse(`${value}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
  const unconfirmedLegacy = (p) => p.controlVersion !== 1 && number(p.percent) === 0 && p.status === 'Não iniciada' && !p.startDate && !p.updatedAt;
  function progress(phases) {
    const valid = phases.filter((p) => !unconfirmedLegacy(p) && number(p.percent) != null && number(p.percent) >= 0 && number(p.percent) <= 100);
    const totalWeight = phases.reduce((sum, p) => sum + (number(p.weight) > 0 ? Number(p.weight) : 1), 0);
    const measuredWeight = valid.reduce((sum, p) => sum + (number(p.weight) > 0 ? Number(p.weight) : 1), 0);
    return { value: !phases.length || valid.length !== phases.length ? null : round(valid.reduce((sum, p) => sum + Number(p.percent) * (number(p.weight) > 0 ? Number(p.weight) : 1), 0) / totalWeight),
      coverage: totalWeight ? round(measuredWeight / totalWeight * 100) : 0,
      method: new Set(phases.map((p) => number(p.weight) > 0 ? Number(p.weight) : 1)).size > 1 ? 'Média ponderada pelos pesos informados das fases.' : 'Média simples das fases; cada fase tem o mesmo peso. Percentual aproximado.' };
  }
  function score(value, explanation) {
    const note = value == null ? null : Math.round(clamp(value));
    return { value: note, status: note == null ? 'Dados insuficientes' : note < 40 ? 'Crítico' : note < 70 ? 'Atenção' : 'Saudável', explanation };
  }
  function indicators(phases, financial, today) {
    const physical = progress(phases);
    const planned = phases.filter((p) => day(p.plannedStart) && day(p.plannedEnd));
    const weight = (p) => number(p.weight) > 0 ? Number(p.weight) : 1;
    const plannedValue = planned.length && planned.length === phases.length ? planned.reduce((sum, p) => sum + clamp(elapsed(p.plannedStart, today) / Math.max(1, elapsed(p.plannedStart, p.plannedEnd)) * 100) * weight(p), 0) / planned.reduce((sum, p) => sum + weight(p), 0) : null;
    const schedule = score(physical.value != null && plannedValue > 0 ? 100 * physical.value / plannedValue : null,
      plannedValue > 0 && physical.value != null ? `Avanço informado ${physical.value}% ÷ avanço previsto ${round(plannedValue)}% × 100, limitado a 100. Datas planejadas e pesos das fases.` : 'Informe o planejamento de todas as fases e seus percentuais para avaliar o cronograma.');
    const budget = financial?.budget;
    const canScoreFinance = budget > 0 && financial?.costs.total > 0 && physical.value > 0 && !financial.costs.missingHistory;
    const finance = score(canScoreFinance ? 100 * (budget * physical.value / 100) / financial.costs.total : null,
      canScoreFinance ? `Custo orçado proporcional ao avanço (${round(budget * physical.value / 100)}) ÷ custo conhecido (${financial.costs.total}) × 100, limitado a 100. Referência linear de orçamento, não lucro nem auditoria de custos completos.` : 'Informe orçamento, avanço e custos, inclusive o histórico anterior, para avaliar o custo em relação à execução.');
    const production = phases.filter((p) => number(p.plannedPersonDays) > 0 && number(p.percent) != null);
    const actualUnits = financial ? financial.phaseCosts.filter((c) => production.some((p) => p.id === c.phaseId)).reduce((s, c) => s + c.personDays, 0) : 0;
    const expectedUnits = production.reduce((s, p) => s + Number(p.plannedPersonDays) * Number(p.percent) / 100, 0);
    const efficiency = score(actualUnits > 0 && production.length === phases.length ? 100 * expectedUnits / actualUnits : null,
      actualUnits > 0 ? `Pessoas-dia previstas para o avanço informado (${round(expectedUnits)}) ÷ pessoas-dia realizadas (${round(actualUnits)}) × 100. Limitado a 100; não avalia funcionários individualmente.` : 'Informe pessoas-dia previstas e vincule a presença às fases para medir produção.');
    const values = [schedule.value, finance.value, efficiency.value].filter((n) => n != null);
    const general = score(values.length >= 2 ? values.reduce((s, n) => s + n, 0) / values.length : null, `Média simples dos indicadores disponíveis (${values.length} de 3). São necessários pelo menos dois. Veja as fórmulas individuais e a cobertura dos dados.`);
    return { general, finance, schedule, efficiency, plannedValue };
  }
  function financialSummary(state, workId, ledger, ctx) {
    const control = find(state, 'works', workId, ctx).control || {}, base = { ...(control.baseline || {}), ...(control.plan || {}) }, summary = costSummary(state, workId, ledger, ctx);
    const phases = list(state.workPhases).filter((p) => p.workId === workId);
    const budget = number(base.budgetValue) ?? (phases.length && phases.every((p) => number(p.budgetCost) != null) ? round(phases.reduce((s, p) => s + Number(p.budgetCost), 0)) : null);
    const contract = number(base.contractValue);
    return { ...summary, contract, budget, outstanding: contract == null || summary.received.missingHistory ? null : round(Math.max(0, contract - summary.received.total)),
      overReceived: contract == null ? null : round(Math.max(0, summary.received.total - contract)), cash: round(summary.received.total - summary.costs.total),
      knownMargin: contract > 0 ? round((contract - summary.costs.total) / contract * 100) : null };
  }
  function forecast(state, workId, phases, physical, finance, today) {
    const unavailable = (reason) => ({ endDate: null, dailyProgress: null, remainingDays: null, projectedCost: null, confidence: 'Baixa', reason, sample: 0 });
    if (physical.value == null || physical.value <= 0 || physical.value >= 100) return unavailable(physical.value === 100 ? 'As fases informadas estão concluídas.' : 'Registre o percentual de todas as fases e atualizações datadas.');
    let updates = list(state.workUpdates).filter((e) => e.workId === workId && e.controlEvent && e.kind === 'Andamento atualizado' && e.createdAt && e.date <= today).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const correction = updates.findLastIndex((e) => e.correction || number(e.delta) < 0);
    if (correction >= 0) updates = updates.slice(correction + 1);
    const distinctDays = [...new Set(updates.map((e) => e.date))];
    const days = distinctDays.length ? elapsed(distinctDays[0], distinctDays.at(-1)) : 0;
    if (distinctDays.length < 3 || days < 7) return unavailable('São necessárias pelo menos três datas de medição em uma janela de sete dias, após a última correção.');
    if (phases.some((p) => p.createdAt && p.createdAt.slice(0, 10) > distinctDays[0])) return unavailable('As fases mudaram durante a janela. Novas medições formarão uma base comparável.');
    const changedWeights = list(state.workUpdates).some((e) => e.workId === workId && e.createdAt >= updates[0].createdAt && e.before && e.after && (e.before.weight ?? 1) !== (e.after.weight ?? 1));
    if (changedWeights) return unavailable('Os pesos das fases mudaram nesta janela. Aguarde uma nova base de medições.');
    const totalWeight = phases.reduce((s, p) => s + (number(p.weight) > 0 ? Number(p.weight) : 1), 0);
    const gain = updates.filter((e) => e.date > distinctDays[0]).reduce((sum, e) => {
      const phase = phases.find((p) => p.id === e.phaseId);
      return sum + (phase ? Math.max(0, number(e.delta) ?? 0) * (number(phase.weight) > 0 ? Number(phase.weight) : 1) / totalWeight : 0);
    }, 0);
    if (gain <= 0) return unavailable('Não há avanço positivo suficiente na janela de medição.');
    if (elapsed(distinctDays.at(-1), today) > 14) return unavailable('O andamento não é atualizado há mais de 14 dias. Atualize antes de projetar.');
    const dailyProgress = gain / days, remainingDays = Math.ceil((100 - physical.value) / dailyProgress);
    if (remainingDays > 3650) return unavailable('O ritmo observado é baixo demais para uma previsão útil.');
    const recentCosts = finance?.rows.filter((r) => r.kind !== 'receipt' && r.date > distinctDays[0] && r.date <= distinctDays.at(-1)) || [];
    const burn = recentCosts.length ? recentCosts.reduce((s, e) => s + e.value, 0) / days : null;
    return { endDate: addDays(today, remainingDays), remainingDays, dailyProgress: round(dailyProgress), projectedCost: burn == null ? null : round(finance.costs.total + burn * remainingDays),
      confidence: distinctDays.length >= 6 && days >= 21 ? 'Média' : 'Baixa', sample: distinctDays.length, days,
      reason: `Avanço ponderado de ${round(gain)} pontos em ${days} dias corridos. Prazo = restante ÷ ritmo; custo = conhecido + custo médio diário da mesma janela × dias restantes. Equipe, escopo e ritmo mantidos. É uma estimativa, não um compromisso.` };
  }
  function overview(state, workId, ledger, ctx) {
    const work = find(state, 'works', workId, ctx), phases = list(state.workPhases).filter((p) => p.workId === workId).sort((a, b) => (number(a.order) ?? 0) - (number(b.order) ?? 0));
    const physical = progress(phases), canFinance = list(ctx.modules).includes('financial'), finance = canFinance ? financialSummary(state, workId, ledger, ctx) : null;
    const health = indicators(phases, finance, ctx.today), prediction = forecast(state, workId, phases, physical, finance, ctx.today);
    const active = phases.filter((p) => ['Em andamento', 'Atrasada'].includes(p.status)), late = phases.filter((p) => p.status !== 'Concluída' && (p.status === 'Atrasada' || (day(p.plannedEnd) && p.plannedEnd < ctx.today)));
    const team = list(state.distributions).filter((d) => d.workId === workId && d.date === ctx.today);
    const targetEnd = Object.hasOwn(work.control?.plan || {}, 'plannedEnd') ? work.control.plan.plannedEnd : work.control?.baseline?.plannedEnd;
    const deadlineOverdue = day(targetEnd) && targetEnd < ctx.today && physical.value !== 100 && !work.archived && work.status !== 'Finalizada';
    const alerts = [];
    if (late.length) alerts.push(`${late.length} fase(s) com atraso.`);
    if (deadlineOverdue) alerts.push(`O prazo global informado (${targetEnd}) foi ultrapassado.`);
    if (day(targetEnd) && prediction.endDate && prediction.endDate > targetEnd) alerts.push('O ritmo observado indica término após o prazo global informado.');
    if (!work.control?.baseline) alerts.push('Marco inicial ainda não informado. O histórico anterior pode estar incompleto.');
    if (physical.coverage < 100) alerts.push('Há fases sem medição confirmada; o percentual total ainda não está disponível. Pastas antigas precisam de conferência.');
    if (phases.some((p) => !day(p.plannedStart) || !day(p.plannedEnd))) alerts.push('Há fases sem datas previstas; o cronograma ainda não pode ser avaliado por completo.');
    if (finance?.budget != null && finance.costs.total > finance.budget) alerts.push('O custo conhecido ultrapassou o custo orçado.');
    if (finance?.unassigned > 0) alerts.push('Existem custos da obra sem fase atribuída.');
    if (finance?.costs.missingHistory) alerts.push('Custos anteriores ao marco não informados; o total é parcial.');
    if (finance?.received.missingHistory) alerts.push('Recebimentos anteriores ao marco não informados; confira o histórico antes de calcular o saldo a receber.');
    if (finance?.overReceived > 0) alerts.push('O recebido ultrapassa o valor contratado informado. Confira o contrato.');
    alerts.push(...(finance?.warnings || []));
    return { work, phases, physical, finance, health, prediction, active, late, team, targetEnd, deadlineOverdue,
      finished: phases.filter((p) => p.status === 'Concluída').length, alerts,
      priority: health.general.status === 'Crítico' || (finance?.budget > 0 && finance.costs.total > finance.budget) ? 'Crítico' : late.length || alerts.length ? 'Atenção' : 'Normal' };
  }
  function timeline(state, workId, ledger, ctx, filter = 'all') {
    const work = find(state, 'works', workId, ctx), events = [];
    if (work.createdAt) events.push({ id: `work:${workId}`, kind: 'Cadastro', title: 'Obra cadastrada', at: work.createdAt, detail: work.name });
    list(state.workUpdates).filter((e) => e.workId === workId).forEach((e) => events.push({ id: `update:${e.id}`, kind: e.kind === 'Equipe distribuída' ? 'Equipe' : 'Andamento', title: e.title || 'Atualização', at: e.createdAt || e.date, actor: e.responsible || '', detail: e.delta != null ? `${e.previousPercent}% → ${e.percent}% (${e.delta > 0 ? '+' : ''}${e.delta} pontos). ${e.description || ''}` : e.description || '' }));
    list(state.workMedia).filter((e) => e.workId === workId).forEach((e) => events.push({ id: `photo:${e.id}`, kind: 'Fotos', title: 'Fotografia registrada', at: e.createdAt || e.date, detail: e.caption || '' }));
    const phases = list(state.workPhases).filter((p) => p.workId === workId);
    for (const p of phases) {
      if (day(p.startDate)) events.push({ id: `phase:${p.id}:start`, kind: 'Andamento', title: 'Início real da fase', at: p.startDate, detail: p.name });
      if (p.status === 'Concluída' && day(p.endDate)) events.push({ id: `phase:${p.id}:end`, kind: 'Andamento', title: 'Fase concluída', at: p.endDate, detail: p.name });
      if (p.status !== 'Concluída' && day(p.plannedEnd) && p.plannedEnd < ctx.today) events.push({ id: `phase:${p.id}:late`, kind: 'Prazos', title: 'Prazo ultrapassado (calculado)', at: addDays(p.plannedEnd, 1), detail: `${p.name}. Término previsto: ${p.plannedEnd}.` });
    }
    if (phases.length && phases.every((p) => p.status === 'Concluída' && day(p.endDate))) events.push({ id: `work:${workId}:finished`, kind: 'Andamento', title: 'Todas as fases concluídas', at: phases.map((p) => p.endDate).sort().at(-1), detail: 'Data do último término real registrado. Não altera o arquivamento da obra.' });
    if (list(ctx.modules).includes('financial')) ledgerFor(ledger, workId).rows.forEach((e) => events.push({ id: `ledger:${e.identity || e.source + ':' + e.id}`, kind: 'Financeiro', title: e.kind === 'receipt' ? 'Recebimento' : 'Custo registrado', at: e.date, value: e.value, detail: e.label || '' }));
    const seen = new Set();
    return events.filter((e) => e.at && !seen.has(e.id) && seen.add(e.id) && (filter === 'all' || e.kind === filter)).sort((a, b) => b.at.localeCompare(a.at));
  }
  function historical(state, ledger, ctx) {
    scoped(state, ctx);
    const groups = new Map();
    for (const work of list(state.works).filter((w) => !w.companyId || w.companyId === ctx.companyId)) {
      const costs = list(ctx.modules).includes('financial') ? costSummary(state, work.id, ledger, ctx) : null;
      for (const p of list(state.workPhases).filter((p) => p.workId === work.id && p.status === 'Concluída' && day(p.startDate) && day(p.endDate) && p.endDate >= p.startDate)) {
        const key = text(p.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const group = groups.get(key) || { name: p.name, samples: [] };
        const cost = costs?.phaseCosts.find((c) => c.phaseId === p.id);
        group.samples.push({ workId: work.id, days: elapsed(p.startDate, p.endDate) + 1, cost: cost?.entries.length ? cost.total : null,
          labor: cost?.entries.some((e) => e.kind === 'labor') ? cost.labor : null, people: cost?.people || null,
          delay: day(p.plannedEnd) ? elapsed(p.plannedEnd, p.endDate) : null });
        groups.set(key, group);
      }
    }
    const mean = (values) => values.length ? round(values.reduce((s, n) => s + n, 0) / values.length) : null;
    return [...groups.values()].map((g) => {
      const meanDays = mean(g.samples.map((s) => s.days)), companiesWorks = new Set(g.samples.map((s) => s.workId)).size;
      const variance = mean(g.samples.map((s) => (s.days - meanDays) ** 2)), cv = meanDays ? Math.sqrt(variance) / meanDays : 0;
      return { ...g, meanDays, meanPace: mean(g.samples.map((s) => 100 / s.days)), meanCost: mean(g.samples.map((s) => s.cost).filter((n) => n != null)), meanLabor: mean(g.samples.map((s) => s.labor).filter((n) => n != null)), meanPeople: mean(g.samples.map((s) => s.people).filter((n) => n != null)),
        meanDelay: mean(g.samples.map((s) => s.delay).filter((n) => n != null)), distinctWorks: companiesWorks, cv: round(cv),
        confidence: companiesWorks >= 10 && cv <= 0.25 ? 'Alta' : companiesWorks >= 4 && cv <= 0.6 ? 'Média' : 'Baixa' };
    }).sort((a, b) => b.meanDays - a.meanDays);
  }
  function radar(state, ledger, ctx, filter = 'all') {
    const models = list(state.works).filter((w) => !w.companyId || w.companyId === ctx.companyId).map((w) => overview(state, w.id, ledger, ctx));
    const predicates = { all: () => true, critical: (m) => m.priority === 'Crítico', late: (m) => m.late.length > 0 || m.deadlineOverdue,
      active: (m) => !m.work.archived && m.work.status !== 'Finalizada', near: (m) => m.physical.value >= 80 && m.physical.value < 100,
      financial: (m) => ['Crítico', 'Atenção'].includes(m.health.finance.status), attention: (m) => m.priority !== 'Normal' };
    return models.filter(predicates[filter] || predicates.all).sort((a, b) => ({ Crítico: 0, Atenção: 1, Normal: 2 })[a.priority] - ({ Crítico: 0, Atenção: 1, Normal: 2 })[b.priority]);
  }
  function benchmark(state, ledger, ctx) {
    const models = radar(state, ledger, ctx);
    const complete = models.filter((m) => m.phases.length && m.phases.every((p) => p.status === 'Concluída' && day(p.endDate)));
    const durations = complete.filter((m) => day(m.work.control?.baseline?.startedAt) && !m.work.control.baseline.approximateStart)
      .map((m) => ({ workId: m.work.id, name: m.work.name, days: elapsed(m.work.control.baseline.startedAt, m.phases.map((p) => p.endDate).sort().at(-1)) + 1 })).filter((m) => m.days > 0);
    const results = complete.filter((m) => m.finance?.contract > 0 && m.work.control?.baseline && !m.finance.costs.missingHistory && m.finance.costs.total > 0)
      .map((m) => ({ workId: m.work.id, name: m.work.name, profit: round(m.finance.contract - m.finance.costs.total), margin: m.finance.knownMargin }));
    const costs = models.filter((m) => m.finance?.costs.total > 0).map((m) => ({ workId: m.work.id, name: m.work.name, cost: m.finance.costs.total }));
    const phases = historical(state, ledger, ctx);
    const select = (rows, key, ascending = false) => rows.length < 2 ? null : [...rows].sort((a, b) => (a[key] - b[key]) * (ascending ? 1 : -1))[0];
    return { fastest: select(durations, 'days', true), profit: select(results, 'profit'), margin: select(results, 'margin'), cost: select(costs, 'cost'),
      slowestPhase: select(phases, 'meanDays'), laborPhase: select(phases.filter((p) => p.meanLabor != null), 'meanLabor'), durations, results, costs };
  }
  return Object.freeze({ list, number, round, day, date, context, find, event, saveWork, statuses, templates, savePhase, addTemplate, updateProgress, schedulePhases, ledgerFor, reconcile, costSummary,
    progress, unconfirmedLegacy, indicators, financialSummary, forecast, overview, timeline, historical, radar, benchmark });
});
