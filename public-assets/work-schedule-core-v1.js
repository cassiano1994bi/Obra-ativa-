(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ObraAtivaWorkScheduleCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const list = (value) => Array.isArray(value) ? value : [];
  const text = (value) => String(value ?? '').trim();
  const day = (value) => /^\d{4}-\d{2}-\d{2}$/.test(text(value)) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const clamp = (value) => Math.max(0, Math.min(100, number(value)));
  const daysBetween = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);

  function validatePlan(plannedStart, plannedEnd) {
    const start = text(plannedStart), end = text(plannedEnd);
    if (!day(start) || !day(end)) throw new Error('Informe o início e o término previstos.');
    if (end < start) throw new Error('O término previsto deve ser igual ou posterior ao início.');
    return { plannedStart: start, plannedEnd: end };
  }

  function status(phase, today) {
    const percent = clamp(phase?.percent), start = day(phase?.plannedStart) ? phase.plannedStart : '', end = day(phase?.plannedEnd) ? phase.plannedEnd : '';
    const complete = percent >= 100 || phase?.status === 'Concluída';
    const remainingDays = end && day(today) ? daysBetween(today, end) : null;
    const durationDays = start && end ? daysBetween(start, end) + 1 : null;
    let label = 'Sem prazo', tone = 'missing';
    if (complete) { label = 'Concluída'; tone = 'complete'; }
    else if (remainingDays != null && remainingDays < 0) { label = 'Atrasada'; tone = 'late'; }
    else if (remainingDays != null && remainingDays <= 3) { label = 'Atenção'; tone = 'attention'; }
    else if (start && end) { label = 'No prazo'; tone = 'on-time'; }
    const remainingLabel = remainingDays == null ? 'Prazo não definido' : remainingDays < 0 ? `${Math.abs(remainingDays)} dia${Math.abs(remainingDays) === 1 ? '' : 's'} de atraso` : remainingDays === 0 ? 'Termina hoje' : `${remainingDays} dia${remainingDays === 1 ? '' : 's'} restante${remainingDays === 1 ? '' : 's'}`;
    return { label, tone, complete, percent, plannedStart: start, plannedEnd: end, remainingDays, remainingLabel, durationDays };
  }

  function ordered(phases) {
    return list(phases).map((phase, index) => ({ ...phase, __index: index })).sort((a, b) => {
      const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : a.__index + 1;
      const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : b.__index + 1;
      return ao - bo || a.__index - b.__index;
    });
  }

  function summarize(phases, today) {
    const rows = ordered(phases), ids = new Set(rows.map((phase) => phase.id));
    const parents = new Set(rows.map((phase) => phase.parentPhaseId).filter((id) => ids.has(id)));
    const leaves = rows.filter((phase) => !parents.has(phase.id));
    const pending = leaves.filter((phase) => !status(phase, today).complete);
    const started = pending.filter((phase) => status(phase, today).percent > 0 || (day(phase.plannedStart) && phase.plannedStart <= today));
    const current = started[0] || pending[0] || null;
    const currentIndex = current ? leaves.findIndex((phase) => phase.id === current.id) : -1;
    const next = currentIndex >= 0 ? leaves.slice(currentIndex + 1).find((phase) => !status(phase, today).complete) || null : pending[0] || null;
    const allScheduled = leaves.length > 0 && leaves.every((phase) => day(phase.plannedStart) && day(phase.plannedEnd));
    const endDate = allScheduled ? leaves.map((phase) => phase.plannedEnd).sort().at(-1) : null;
    return {
      current,
      next,
      endDate,
      scheduled: leaves.filter((phase) => day(phase.plannedStart) && day(phase.plannedEnd)).length,
      total: leaves.length,
      reason: endDate ? 'Término planejado pela última etapa.' : leaves.length ? 'Defina o prazo das etapas restantes para calcular.' : 'Cadastre ao menos uma fase.'
    };
  }

  function validateParent(phases, workId, parentId, phaseId = '') {
    const rows = list(phases).filter((phase) => phase.workId === workId), parent = rows.find((phase) => phase.id === parentId);
    if (!parent) throw new Error('A fase principal não foi encontrada nesta obra.');
    if (parent.id === phaseId) throw new Error('Uma etapa não pode ser ligada a ela mesma.');
    if (parent.parentPhaseId) throw new Error('Para manter simples, use somente um nível de etapas.');
    if (phaseId && rows.some((phase) => phase.parentPhaseId === phaseId)) throw new Error('Uma fase que já possui etapas não pode virar subetapa.');
    return parent;
  }

  return Object.freeze({ day, daysBetween, validatePlan, validateParent, status, summarize, ordered });
});
