import { buildDeterministicAnalysis } from './assistant-tools.mjs';

export const REPORT_DEFINITIONS = Object.freeze({
  daily: Object.freeze({ label: 'Relatório diário', modules: ['works', 'team', 'planning', 'attendance', 'payments', 'financial', 'vehicles'], defaultPeriod: 'today' }),
  weekly: Object.freeze({ label: 'Relatório semanal', modules: ['works', 'team', 'planning', 'attendance', 'payments', 'financial', 'vehicles'], defaultPeriod: 'current_week' }),
  fortnightly: Object.freeze({ label: 'Relatório quinzenal', modules: ['works', 'team', 'planning', 'attendance', 'payments', 'financial', 'vehicles'], defaultPeriod: 'current_fortnight' }),
  financial: Object.freeze({ label: 'Resumo financeiro', modules: ['works', 'team', 'planning', 'attendance', 'payments', 'financial', 'vehicles'], defaultPeriod: 'current_month' }),
  payments: Object.freeze({ label: 'Resumo de pagamentos', modules: ['team', 'attendance', 'payments'], defaultPeriod: 'current_cycle' }),
  work: Object.freeze({ label: 'Resumo por obra', modules: ['works', 'team', 'planning', 'attendance', 'financial'], defaultPeriod: 'current_month', target: 'work' }),
  team: Object.freeze({ label: 'Relatório de equipe', modules: ['works', 'team', 'planning', 'attendance'], defaultPeriod: 'current_month' }),
  employee: Object.freeze({ label: 'Relatório de funcionário', modules: ['works', 'team', 'planning', 'attendance'], defaultPeriod: 'current_month', target: 'employee' }),
  vehicles: Object.freeze({ label: 'Relatório de veículos', modules: ['vehicles'], defaultPeriod: 'current_month' }),
  performance: Object.freeze({ label: 'Relatório de desempenho', modules: ['works', 'team', 'planning', 'attendance'], defaultPeriod: 'current_month' })
});

const SOURCE_LABELS = Object.freeze({
  works: 'obras', employees: 'funcionários', distributions: 'escala', cycles: 'ciclos', attendance: 'presenças',
  advances: 'vales', discounts: 'descontos', payments: 'pagamentos', receivables: 'previsões de recebimento',
  receipts: 'recebimentos', workClosings: 'fechamentos', vehicles: 'veículos', fuel: 'combustível',
  maintenance: 'manutenções', tow: 'guinchos', licenses: 'licenciamentos', reports: 'relatórios'
});

function text(value, maxLength = 300) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function numeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const prepared = raw.includes(',') ? raw.replace(/[^\d,\-]/g, '').replace(/\./g, '').replace(',', '.') : raw.replace(/[^\d.\-]/g, '');
  const result = Number(prepared);
  return Number.isFinite(result) ? result : 0;
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numeric(value));
}

function statusFactor(status) {
  const value = text(status).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (value === 'trabalhou') return 1;
  if (value === 'meio periodo') return 0.5;
  return 0;
}

function sourceSummary(context) {
  return (context?.sources || []).map((source) => ({
    name: SOURCE_LABELS[source.name] || text(source.name, 80),
    source: text(source.name, 80),
    count: Math.max(0, Math.floor(Number(source.count || 0)))
  }));
}

function selectedWorks(collections, targetWorkId = '') {
  const dimensions = new Map((collections.works || []).map((work) => [work.id, work]));
  const activityIds = new Set();
  ['attendance', 'distributions', 'payments', 'advances', 'discounts', 'receipts', 'workClosings', 'fuel', 'maintenance', 'tow', 'licenses'].forEach((name) => {
    (collections[name] || []).forEach((item) => { if (item?.workId) activityIds.add(item.workId); });
  });
  if (targetWorkId) activityIds.add(targetWorkId);
  return [...activityIds].map((id) => ({ id, name: text(dimensions.get(id)?.name || 'Obra sem identificação', 160) }))
    .filter((work) => !targetWorkId || work.id === targetWorkId)
    .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
}

function employeeDetail(collections, targetEmployeeId) {
  const employee = (collections.employees || []).find((item) => item.id === targetEmployeeId);
  if (!employee) return null;
  const attendance = (collections.attendance || []).filter((item) => item.employeeId === targetEmployeeId);
  const workIds = [...new Set([
    ...attendance.map((item) => item.workId),
    ...(collections.distributions || []).filter((item) => item.employeeId === targetEmployeeId).map((item) => item.workId)
  ].filter(Boolean))];
  return {
    id: employee.id,
    name: text(employee.name || 'Funcionário sem identificação', 160),
    role: text(employee.role || 'Função não informada', 120),
    records: attendance.length,
    workedUnits: attendance.reduce((sum, item) => sum + statusFactor(item.status), 0),
    absences: attendance.filter((item) => /falt|ausenc/i.test(text(item.status).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))).length,
    workIds
  };
}

function reportFacts(context, period, settings) {
  const plan = { intent: 'general', deniedModules: [], selectedModules: context.allowedModules || [] };
  return buildDeterministicAnalysis({ plan, context, period, settings }).facts;
}

function attentionFromFacts({ facts, missingData }) {
  const points = [];
  if (missingData.length) points.push({ level: 'info', title: 'Dados ausentes', detail: 'Há fontes sem registros no período. As conclusões foram limitadas ao que está disponível.' });
  if (facts.attendance?.absences > 0) points.push({ level: 'attention', title: 'Faltas registradas', detail: `Os dados indicam ${facts.attendance.absences} falta(s) no período. Recomenda-se conferir os registros.` });
  if (facts.workDiagnostics?.conflicts > 0) points.push({ level: 'attention', title: 'Possível inconsistência de obra', detail: `${facts.workDiagnostics.conflicts} diária(s) possuem conflito de atribuição e foram excluídas do total por obra.` });
  if (facts.workDiagnostics?.unassigned > 0) points.push({ level: 'info', title: 'Presenças sem obra', detail: `${facts.workDiagnostics.unassigned} diária(s) não possuem obra atribuída e não entraram no total por obra.` });
  const negative = (facts.works || []).filter((item) => item.result < 0 && item.labor > 0);
  if (negative.length) points.push({ level: 'attention', title: 'Recebimentos menores que a mão de obra', detail: `Os dados indicam ${negative.length} obra(s) nessa condição no período. Isso não confirma prejuízo total.` });
  if (facts.payments?.totals?.balance > 0) points.push({ level: 'attention', title: 'Pagamento pendente', detail: `O saldo líquido calculado no ciclo é ${money(facts.payments.totals.balance)}.` });
  return points.slice(0, 12);
}

function recommendationsFromFacts({ facts, missingData, type }) {
  const recommendations = [];
  if (missingData.length) recommendations.push('Completar os registros ausentes antes de tomar decisões definitivas.');
  if (facts.workDiagnostics?.conflicts) recommendations.push('Revisar as presenças com mais de uma obra atribuída no mesmo dia.');
  if (facts.workDiagnostics?.unassigned) recommendations.push('Vincular as presenças sem obra para melhorar o resumo por obra.');
  if (facts.attendance?.absences) recommendations.push('Conferir as faltas registradas e a escala correspondente.');
  if (facts.payments?.totals?.balance > 0) recommendations.push('Conferir o saldo do ciclo na área Pagamentos antes de marcar qualquer valor como pago.');
  if (type === 'financial') recommendations.push('Avaliar outros custos antes de interpretar o resultado como lucro ou prejuízo.');
  if (!recommendations.length) recommendations.push('Manter os registros atualizados para preservar a qualidade das próximas análises.');
  return [...new Set(recommendations)].slice(0, 10);
}

function baseNumbers(facts) {
  return [
    { label: 'Presenças registradas', value: String(facts.attendance?.records || 0), formula: 'contagem dos registros de presença no período' },
    { label: 'Diárias equivalentes', value: String(facts.attendance?.workedUnits || 0), formula: 'Trabalhou = 1; Meio período = 0,5' },
    { label: 'Faltas registradas', value: String(facts.attendance?.absences || 0), formula: 'contagem dos status Faltou/Ausência' }
  ];
}

function financialNumbers(facts) {
  const works = facts.works || [];
  const received = works.reduce((sum, item) => sum + numeric(item.received), 0);
  const labor = works.reduce((sum, item) => sum + numeric(item.labor), 0);
  const vehicles = numeric(facts.vehicles?.total);
  return {
    received, labor, vehicles, operational: received - labor,
    rows: [
      { label: 'Recebimentos registrados', value: money(received), formula: 'soma dos recebimentos vinculados às obras no período' },
      { label: 'Mão de obra confirmada', value: money(labor), formula: 'diárias confirmadas × valor vigente, sem duplicar funcionário/data' },
      { label: 'Diferença operacional consultada', value: money(received - labor), formula: 'recebimentos registrados − mão de obra confirmada' },
      { label: 'Despesas de veículos', value: money(vehicles), formula: 'combustível + manutenção + guincho + licenciamento' }
    ]
  };
}

function executiveContent(type, facts, works, employee) {
  const financial = financialNumbers(facts);
  if (type === 'financial') return { summary: `No período, foram encontrados ${money(financial.received)} em recebimentos vinculados às obras e ${money(financial.labor)} em mão de obra confirmada. A diferença consultada é ${money(financial.operational)} e não representa o lucro total.`, numbers: financial.rows };
  if (type === 'payments') {
    const totals = facts.payments?.totals;
    if (!totals) return { summary: 'O ciclo de pagamento não pôde ser calculado com os dados disponíveis.', numbers: [] };
    return { summary: `O ciclo possui líquido de ${money(totals.net)}, ${money(totals.paid)} já registrado como pago e saldo de ${money(totals.balance)}.`, numbers: [
      { label: 'Bruto', value: money(totals.gross), formula: 'soma das diárias confirmadas' },
      { label: 'Vales', value: money(totals.advances), formula: 'soma dos vales do ciclo' },
      { label: 'Descontos', value: money(totals.discounts), formula: 'soma dos descontos do ciclo' },
      { label: 'Saldo líquido', value: money(totals.balance), formula: 'bruto − vales − descontos − pagamentos registrados' }
    ] };
  }
  if (type === 'work') {
    const selected = targetWorkFacts(facts, works);
    return { summary: selected.length ? `Foram analisadas ${selected.length} obra(s), com ${money(selected.reduce((sum, item) => sum + item.received, 0))} recebidos e ${money(selected.reduce((sum, item) => sum + item.labor, 0))} de mão de obra confirmada.` : 'Não foram encontradas movimentações da obra no período.', numbers: selected.flatMap((item) => [
      { label: `${item.name} · recebido`, value: money(item.received), formula: 'recebimentos registrados no período' },
      { label: `${item.name} · mão de obra`, value: money(item.labor), formula: 'diárias confirmadas vinculadas à obra' },
      { label: `${item.name} · diferença`, value: money(item.result), formula: 'recebimentos − mão de obra' }
    ]).slice(0, 30) };
  }
  if (type === 'vehicles') return { summary: `Foram encontrados ${facts.vehicles?.entries || 0} lançamento(s) de veículos, totalizando ${money(facts.vehicles?.total || 0)}.`, numbers: (facts.vehicles?.vehicles || []).map((item) => ({ label: item.name, value: money(item.total), formula: `${item.entries} lançamento(s)` })).slice(0, 20) };
  if (type === 'employee') return { summary: employee ? `${employee.name} possui ${employee.records} registro(s), ${employee.workedUnits} diária(s) equivalente(s) e ${employee.absences} falta(s) no período. A análise não atribui lucro ou prejuízo da obra ao funcionário.` : 'O funcionário selecionado não foi encontrado nas fontes autorizadas.', numbers: employee ? [
    { label: 'Registros de presença', value: String(employee.records), formula: 'contagem no período' },
    { label: 'Diárias equivalentes', value: String(employee.workedUnits), formula: 'Trabalhou = 1; Meio período = 0,5' },
    { label: 'Faltas registradas', value: String(employee.absences), formula: 'contagem de Faltou/Ausência' },
    { label: 'Obras relacionadas', value: String(employee.workIds.length), formula: 'obras presentes na escala ou presença' }
  ] : [] };
  if (type === 'performance') return { summary: `O período contém ${facts.attendance?.records || 0} registro(s), ${facts.attendance?.workedUnits || 0} diária(s) equivalente(s) e ${facts.attendance?.absences || 0} falta(s). Este relatório explica tendências e não substitui a pontuação oficial de desempenho.`, numbers: baseNumbers(facts) };
  if (type === 'team') return { summary: `A equipe possui ${facts.attendance?.records || 0} registro(s), equivalentes a ${facts.attendance?.workedUnits || 0} diária(s), com ${facts.attendance?.absences || 0} falta(s) no período.`, numbers: baseNumbers(facts) };
  return { summary: `No período foram encontrados ${facts.attendance?.records || 0} registro(s) de presença, ${works.length} obra(s) com movimentação e ${facts.vehicles?.entries || 0} despesa(s) de veículos.`, numbers: [...baseNumbers(facts), ...financial.rows.slice(0, 2)] };
}

function targetWorkFacts(facts, works) {
  const ids = new Set(works.map((work) => work.id));
  return (facts.works || []).filter((item) => ids.has(item.workId));
}

export function reportDefinition(type) {
  return REPORT_DEFINITIONS[String(type || '')] || null;
}

export function allowedReportTypes(allowedModules = []) {
  const allowed = new Set(allowedModules);
  return Object.entries(REPORT_DEFINITIONS).filter(([, definition]) => definition.modules.every((module) => allowed.has(module))).map(([type, definition]) => ({ type, label: definition.label, defaultPeriod: definition.defaultPeriod, target: definition.target || '' }));
}

export function buildReportPreview({ type, context, period, company = {}, targetId = '', generatedAt = new Date().toISOString(), settings = {} } = {}) {
  const definition = reportDefinition(type);
  if (!definition) throw new TypeError('Tipo de relatório inválido.');
  const collections = context?.collections || {};
  const facts = reportFacts(context, period, settings);
  const works = selectedWorks(collections, definition.target === 'work' ? targetId : '');
  const employee = definition.target === 'employee' ? employeeDetail(collections, targetId) : null;
  const sources = sourceSummary(context);
  const missingData = sources.filter((source) => source.count === 0).map((source) => `Sem registros de ${source.name} no período`);
  if (!text(company.name)) missingData.push('Nome da empresa não informado');
  if (definition.target === 'work' && !targetId) missingData.push('Obra não selecionada');
  if (definition.target === 'employee' && !targetId) missingData.push('Funcionário não selecionado');
  if (definition.target === 'employee' && targetId && !employee) missingData.push('Funcionário não encontrado nas fontes autorizadas');
  if (!works.length && definition.modules.includes('works')) missingData.push('Sem obra com movimentação no período');
  if (type === 'payments' && !facts.payments) missingData.push('Ciclo de pagamento não configurado ou sem dados suficientes');
  const uniqueMissing = [...new Set(missingData)].slice(0, 30);
  const executive = executiveContent(type, facts, works, employee);
  const recordsFound = sources.reduce((sum, source) => sum + source.count, 0);
  const dataFound = sources.filter((source) => source.count > 0).map((source) => ({ label: source.name, value: `${source.count} registro(s)` }));
  if (employee) dataFound.unshift({ label: 'Funcionário analisado', value: `${employee.name} · ${employee.role}` });
  return {
    phase: 3,
    preview: true,
    readOnly: true,
    type,
    title: definition.label,
    generatedAt: text(generatedAt, 40),
    period: { label: text(period?.label, 120), from: text(period?.from, 10), to: text(period?.to, 10) },
    company: { id: text(company.id, 80), name: text(company.name || 'Empresa atual', 160) },
    worksAnalyzed: works.slice(0, 100),
    dataFound: dataFound.slice(0, 30),
    missingData: uniqueMissing,
    executiveSummary: executive.summary,
    attentionPoints: attentionFromFacts({ facts, missingData: uniqueMissing }),
    recommendations: recommendationsFromFacts({ facts, missingData: uniqueMissing, type }),
    numbers: executive.numbers.slice(0, 40),
    sources,
    confidence: recordsFound === 0 ? 'low' : uniqueMissing.length ? 'medium' : 'high',
    warnings: [
      'Prévia somente leitura: nada foi salvo, enviado ou publicado.',
      ...(type === 'financial' || type === 'work' ? ['A diferença entre recebimentos e mão de obra não representa o lucro total da obra.'] : []),
      ...(type === 'performance' || type === 'employee' ? ['Correlação não significa responsabilidade individual por lucro ou prejuízo.'] : [])
    ]
  };
}

function list(value, mapper, maxItems = 100) {
  return Array.isArray(value) ? value.slice(0, maxItems).map(mapper).filter(Boolean) : [];
}

export function validateReportPreview(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('A prévia do relatório precisa ser estruturada.');
  const title = text(value.title, 160);
  const executiveSummary = text(value.executiveSummary, 6000);
  if (!title || !executiveSummary) throw new TypeError('A prévia do relatório está incompleta.');
  return Object.freeze({
    phase: 3, preview: true, readOnly: true, type: text(value.type, 40), title,
    generatedAt: text(value.generatedAt, 40),
    period: Object.freeze({ label: text(value.period?.label, 120), from: text(value.period?.from, 10), to: text(value.period?.to, 10) }),
    company: Object.freeze({ id: text(value.company?.id, 80), name: text(value.company?.name || 'Empresa atual', 160) }),
    worksAnalyzed: Object.freeze(list(value.worksAnalyzed, (item) => Object.freeze({ id: text(item?.id, 120), name: text(item?.name, 160) }), 100)),
    dataFound: Object.freeze(list(value.dataFound, (item) => Object.freeze({ label: text(item?.label, 120), value: text(item?.value, 200) }), 30)),
    missingData: Object.freeze(list(value.missingData, (item) => text(item, 300), 30)),
    executiveSummary,
    attentionPoints: Object.freeze(list(value.attentionPoints, (item) => Object.freeze({ level: ['info', 'attention', 'critical'].includes(item?.level) ? item.level : 'info', title: text(item?.title, 160), detail: text(item?.detail, 1000) }), 20)),
    recommendations: Object.freeze(list(value.recommendations, (item) => text(item, 500), 20)),
    numbers: Object.freeze(list(value.numbers, (item) => Object.freeze({ label: text(item?.label, 180), value: text(item?.value, 160), formula: text(item?.formula, 500) }), 40)),
    sources: Object.freeze(list(value.sources, (item) => Object.freeze({ name: text(item?.name, 100), source: text(item?.source, 100), count: Math.max(0, Math.floor(Number(item?.count || 0))) }), 40)),
    confidence: ['low', 'medium', 'high'].includes(value.confidence) ? value.confidence : 'low',
    warnings: Object.freeze(list(value.warnings, (item) => text(item, 500), 20))
  });
}
