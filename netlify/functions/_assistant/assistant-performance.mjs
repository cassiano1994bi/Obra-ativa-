import EmployeePerformance from '../../../public-assets/employee-performance-v1.js';

const CRITERIA_LABELS = Object.freeze({
  efficiency: 'Eficiência financeira',
  positive: 'Participação em resultados positivos',
  regularity: 'Regularidade',
  consistency: 'Consistência',
  evolution: 'Evolução histórica'
});

const iso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10)) ? String(value).slice(0, 10) : '';
const finite = (value) => Number.isFinite(Number(value));
const number = (value) => finite(value) ? Number(value) : 0;
const money = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
const cleanText = (value, max = 400) => String(value == null ? '' : value)
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

function inRange(value, range) {
  const date = iso(value);
  return Boolean(date && date >= range.from && date <= range.to);
}

function progressForWork(data, workId) {
  const phases = (data.workPhases || []).filter((item) => item?.workId === workId);
  if (!phases.length) return { percent: null, phaseCount: 0 };
  const values = phases.map((item) => Math.max(0, Math.min(100, number(item.percent))));
  return { percent: values.reduce((sum, value) => sum + value, 0) / values.length, phaseCount: phases.length };
}

function measuredForWork(data, workId, range) {
  return money((data.workClosings || [])
    .filter((item) => item?.workId === workId)
    .filter((item) => inRange(item.closedDate || item.date || item.expectedDate, range))
    .reduce((sum, item) => sum + number(item.value), 0));
}

function buildCriteria(row, weights) {
  return Object.entries(weights).map(([key, weight]) => {
    const raw = row.criteria?.[key];
    return Object.freeze({
      key,
      label: CRITERIA_LABELS[key] || key,
      weight,
      available: Number.isFinite(raw),
      normalized: Number.isFinite(raw) ? raw : null,
      points: Number.isFinite(raw) ? raw * weight : null
    });
  });
}

function qualityFor(row, permissions) {
  const missing = [];
  if (row.workedUnits < EmployeePerformance.MIN_WORKED_UNITS) missing.push(`menos de ${EmployeePerformance.MIN_WORKED_UNITS} diárias no período`);
  if (row.financialObservations < EmployeePerformance.MIN_FINANCIAL_OBSERVATIONS) missing.push(`menos de ${EmployeePerformance.MIN_FINANCIAL_OBSERVATIONS} observações financeiras`);
  if (row.regularitySource !== 'escala e presença') missing.push('escala diária comparável');
  if (row.unassignedUnits > 0) missing.push(`${row.unassignedUnits} diária(s) sem obra atribuída`);
  if (row.ambiguousDays > 0) missing.push(`${row.ambiguousDays} dia(s) com atribuição conflitante`);
  if (!permissions.financial) missing.push('módulo financeiro não autorizado para esta análise');
  if (!permissions.vehicles) missing.push('gastos de veículos não autorizados para esta análise');
  return Object.freeze({
    confidence: row.scoreConfidence,
    coverage: row.dataCoverage,
    financialObservations: row.financialObservations,
    missing: Object.freeze([...new Set(missing)]),
    unassignedUnits: row.unassignedUnits,
    ambiguousDays: row.ambiguousDays
  });
}

function explanationFor(row, criteria, works, quality) {
  const available = criteria.filter((item) => item.available);
  const strongest = available.slice().sort((left, right) => right.points - left.points)[0];
  const weakest = available.slice().sort((left, right) => left.points - right.points)[0];
  const financialWorks = works.filter((item) => item.financialComplete);
  const incompleteWorks = works.filter((item) => !item.financialComplete);
  const scoreLabel = row.sufficient ? 'nota oficial completa' : row.rankable ? 'nota oficial provisória' : 'pontuação ainda indisponível';
  const scoreValue = row.rankable ? ` de ${Math.round(row.displayScore)} em 100` : '';
  const summary = `${cleanText(row.employee.name, 140)} tem ${scoreLabel}${scoreValue}, calculada exclusivamente pela fórmula oficial. Trabalhou ${row.workedUnits} diária(s) em ${row.workCount} obra(s) no período.`;
  const evidence = [];
  if (strongest) evidence.push(`O critério com maior contribuição disponível foi ${strongest.label}, com ${strongest.points.toFixed(1)} ponto(s) de um peso máximo de ${strongest.weight}.`);
  if (weakest && weakest.key !== strongest?.key) evidence.push(`O menor valor entre os critérios disponíveis foi ${weakest.label}, com ${weakest.points.toFixed(1)} ponto(s) de um peso máximo de ${weakest.weight}.`);
  if (financialWorks.length) evidence.push(`${financialWorks.length} obra(s) possuem recebimento efetivo e dados financeiros utilizáveis no período.`);
  if (incompleteWorks.length) evidence.push(`${incompleteWorks.length} obra(s) ficaram fora dos critérios financeiros por falta ou possível duplicidade de recebimento; isso não foi transformado em zero.`);
  if (row.trend === 'dados insuficientes') evidence.push('Ainda não existe histórico comparável suficiente para afirmar tendência de evolução.');
  else evidence.push(`A tendência estatística disponível está classificada como “${cleanText(row.trend, 40)}”.`);
  const recommendations = [];
  if (quality.missing.length) recommendations.push('Conferir os registros listados como ausentes antes de usar a leitura para qualquer decisão de gestão.');
  if (row.unassignedUnits > 0 || row.ambiguousDays > 0) recommendations.push('Revisar a obra atribuída às presenças indicadas, sem apagar ou substituir os registros originais.');
  if (!financialWorks.length) recommendations.push('Aguardar ou conferir recebimentos efetivamente registrados; previsão de contrato não substitui recebimento real.');
  if (!recommendations.length) recommendations.push('Usar a explicação como apoio e confirmar o contexto com o responsável pela obra antes de decidir qualquer ação.');
  return Object.freeze({
    summary,
    evidence: Object.freeze(evidence),
    recommendations: Object.freeze(recommendations),
    safeguards: Object.freeze([
      'A Assistente não criou nem alterou a pontuação: a nota veio diretamente da fórmula oficial do módulo Desempenho dos Funcionários.',
      'Resultado associado é uma distribuição estatística proporcional à participação nas obras; não significa que a pessoa causou lucro, prejuízo, atraso ou avanço.',
      'Correlação, comparação e tendência não provam responsabilidade individual. A decisão final continua humana.',
      'Nenhum dado foi criado, corrigido, salvo, excluído ou publicado por esta análise.'
    ])
  });
}

export function sanitizePerformanceData(data = {}, allowedModules = []) {
  const allowed = new Set(allowedModules);
  return {
    employees: allowed.has('team') && Array.isArray(data.employees) ? data.employees : [],
    attendance: allowed.has('attendance') && Array.isArray(data.attendance) ? data.attendance : [],
    distributions: allowed.has('planning') && Array.isArray(data.distributions) ? data.distributions : [],
    works: allowed.has('works') && Array.isArray(data.works) ? data.works : [],
    workPhases: allowed.has('works') && Array.isArray(data.workPhases) ? data.workPhases : [],
    receipts: allowed.has('financial') && Array.isArray(data.receipts) ? data.receipts : [],
    workClosings: allowed.has('financial') && Array.isArray(data.workClosings) ? data.workClosings : [],
    receivables: allowed.has('financial') && Array.isArray(data.receivables) ? data.receivables : [],
    fuel: allowed.has('vehicles') && Array.isArray(data.fuel) ? data.fuel : [],
    maintenance: allowed.has('vehicles') && Array.isArray(data.maintenance) ? data.maintenance : [],
    tow: allowed.has('vehicles') && Array.isArray(data.tow) ? data.tow : [],
    payments: []
  };
}

export function buildEmployeePerformanceExplanation({ data = {}, allowedModules = [], filters = {}, employeeId = '' } = {}) {
  const required = ['team', 'attendance', 'planning', 'works'];
  const missingPermissions = required.filter((module) => !allowedModules.includes(module));
  if (missingPermissions.length) {
    const error = new Error('Você não possui todas as permissões necessárias para cruzar equipe, presença, escala e obras.');
    error.code = 'PERFORMANCE_PERMISSION_DENIED';
    throw error;
  }
  const sanitized = sanitizePerformanceData(data, allowedModules);
  const model = EmployeePerformance.calculate(sanitized, filters);
  const row = model.rows.find((item) => String(item.employee.id) === String(employeeId));
  if (!row) {
    const error = new Error('Funcionário não encontrado entre os dados autorizados desta empresa.');
    error.code = 'EMPLOYEE_NOT_FOUND';
    throw error;
  }
  const permissions = Object.freeze({
    financial: allowedModules.includes('financial'),
    vehicles: allowedModules.includes('vehicles')
  });
  const criteria = buildCriteria(row, model.weights);
  const works = row.contributions.map((item) => {
    const progress = progressForWork(sanitized, item.work.id);
    return Object.freeze({
      id: cleanText(item.work.id, 120),
      name: cleanText(item.work.name || 'Obra sem identificação', 180),
      workedUnits: item.units,
      participation: item.participation,
      laborCost: money(item.cost),
      received: item.financialComplete ? money(item.received) : null,
      measured: permissions.financial ? measuredForWork(sanitized, item.work.id, model.range) : null,
      expenses: item.financialComplete ? money(item.expenses) : null,
      workResult: item.financialComplete ? money(item.workResult) : null,
      associatedResult: item.financialComplete ? money(item.associatedResult) : null,
      financialComplete: item.financialComplete,
      financialIssue: cleanText(item.financialIssue, 180),
      progressPercent: Number.isFinite(progress.percent) ? progress.percent : null,
      phaseCount: progress.phaseCount
    });
  });
  const quality = qualityFor(row, permissions);
  const history = EmployeePerformance.historyForEmployee(sanitized, filters, employeeId, 6).map((item) => Object.freeze({
    from: item.range.from,
    to: item.range.to,
    score: item.score,
    workedUnits: item.workedUnits,
    associatedResult: money(item.associatedResult)
  }));
  return Object.freeze({
    phase: 5,
    readOnly: true,
    officialFormulaPreserved: true,
    employee: Object.freeze({ id: cleanText(row.employee.id, 120), name: cleanText(row.employee.name, 180), role: cleanText(row.role, 120), group: cleanText(row.group, 30) }),
    period: Object.freeze({ from: model.range.from, to: model.range.to, label: cleanText(model.range.label, 160), kind: model.range.kind }),
    official: Object.freeze({
      score: row.score,
      provisionalScore: row.provisionalScore,
      displayScore: row.displayScore,
      sufficient: row.sufficient,
      rankable: row.rankable,
      band: Object.freeze({ ...row.band }),
      automaticRank: row.automaticRank,
      automaticRoleRank: row.automaticRoleRank,
      workedUnits: row.workedUnits,
      absences: row.absences,
      regularity: row.regularity,
      trend: row.trend,
      evolutionDelta: row.evolutionDelta,
      workCount: row.workCount,
      laborCost: money(row.contributions.reduce((sum, item) => sum + item.cost, 0)),
      associatedResult: row.completeContributions.length ? money(row.associatedResult) : null,
      insufficiencyReason: cleanText(row.insufficiencyReason, 700),
      criteria: Object.freeze(criteria)
    }),
    works: Object.freeze(works),
    history: Object.freeze(history),
    quality,
    explanation: explanationFor(row, criteria, works, quality)
  });
}

export function validateEmployeePerformanceExplanation(value) {
  if (!value || value.phase !== 5 || value.readOnly !== true || value.officialFormulaPreserved !== true) throw new Error('Explicação de desempenho inválida.');
  if (!value.employee?.id || !value.period?.from || !value.period?.to || !value.official || !value.explanation) throw new Error('Explicação de desempenho incompleta.');
  if (value.official.rankable && !Number.isFinite(value.official.displayScore)) throw new Error('Pontuação oficial inválida.');
  return value;
}
