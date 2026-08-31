import { buildReadOnlyContext } from './assistant-context.mjs';
import { buildDeterministicAnalysis, resolveAnalysisPeriod } from './assistant-tools.mjs';

export const INSIGHT_DEFINITIONS = Object.freeze([
  Object.freeze({ type: 'spending_increase', label: 'Aumento anormal de gastos', modules: ['works', 'team', 'planning', 'attendance', 'vehicles'] }),
  Object.freeze({ type: 'pending_payment', label: 'Pagamento pendente', modules: ['team', 'attendance', 'payments'] }),
  Object.freeze({ type: 'frequent_absences', label: 'Faltas frequentes', modules: ['team', 'attendance'] }),
  Object.freeze({ type: 'high_spend_low_progress', label: 'Obra com gasto alto e pouco avanço', modules: ['works', 'team', 'planning', 'attendance'] }),
  Object.freeze({ type: 'received_vs_spent', label: 'Diferença entre recebido e gasto', modules: ['works', 'team', 'planning', 'attendance', 'financial'] }),
  Object.freeze({ type: 'performance_drop', label: 'Queda de desempenho', modules: ['team', 'attendance'] }),
  Object.freeze({ type: 'high_vehicle_spend', label: 'Gasto elevado com veículo', modules: ['vehicles'] }),
  Object.freeze({ type: 'incomplete_records', label: 'Registros incompletos', modules: [] }),
  Object.freeze({ type: 'stale_work_update', label: 'Obra sem atualização recente', modules: ['works'] }),
  Object.freeze({ type: 'possible_duplicate', label: 'Possível lançamento duplicado', modules: [] })
]);

const MODULE_SET = new Set(['works', 'clients', 'team', 'planning', 'attendance', 'payments', 'financial', 'vehicles', 'reports']);
const DAY_MS = 86400000;

function text(value, maxLength = 240) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalized(value) {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return 0;
  const prepared = raw.includes(',') ? raw.replace(/[^\d,\-]/g, '').replace(/\./g, '').replace(',', '.') : raw.replace(/[^\d.\-]/g, '');
  const parsed = Number(prepared);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number(value));
}

function percent(value) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(number(value))}%`;
}

function iso(value) {
  const result = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : '';
}

function dateAtNoon(value) {
  return new Date(`${iso(value)}T12:00:00Z`);
}

function addDays(value, days) {
  const date = dateAtNoon(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousPeriod(period) {
  if (!iso(period?.from) || !iso(period?.to)) return { kind: 'previous', label: 'Período anterior', from: '', to: '' };
  const duration = Math.max(0, Math.round((dateAtNoon(period.to) - dateAtNoon(period.from)) / DAY_MS));
  const to = addDays(period.from, -1);
  return { kind: 'previous', label: 'Período anterior equivalente', from: addDays(to, -duration), to };
}

function statusFactor(status) {
  const value = normalized(status);
  if (value === 'trabalhou') return 1;
  if (value === 'meio periodo') return 0.5;
  return 0;
}

function inPeriod(item, period) {
  const value = iso(item?.date || item?.closedDate || item?.expectedDate || item?.dueDate || item?.createdAt || item?.startDate);
  if (!value) return false;
  return (!period?.from || value >= period.from) && (!period?.to || value <= period.to);
}

function allowedRules(allowedModules) {
  const allowed = new Set(allowedModules);
  return INSIGHT_DEFINITIONS.map((definition) => ({
    ...definition,
    allowed: definition.modules.every((module) => allowed.has(module))
  }));
}

function analysisFor(data, allowedModules, period) {
  const context = buildReadOnlyContext({ data, allowedModules, period });
  const plan = { intent: 'general', deniedModules: [], selectedModules: context.allowedModules || [] };
  return { context, facts: buildDeterministicAnalysis({ plan, context, period, settings: data.settings || {} }).facts };
}

function evidence(label, value, formula = '') {
  return Object.freeze({ label: text(label, 100), value: text(value, 180), formula: text(formula, 260) });
}

function target(page, label, entityId = '') {
  return Object.freeze({ page: text(page, 40), label: text(label, 100), entityId: text(entityId, 120) });
}

function alertItem({ type, severity = 'attention', title, message, evidence: evidenceRows, target: alertTarget, entityId = '', confidence = 'medium', period, missingData = [] }) {
  return Object.freeze({
    id: text(`alert-${type}-${entityId || title}`, 180).replace(/[^a-zA-Z0-9_.:\-]/g, '-'),
    type,
    severity: severity === 'info' ? 'info' : 'attention',
    title: text(title, 180),
    message: text(message, 600),
    evidence: Object.freeze((evidenceRows || []).slice(0, 12)),
    target: alertTarget,
    confidence: ['low', 'medium', 'high'].includes(confidence) ? confidence : 'low',
    period: Object.freeze({ label: text(period?.label, 100), from: iso(period?.from), to: iso(period?.to) }),
    missingData: Object.freeze((missingData || []).map((item) => text(item, 180)).filter(Boolean).slice(0, 12)),
    readOnly: true
  });
}

function check(definition, status, count = 0, detail = '') {
  return Object.freeze({ type: definition.type, label: definition.label, status, count: Math.max(0, Math.floor(number(count))), detail: text(detail, 320) });
}

function employeeRatios(context) {
  const employees = new Map((context.collections.employees || []).map((item) => [item.id, item]));
  const map = new Map();
  (context.collections.attendance || []).forEach((row) => {
    if (!row?.employeeId || !row?.date) return;
    const key = `${row.employeeId}|${row.date}`;
    const current = map.get(key);
    if (!current || (!row.workId && current.workId)) map.set(key, row);
  });
  const totals = new Map();
  map.forEach((row) => {
    const current = totals.get(row.employeeId) || { employeeId: row.employeeId, name: text(employees.get(row.employeeId)?.name || 'Funcionário sem identificação', 160), records: 0, worked: 0, absences: 0 };
    current.records += 1;
    current.worked += statusFactor(row.status);
    if (/falt|ausenc/.test(normalized(row.status))) current.absences += 1;
    totals.set(row.employeeId, current);
  });
  return totals;
}

function workTrackingFacts(data, allowedModules, period) {
  if (!allowedModules.includes('works')) return new Map();
  const phases = Array.isArray(data.workPhases) ? data.workPhases : [];
  const updates = Array.isArray(data.workUpdates) ? data.workUpdates : [];
  const media = Array.isArray(data.workMedia) ? data.workMedia : [];
  const map = new Map();
  (Array.isArray(data.works) ? data.works : []).filter((work) => work && work.id && work.archived !== true).slice(0, 500).forEach((work) => {
    const workPhases = phases.filter((item) => item?.workId === work.id).slice(0, 300);
    const dates = [work.updatedAt, work.createdAt, work.startDate, work.start,
      ...updates.filter((item) => item?.workId === work.id).flatMap((item) => [item.date, item.updatedAt, item.createdAt]),
      ...media.filter((item) => item?.workId === work.id).flatMap((item) => [item.date, item.updatedAt, item.createdAt])
    ].map(iso).filter(Boolean).sort();
    const progress = workPhases.length ? workPhases.reduce((sum, item) => sum + Math.max(0, Math.min(100, number(item.percent))), 0) / workPhases.length : null;
    map.set(work.id, Object.freeze({
      workId: text(work.id, 120),
      name: text(work.name || 'Obra sem identificação', 160),
      status: text(work.status, 80),
      active: !/finaliz|conclu|arquiv|cancel/.test(normalized(work.status)),
      phaseCount: workPhases.length,
      progress,
      lastUpdate: dates.at(-1) || '',
      updatesInPeriod: updates.filter((item) => item?.workId === work.id && inPeriod(item, period)).length
    }));
  });
  return map;
}

function vehicleByWork(context) {
  const map = new Map();
  const rows = [
    ...(context.collections.fuel || []).map((item) => ({ ...item, amount: number(item.total ?? item.value) })),
    ...(context.collections.maintenance || []).map((item) => ({ ...item, amount: number(item.value) })),
    ...(context.collections.tow || []).map((item) => ({ ...item, amount: number(item.value) })),
    ...(context.collections.licenses || []).map((item) => ({ ...item, amount: number(item.value) }))
  ];
  rows.forEach((item) => { if (item.workId) map.set(item.workId, (map.get(item.workId) || 0) + item.amount); });
  return map;
}

function median(values) {
  const rows = values.map(number).filter((value) => value > 0).sort((left, right) => left - right);
  if (!rows.length) return 0;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

function incompleteRecords(data, context, allowedModules) {
  const results = [];
  const allowed = new Set(allowedModules);
  const rules = [
    ['attendance', 'Presenças', ['employeeId', 'date', 'status'], 'attendance', 'Abrir Presença'],
    ['distributions', 'Escalas', ['employeeId', 'workId', 'date'], 'planning', 'Abrir Escala diária'],
    ['payments', 'Pagamentos', ['employeeId', 'date', 'value'], 'financial', 'Abrir Financeiro'],
    ['advances', 'Vales', ['employeeId', 'date', 'value'], 'financial', 'Abrir Financeiro'],
    ['discounts', 'Descontos', ['employeeId', 'date', 'value'], 'financial', 'Abrir Financeiro'],
    ['receipts', 'Recebimentos', ['workId', 'date', 'value'], 'financial', 'Abrir Financeiro'],
    ['fuel', 'Combustível', ['vehicleId', 'date'], 'vehicles', 'Abrir Veículos'],
    ['maintenance', 'Manutenções', ['vehicleId', 'date', 'value'], 'vehicles', 'Abrir Veículos'],
    ['tow', 'Guinchos', ['vehicleId', 'date', 'value'], 'vehicles', 'Abrir Veículos'],
    ['licenses', 'Licenciamentos', ['vehicleId', 'date', 'value'], 'vehicles', 'Abrir Veículos']
  ];
  rules.forEach(([collection, label, fields, page, button]) => {
    const rows = context.collections[collection] || [];
    const incomplete = rows.filter((row) => fields.some((field) => row?.[field] === undefined || row?.[field] === null || String(row[field]).trim() === '')).length;
    if (incomplete) results.push({ label, count: incomplete, fields, page, button });
  });
  if (allowed.has('works')) {
    const updates = (Array.isArray(data.workUpdates) ? data.workUpdates : []).filter((item) => inPeriod(item, context.period));
    const incomplete = updates.filter((row) => !row?.workId || !iso(row?.date) || !text(row?.title)).length;
    if (incomplete) results.push({ label: 'Atualizações de obra', count: incomplete, fields: ['obra', 'data', 'título'], page: 'works', button: 'Abrir Obras' });
  }
  return results;
}

function duplicateGroups(context) {
  const definitions = [
    ['payments', 'Pagamento', 'employeeId', 'value', 'financial', 'Abrir Financeiro'],
    ['advances', 'Vale', 'employeeId', 'value', 'financial', 'Abrir Financeiro'],
    ['discounts', 'Desconto', 'employeeId', 'value', 'financial', 'Abrir Financeiro'],
    ['receipts', 'Recebimento', 'workId', 'value', 'financial', 'Abrir Financeiro'],
    ['fuel', 'Combustível', 'vehicleId', 'total', 'vehicles', 'Abrir Veículos'],
    ['maintenance', 'Manutenção', 'vehicleId', 'value', 'vehicles', 'Abrir Veículos'],
    ['tow', 'Guincho', 'vehicleId', 'value', 'vehicles', 'Abrir Veículos'],
    ['licenses', 'Licenciamento', 'vehicleId', 'value', 'vehicles', 'Abrir Veículos']
  ];
  const duplicates = [];
  definitions.forEach(([collection, label, ownerField, amountField, page, button]) => {
    const groups = new Map();
    (context.collections[collection] || []).forEach((row) => {
      const owner = text(row?.[ownerField], 120), date = iso(row?.date), amount = number(row?.[amountField] ?? row?.value);
      if (!owner || !date || amount <= 0) return;
      const key = `${owner}|${date}|${amount.toFixed(2)}`;
      const current = groups.get(key) || { collection, label, owner, date, amount, ids: [], page, button };
      current.ids.push(text(row.id, 120));
      groups.set(key, current);
    });
    groups.forEach((group) => { if (group.ids.length > 1) duplicates.push(group); });
  });
  return duplicates.slice(0, 20);
}

function cloneAndFreeze(value) {
  if (Array.isArray(value)) { value.forEach(cloneAndFreeze); return Object.freeze(value); }
  if (value && typeof value === 'object') { Object.values(value).forEach(cloneAndFreeze); return Object.freeze(value); }
  return value;
}

export function buildInsightPreview({ data = {}, allowedModules = [], period, company = {}, generatedAt = new Date().toISOString() } = {}) {
  const safeModules = [...new Set(allowedModules)].filter((module) => MODULE_SET.has(module));
  const currentPeriod = period?.from && period?.to ? period : resolveAnalysisPeriod({ kind: 'current_month' }, data.settings || {});
  const priorPeriod = previousPeriod(currentPeriod);
  const current = analysisFor(data, safeModules, currentPeriod);
  const previous = analysisFor(data, safeModules, priorPeriod);
  const tracking = workTrackingFacts(data, safeModules, currentPeriod);
  const currentVehicleByWork = vehicleByWork(current.context);
  const ruleAccess = allowedRules(safeModules);
  const alerts = [];
  const checks = [];
  const rule = (type) => ruleAccess.find((item) => item.type === type);
  const restricted = (definition) => { checks.push(check(definition, 'restricted', 0, 'O perfil atual não possui acesso a todas as fontes necessárias.')); };

  const spendingRule = rule('spending_increase');
  if (!spendingRule.allowed) restricted(spendingRule);
  else {
    const currentSpend = (current.facts.works || []).reduce((sum, item) => sum + number(item.labor), 0) + number(current.facts.vehicles?.total);
    const previousSpend = (previous.facts.works || []).reduce((sum, item) => sum + number(item.labor), 0) + number(previous.facts.vehicles?.total);
    const increase = previousSpend > 0 ? ((currentSpend - previousSpend) / previousSpend) * 100 : 0;
    if (previousSpend <= 0) checks.push(check(spendingRule, 'insufficient', 0, 'Não existem informações suficientes no período anterior para confirmar aumento.'));
    else if (currentSpend >= previousSpend * 1.3 && currentSpend - previousSpend >= 100) {
      alerts.push(alertItem({ type: spendingRule.type, title: 'Possível aumento anormal de gastos', message: 'Os dados indicam aumento de pelo menos 30% nas despesas consultadas em comparação ao período anterior equivalente. Recomenda-se verificar os lançamentos e o contexto das obras.', evidence: [evidence('Gasto consultado no período', money(currentSpend), 'mão de obra confirmada + despesas de veículos'), evidence('Período anterior equivalente', money(previousSpend), 'mesma quantidade de dias imediatamente anterior'), evidence('Variação calculada', percent(increase), '(atual − anterior) ÷ anterior')], target: target('financial', 'Abrir Financeiro'), confidence: 'medium', period: currentPeriod }));
      checks.push(check(spendingRule, 'alert', 1, 'Variação acima da regra objetiva de 30% e R$ 100,00.'));
    } else checks.push(check(spendingRule, 'clear', 0, 'Nenhum aumento acima da regra objetiva foi encontrado.'));
  }

  const pendingRule = rule('pending_payment');
  if (!pendingRule.allowed) restricted(pendingRule);
  else {
    const paymentPeriod = resolveAnalysisPeriod({ kind: 'current_cycle' }, data.settings || {});
    const payment = analysisFor(data, pendingRule.modules, paymentPeriod).facts.payments;
    if (!payment?.calendarConfigured || !payment?.rows?.length) checks.push(check(pendingRule, 'insufficient', 0, 'Não existem informações suficientes para confirmar o saldo do ciclo atual.'));
    else if (number(payment.totals?.balance) > 0.009) {
      const people = payment.rows.filter((row) => number(row.balance) > 0.009);
      alerts.push(alertItem({ type: pendingRule.type, title: 'Pagamento pendente no ciclo atual', message: 'Os dados indicam saldo líquido pendente no ciclo. Recomenda-se verificar a área de pagamentos antes de marcar qualquer valor como pago.', evidence: [evidence('Saldo líquido pendente', money(payment.totals.balance), 'diárias confirmadas − vales − descontos − pagamentos registrados'), evidence('Funcionários com saldo', String(people.length), 'contagem de saldos individuais acima de zero'), evidence('Ciclo consultado', paymentPeriod.label, `${paymentPeriod.from} a ${paymentPeriod.to}`)], target: target('financial', 'Abrir Pagamentos da equipe'), confidence: 'high', period: paymentPeriod }));
      checks.push(check(pendingRule, 'alert', 1));
    } else checks.push(check(pendingRule, 'clear'));
  }

  const absenceRule = rule('frequent_absences');
  if (!absenceRule.allowed) restricted(absenceRule);
  else {
    const frequent = (current.facts.attendance?.absentEmployees || []).filter((item) => number(item.count) >= 3);
    frequent.slice(0, 12).forEach((item) => alerts.push(alertItem({ type: absenceRule.type, entityId: item.employeeId, title: 'Faltas frequentes no período', message: 'Os dados indicam três ou mais registros de falta para este funcionário no período. Recomenda-se verificar as presenças e a escala antes de qualquer conclusão.', evidence: [evidence('Funcionário', item.name), evidence('Faltas registradas', String(item.count), 'contagem de status Faltou/Ausência'), evidence('Datas encontradas', (item.dates || []).slice(0, 8).join(', ') || 'Datas não disponíveis')], target: target('attendance', 'Abrir Presença', item.employeeId), confidence: 'high', period: currentPeriod })));
    checks.push(check(absenceRule, frequent.length ? 'alert' : (current.facts.attendance?.records ? 'clear' : 'insufficient'), frequent.length, current.facts.attendance?.records ? 'Regra: três ou mais faltas no período.' : 'Não existem presenças suficientes para confirmar.'));
  }

  const highSpendRule = rule('high_spend_low_progress');
  if (!highSpendRule.allowed) restricted(highSpendRule);
  else {
    const spendRows = (current.facts.works || []).map((item) => ({ ...item, spend: number(item.labor) + number(currentVehicleByWork.get(item.workId)), tracking: tracking.get(item.workId) })).filter((item) => item.spend > 0);
    const typical = median(spendRows.map((item) => item.spend));
    const candidates = spendRows.filter((item) => spendRows.length >= 2 && item.spend >= typical * 1.5 && item.tracking?.progress != null && item.tracking.progress <= 35);
    candidates.slice(0, 10).forEach((item) => alerts.push(alertItem({ type: highSpendRule.type, entityId: item.workId, title: 'Obra com gasto alto e pouco avanço informado', message: 'Os dados indicam gasto consultado acima do valor típico entre as obras e avanço médio informado de até 35%. Recomenda-se verificar; isso não confirma atraso nem prejuízo.', evidence: [evidence('Obra', item.name), evidence('Gasto consultado', money(item.spend), 'mão de obra confirmada + veículo vinculado'), evidence('Mediana entre obras', money(typical)), evidence('Avanço médio informado', percent(item.tracking.progress), 'média simples dos percentuais das fases cadastradas')], target: target('works', 'Abrir acompanhamento da obra', item.workId), confidence: 'medium', period: currentPeriod })));
    const hasProgress = spendRows.some((item) => item.tracking?.progress != null);
    checks.push(check(highSpendRule, candidates.length ? 'alert' : (spendRows.length >= 2 && hasProgress ? 'clear' : 'insufficient'), candidates.length, hasProgress ? 'Comparação pela mediana de gastos e avanço médio das fases.' : 'Não existem fases e gastos suficientes para confirmar.'));
  }

  const differenceRule = rule('received_vs_spent');
  if (!differenceRule.allowed) restricted(differenceRule);
  else {
    const negative = (current.facts.works || []).map((item) => ({ ...item, vehicle: number(currentVehicleByWork.get(item.workId)), difference: number(item.received) - number(item.labor) - number(currentVehicleByWork.get(item.workId)) })).filter((item) => item.difference < -0.009 && (number(item.received) || number(item.labor) || item.vehicle));
    negative.slice(0, 12).forEach((item) => alerts.push(alertItem({ type: differenceRule.type, entityId: item.workId, title: 'Despesas consultadas acima do recebido', message: 'Os dados indicam que, no período, os recebimentos registrados ficaram abaixo da mão de obra e dos veículos vinculados. Recomenda-se verificar; este indicador não representa o lucro ou prejuízo total da obra.', evidence: [evidence('Obra', item.name), evidence('Recebido no período', money(item.received)), evidence('Mão de obra confirmada', money(item.labor)), evidence('Veículos vinculados', money(item.vehicle)), evidence('Diferença consultada', money(item.difference), 'recebido − mão de obra − veículos')], target: target('financial', 'Abrir Financeiro da obra', item.workId), confidence: 'medium', period: currentPeriod })));
    const hasMovement = (current.facts.works || []).some((item) => number(item.received) || number(item.labor));
    checks.push(check(differenceRule, negative.length ? 'alert' : (hasMovement ? 'clear' : 'insufficient'), negative.length, hasMovement ? 'Comparação limitada às fontes descritas.' : 'Não existem recebimentos e gastos suficientes para confirmar.'));
  }

  const performanceRule = rule('performance_drop');
  if (!performanceRule.allowed) restricted(performanceRule);
  else {
    const currentRatios = employeeRatios(current.context), previousRatios = employeeRatios(previous.context), drops = [];
    currentRatios.forEach((row, employeeId) => {
      const prior = previousRatios.get(employeeId);
      if (!prior || row.records < 3 || prior.records < 3) return;
      const currentRate = row.worked / row.records, previousRate = prior.worked / prior.records;
      if (previousRate - currentRate >= 0.25) drops.push({ ...row, previousRate, currentRate });
    });
    drops.slice(0, 12).forEach((item) => alerts.push(alertItem({ type: performanceRule.type, entityId: item.employeeId, title: 'Possível queda de regularidade na presença', message: 'Os dados indicam redução de pelo menos 25 pontos percentuais na proporção de diárias trabalhadas em relação ao período anterior. Recomenda-se verificar; isso não altera nem substitui a pontuação oficial de desempenho.', evidence: [evidence('Funcionário', item.name), evidence('Período atual', percent(item.currentRate * 100), `${item.worked} diária(s) equivalente(s) em ${item.records} registro(s)`), evidence('Período anterior', percent(item.previousRate * 100), 'período equivalente imediatamente anterior'), evidence('Variação', percent((item.currentRate - item.previousRate) * 100), 'atual − anterior')], target: target('attendance', 'Abrir Presença', item.employeeId), confidence: 'medium', period: currentPeriod })));
    const comparable = [...currentRatios.values()].some((row) => row.records >= 3 && (previousRatios.get(row.employeeId)?.records || 0) >= 3);
    checks.push(check(performanceRule, drops.length ? 'alert' : (comparable ? 'clear' : 'insufficient'), drops.length, comparable ? 'A pontuação oficial não foi recalculada.' : 'Não existem pelo menos três registros em ambos os períodos para confirmar.'));
  }

  const vehicleRule = rule('high_vehicle_spend');
  if (!vehicleRule.allowed) restricted(vehicleRule);
  else {
    const vehicles = (current.facts.vehicles?.vehicles || []).filter((item) => number(item.total) > 0), typical = median(vehicles.map((item) => item.total));
    const high = vehicles.filter((item) => vehicles.length >= 2 && number(item.total) >= typical * 1.5 && number(item.total) - typical >= 100);
    high.slice(0, 10).forEach((item) => alerts.push(alertItem({ type: vehicleRule.type, entityId: item.vehicleId, title: 'Possível gasto elevado com veículo', message: 'Os dados indicam gasto pelo menos 50% acima da mediana dos veículos no período. Recomenda-se verificar os lançamentos e o uso do veículo.', evidence: [evidence('Veículo', item.name), evidence('Gasto registrado', money(item.total), `${item.entries} lançamento(s)`), evidence('Mediana dos veículos', money(typical)), evidence('Diferença para a mediana', money(number(item.total) - typical))], target: target('vehicles', 'Abrir Veículos', item.vehicleId), confidence: 'medium', period: currentPeriod })));
    checks.push(check(vehicleRule, high.length ? 'alert' : (vehicles.length >= 2 ? 'clear' : 'insufficient'), high.length, vehicles.length >= 2 ? 'Regra: 50% e R$ 100,00 acima da mediana.' : 'Não existem dois veículos com gastos para comparar.'));
  }

  const incompleteRule = rule('incomplete_records');
  const incomplete = incompleteRecords(data, current.context, safeModules);
  incomplete.slice(0, 12).forEach((item) => alerts.push(alertItem({ type: incompleteRule.type, entityId: item.label, severity: 'info', title: 'Possível registro incompleto', message: 'Os dados indicam registros com campos essenciais vazios no período. Recomenda-se verificar a área correspondente; nenhuma informação foi alterada automaticamente.', evidence: [evidence('Tipo de registro', item.label), evidence('Quantidade encontrada', String(item.count)), evidence('Campos verificados', item.fields.join(', '))], target: target(item.page, item.button), confidence: 'high', period: currentPeriod })));
  const inspectedRecords = (current.context.sources || []).reduce((sum, source) => sum + number(source.count), 0) + ((Array.isArray(data.workUpdates) && safeModules.includes('works')) ? data.workUpdates.filter((item) => inPeriod(item, currentPeriod)).length : 0);
  checks.push(check(incompleteRule, incomplete.length ? 'alert' : (inspectedRecords ? 'clear' : 'insufficient'), incomplete.reduce((sum, item) => sum + item.count, 0), inspectedRecords ? 'Somente campos essenciais das fontes autorizadas foram verificados.' : 'Não existem registros no período para verificar.'));

  const staleRule = rule('stale_work_update');
  if (!staleRule.allowed) restricted(staleRule);
  else {
    const cutoff = addDays(currentPeriod.to, -14), trackable = [...tracking.values()].filter((item) => item.active && item.lastUpdate), stale = trackable.filter((item) => item.lastUpdate < cutoff);
    stale.slice(0, 12).forEach((item) => alerts.push(alertItem({ type: staleRule.type, entityId: item.workId, severity: 'info', title: 'Obra sem atualização recente', message: 'Os dados indicam mais de 14 dias desde a última atualização encontrada no acompanhamento da obra. Recomenda-se verificar se há informação recente ainda não registrada.', evidence: [evidence('Obra', item.name), evidence('Última atualização encontrada', item.lastUpdate), evidence('Limite da verificação', cutoff, '14 dias antes do fim do período')], target: target('works', 'Abrir acompanhamento da obra', item.workId), confidence: 'high', period: currentPeriod })));
    checks.push(check(staleRule, stale.length ? 'alert' : (trackable.length ? 'clear' : 'insufficient'), stale.length, trackable.length ? 'Foram consideradas datas do cadastro, atualizações e fotos.' : 'Não existem datas suficientes para confirmar atualização recente.'));
  }

  const duplicateRule = rule('possible_duplicate');
  const duplicates = duplicateGroups(current.context);
  duplicates.forEach((item) => alerts.push(alertItem({ type: duplicateRule.type, entityId: `${item.collection}-${item.owner}-${item.date}-${item.amount}`, title: 'Possível lançamento duplicado', message: 'Possível inconsistência: foram encontrados lançamentos com o mesmo responsável, data e valor. Recomenda-se verificar antes de excluir ou corrigir qualquer registro.', evidence: [evidence('Tipo', item.label), evidence('Data', item.date), evidence('Valor', money(item.amount)), evidence('Registros iguais', String(item.ids.length), 'mesmo identificador relacionado + data + valor')], target: target(item.page, item.button), confidence: 'medium', period: currentPeriod })));
  checks.push(check(duplicateRule, duplicates.length ? 'alert' : (inspectedRecords ? 'clear' : 'insufficient'), duplicates.length, duplicates.length ? 'A igualdade não confirma duplicidade; exige conferência humana.' : 'Nenhuma chave exata repetida foi encontrada.'));

  const attention = alerts.filter((item) => item.severity === 'attention').length;
  const info = alerts.filter((item) => item.severity === 'info').length;
  const summary = Object.freeze({ total: alerts.length, attention, info, clear: checks.filter((item) => item.status === 'clear').length, insufficient: checks.filter((item) => item.status === 'insufficient').length, restricted: checks.filter((item) => item.status === 'restricted').length });
  return cloneAndFreeze({
    phase: 4,
    automatic: true,
    readOnly: true,
    generatedAt: text(generatedAt, 40),
    company: { id: text(company.id, 120), name: text(company.name || 'Empresa atual', 160) },
    period: { kind: text(currentPeriod.kind, 40), label: text(currentPeriod.label, 100), from: iso(currentPeriod.from), to: iso(currentPeriod.to) },
    previousPeriod: priorPeriod,
    summary,
    alerts: alerts.slice(0, 60),
    checkedRules: checks,
    warnings: [
      'Os alertas são associações automáticas e não confirmam erro, culpa, atraso, lucro ou prejuízo.',
      'Nenhum dado foi alterado, salvo, corrigido, excluído, enviado ou publicado por esta análise.',
      'Os botões apenas abrem a área correspondente para conferência manual.'
    ]
  });
}

export function validateInsightPreview(preview) {
  if (!preview || preview.phase !== 4 || preview.readOnly !== true || preview.automatic !== true) throw new Error('Prévia de alertas inválida.');
  if (!Array.isArray(preview.alerts) || !Array.isArray(preview.checkedRules)) throw new Error('Estrutura de alertas inválida.');
  preview.alerts.forEach((item) => {
    if (!item.type || !item.title || !item.message || !item.evidence?.length || !item.target?.page || !item.target?.label) throw new Error('Alerta sem evidência ou caminho de conferência.');
    if (!/^(Os dados indicam|Recomenda-se verificar|Possível inconsistência)/.test(item.message)) throw new Error('Alerta fora da linguagem cuidadosa exigida.');
  });
  return preview;
}
