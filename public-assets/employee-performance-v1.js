(function employeePerformanceModule(root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }
  root.EmployeePerformance = api;
  api.install();
})(typeof window !== 'undefined' ? window : null, function employeePerformanceFactory(root) {
  'use strict';

  /*
   * DESEMPENHO DOS FUNCIONÁRIOS — FÓRMULA E FONTES
   *
   * Este módulo é exclusivamente de leitura. Ele não chama save(), não grava no
   * localStorage e não cria coleções. Todos os resultados são recalculados a partir
   * do objeto db já isolado para a empresa ativa.
   *
   * Fontes existentes:
   * - Funcionários, função, grupo e histórico de diária: db.employees.
   * - Presença e falta registrada: db.attendance.
   * - Obra de cada dia: workId da presença; na ausência dele, db.distributions.
   * - Obras: db.works.
   * - Recebimentos efetivos: db.receipts e workClosings[].receipts, pelas datas.
   * - Gastos: custo da diária confirmada pela presença mais db.fuel,
   *   db.maintenance e db.tow vinculados à obra e ao período.
   * - db.payments não é somado novamente ao gasto da obra: ele quita a mesma mão
   *   de obra já calculada pela presença e sua soma duplicaria o custo.
   * - workClosings[].value e receivables[].total são contrato/previsão e NUNCA são
   *   considerados dinheiro recebido.
   *
   * Resultado da obra no período = recebimentos efetivos - gastos registrados.
   * Participação = diárias do funcionário / diárias totais da obra no período.
   * Resultado associado = resultado da obra * participação. É associação
   * proporcional, nunca atribuição causal de lucro ou prejuízo ao funcionário.
   *
   * Pontuação base (0 a 100):
   * 1. Eficiência financeira (40): média de duas normalizações robustas por função:
   *    resultado associado/custo e resultado associado/diária. Se a função não
   *    tiver dois comparáveis, usa-se a equipe geral. Percentis 10 e 90 limitam
   *    extremos. Assim, diária menor sozinha não determina a nota.
   * 2. Participação positiva (20): proporção ponderada das diárias em obras com
   *    resultado positivo e recebimento registrado. Resultado exatamente zero é
   *    neutro (0,5), não negativo.
   * 3. Regularidade (15): presença registrada sobre dias avaliáveis da escala.
   *    Dias da escala sem presença são informação ausente, não falta. Sem escala,
   *    o critério fica indisponível. O sistema atual não classifica falta
   *    justificada; portanto nenhuma justificativa é inventada.
   * 4. Consistência (15): 70% de obras positivas + 30% de diversificação do
   *    resultado entre pelo menos duas obras completas, evitando domínio de uma só.
   * 5. Evolução (10): diferença da nota-base para o período anterior de igual
   *    duração. Sem período anterior, o critério fica indisponível.
   *
   * Normalização e dados ausentes:
   * - Valor ausente nunca vira zero. O peso indisponível é redistribuído apenas
   *   entre critérios calculáveis.
   * - Obra sem recebimento efetivo é mostrada como período financeiro incompleto e
   *   não entra nos critérios financeiros, evitando punir trabalho sem medição paga.
   * - Antes da nota, critérios observados são retraídos para o ponto neutro de
   *   acordo com o volume de evidência. Poucos dados não geram extremos artificiais.
   * - Todo funcionário com presença trabalhada no período recebe automaticamente
   *   uma nota provisória calculada apenas com os critérios realmente disponíveis.
   *   A cobertura dos critérios aproxima notas parciais do ponto neutro, evitando
   *   que um único indicador incompleto produza um extremo artificial.
   * - Nota definitiva exige 5 diárias no período, duas observações financeiras
   *   (obras completas no período atual ou no imediatamente anterior), escala
   *   comparável à presença e os quatro critérios principais calculáveis.
   *   Evolução pode ficar indisponível. A classificação provisória nunca transforma
   *   informação ausente em zero e não exige avaliação manual.
   * - Encarregados e mestres de obras não entram no ranking comparativo. Seus
   *   registros continuam preservados e compondo os totais operacionais da obra.
   * - Precisão completa é mantida nos cálculos; arredondamento ocorre só na tela.
   */

  const WEIGHTS = Object.freeze({ efficiency: 40, positive: 20, regularity: 15, consistency: 15, evolution: 10 });
  const MIN_WORKED_UNITS = 5;
  const MIN_FINANCIAL_OBSERVATIONS = 2;
  const PRESENT_UNITS = Object.freeze({ Trabalhou: 1, 'Meio período': 0.5, Atraso: 1 });
  const RANKING_EXCLUDED_ROLES = new Set([
    'encarregado', 'encarregados',
    'encarregado de obra', 'encarregado de obras',
    'encarregados de obra', 'encarregados de obras',
    'mestre de obra', 'mestre de obras',
    'mestres de obra', 'mestres de obras'
  ]);

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const money = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, Number(value)));
  const iso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  const asDate = (value) => new Date(`${value}T12:00:00Z`);
  const dateIso = (date) => date.toISOString().slice(0, 10);
  const shiftDate = (value, days) => { const date = asDate(value); date.setUTCDate(date.getUTCDate() + days); return dateIso(date); };
  const daysBetween = (from, to) => Math.max(1, Math.round((asDate(to) - asDate(from)) / 86400000) + 1);
  const html = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number(value));
  const decimal = (value, digits = 1) => number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits });
  const displayDate = (value) => value ? asDate(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
  const normalizedRole = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
  const isRankingExcludedRole = (value) => RANKING_EXCLUDED_ROLES.has(normalizedRole(value));

  function endOfMonth(value) {
    const date = asDate(value);
    return dateIso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)));
  }

  function resolveRange(filters = {}) {
    const current = iso(filters.today) || new Date().toISOString().slice(0, 10);
    if (filters.range === 'custom') {
      let from = iso(filters.from) || current;
      let to = iso(filters.to) || current;
      if (from > to) [from, to] = [to, from];
      return { from, to, label: `${displayDate(from)} a ${displayDate(to)}`, kind: 'custom' };
    }
    if (filters.range === 'month') {
      const from = `${current.slice(0, 7)}-01`;
      const to = current < endOfMonth(current) ? current : endOfMonth(current);
      return { from, to, label: `Mês atual · ${displayDate(from)} a ${displayDate(to)}`, kind: 'month' };
    }
    const day = Number(current.slice(8));
    const from = `${current.slice(0, 7)}-${day <= 15 ? '01' : '16'}`;
    return { from, to: current, label: `Quinzena atual · ${displayDate(from)} a ${displayDate(current)}`, kind: 'fortnight' };
  }

  function previousRange(range) {
    const length = daysBetween(range.from, range.to);
    const to = shiftDate(range.from, -1);
    const from = shiftDate(to, -(length - 1));
    return { from, to, label: `${displayDate(from)} a ${displayDate(to)}`, kind: 'custom' };
  }

  function inRange(date, range) {
    return Boolean(iso(date) && date >= range.from && date <= range.to);
  }

  function valueAtHistory(employee, date, historyKey, currentKey, historyValueKey) {
    const history = Array.isArray(employee?.[historyKey]) ? employee[historyKey] : [];
    const fallback = { date: employee?.startDate || '1900-01-01', [historyValueKey]: employee?.[currentKey] };
    return [...history, fallback]
      .filter((item) => iso(item.date) && item.date <= date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]?.[historyValueKey] ?? employee?.[currentKey];
  }

  const dailyAtDate = (employee, date) => number(valueAtHistory(employee, date, 'rateHistory', 'daily', 'value'));
  const groupAtDate = (employee, date) => String(valueAtHistory(employee, date, 'groupHistory', 'group', 'group') || employee?.group || '');

  function effectiveAttendanceRows(data, range, workFilter = '') {
    const employees = new Map((data.employees || []).filter((employee) => employee && !employee.archived).map((employee) => [employee.id, employee]));
    const works = new Map((data.works || []).filter(Boolean).map((work) => [work.id, work]));
    const attendanceInRange = (data.attendance || []).filter((item) => item && inRange(item.date, range) && employees.has(item.employeeId));
    const distributionRows = (data.distributions || []).filter((item) => item && inRange(item.date, range));
    const distributions = new Map();
    distributionRows.forEach((item) => distributions.set(`${item.employeeId}|${item.date}`, item));
    const selected = new Map();
    attendanceInRange.forEach((item) => {
      const key = `${item.employeeId}|${item.date}`;
      const previous = selected.get(key);
      const itemGlobal = !item.workId;
      const previousGlobal = previous && !previous.workId;
      const itemStamp = String(item.updatedAt || item.createdAt || item.registeredAt || '');
      const previousStamp = String(previous?.updatedAt || previous?.createdAt || previous?.registeredAt || '');
      if (!previous || (itemGlobal && !previousGlobal) || (itemGlobal === previousGlobal && itemStamp >= previousStamp)) selected.set(key, item);
    });
    return [...selected.values()].map((attendance) => {
      const employee = employees.get(attendance.employeeId);
      const key = `${attendance.employeeId}|${attendance.date}`;
      const explicitWorkIds = new Set(attendanceInRange.filter((item) => `${item.employeeId}|${item.date}` === key && item.workId).map((item) => item.workId));
      const plannedWorkIds = new Set(distributionRows.filter((item) => `${item.employeeId}|${item.date}` === key && item.workId).map((item) => item.workId));
      const linked = attendanceInRange.find((item) => `${item.employeeId}|${item.date}` === key && item.workId);
      const planned = distributions.get(`${attendance.employeeId}|${attendance.date}`);
      const ambiguousAssignment = explicitWorkIds.size > 1 || (!explicitWorkIds.size && plannedWorkIds.size > 1);
      const workId = ambiguousAssignment ? '' : attendance.workId || linked?.workId || planned?.workId || '';
      const work = works.get(workId) || null;
      const units = number(PRESENT_UNITS[attendance.status]);
      return {
        employee,
        attendance,
        date: attendance.date,
        workId,
        work,
        units,
        daily: dailyAtDate(employee, attendance.date),
        laborCost: money(dailyAtDate(employee, attendance.date) * units),
        present: units > 0,
        absence: attendance.status === 'Faltou',
        planned: Boolean(planned),
        ambiguousAssignment
      };
    }).filter((row) => !workFilter || row.workId === workFilter);
  }

  function actualReceipts(data, workId, range) {
    const rows = [];
    (data.receipts || []).filter((item) => item?.workId === workId && inRange(item.date, range)).forEach((item) => rows.push({ source: 'Recebimento registrado', sourceType: 'legacy', id: item.id, date: item.date, value: money(item.value) }));
    (data.workClosings || []).filter((closing) => closing?.workId === workId).forEach((closing) => {
      (closing.receipts || []).filter((item) => inRange(item.date, range)).forEach((item) => rows.push({ source: 'Recebimento de medição', sourceType: 'closing', id: item.id, date: item.date, value: money(item.value) }));
    });
    return rows;
  }

  function expenseTotal(list, workId, range, valueKey) {
    return money((list || []).filter((item) => item?.workId === workId && inRange(item.date, range)).reduce((sum, item) => sum + number(item[valueKey]), 0));
  }

  function workFinancialRows(data, attendanceRows, range, workFilter = '') {
    // Obra arquivada continua sendo uma fonte histórica válida.
    const works = (data.works || []).filter((work) => work && (!workFilter || work.id === workFilter));
    return works.map((work) => {
      const laborRows = attendanceRows.filter((row) => row.workId === work.id && row.present);
      const labor = money(laborRows.reduce((sum, row) => sum + row.laborCost, 0));
      const fuel = expenseTotal(data.fuel, work.id, range, 'total');
      const maintenance = expenseTotal(data.maintenance, work.id, range, 'value');
      const tow = expenseTotal(data.tow, work.id, range, 'value');
      const receipts = actualReceipts(data, work.id, range);
      const received = money(receipts.reduce((sum, item) => sum + item.value, 0));
      const expenses = money(labor + fuel + maintenance + tow);
      const totalUnits = laborRows.reduce((sum, row) => sum + row.units, 0);
      const fingerprints = new Map();
      receipts.forEach((item) => {
        const fingerprint = `${item.date}|${Math.round(item.value * 100)}`;
        const sources = fingerprints.get(fingerprint) || new Set();
        sources.add(item.sourceType);
        fingerprints.set(fingerprint, sources);
      });
      const possibleDuplicateReceipt = [...fingerprints.values()].some((sources) => sources.size > 1);
      return {
        work,
        receipts,
        received,
        labor,
        fuel,
        maintenance,
        tow,
        expenses,
        result: money(received - expenses),
        totalUnits,
        possibleDuplicateReceipt,
        financialComplete: receipts.length > 0 && !possibleDuplicateReceipt,
        financialIssue: !receipts.length ? 'sem recebimento no período' : possibleDuplicateReceipt ? 'possível recebimento duplicado entre fontes' : ''
      };
    });
  }

  function scheduledKeysFor(data, employeeId, range, workFilter = '') {
    return new Set((data.distributions || []).filter((item) => item?.employeeId === employeeId && inRange(item.date, range) && (!workFilter || item.workId === workFilter)).map((item) => item.date));
  }

  function buildSnapshot(data, range, workFilter = '') {
    const attendanceRows = effectiveAttendanceRows(data, range, workFilter);
    const workRows = workFinancialRows(data, attendanceRows, range, workFilter);
    const workMap = new Map(workRows.map((row) => [row.work.id, row]));
    const employees = (data.employees || []).filter((employee) => employee && !employee.archived && !isRankingExcludedRole(employee.role));
    const metrics = employees.map((employee) => {
      const own = attendanceRows.filter((row) => row.employee.id === employee.id);
      const workedUnits = own.reduce((sum, row) => sum + row.units, 0);
      const absences = own.filter((row) => row.absence).length;
      const unassignedUnits = own.filter((row) => row.present && !row.work && !row.ambiguousAssignment).reduce((sum, row) => sum + row.units, 0);
      const ambiguousDays = own.filter((row) => row.present && row.ambiguousAssignment).length;
      const plannedKeys = scheduledKeysFor(data, employee.id, range, workFilter);
      const evaluable = plannedKeys.size
        ? own.filter((row) => (row.present || row.absence) && plannedKeys.has(row.date))
        : [];
      const regularityDenominator = evaluable.length;
      const regularity = regularityDenominator ? clamp(evaluable.reduce((sum, row) => sum + row.units, 0) / regularityDenominator) : null;
      const unknownScheduledDays = plannedKeys.size ? Math.max(0, plannedKeys.size - new Set(evaluable.map((row) => row.date)).size) : 0;
      const byWork = new Map();
      own.filter((row) => row.present && row.work).forEach((row) => {
        const item = byWork.get(row.workId) || { work: row.work, units: 0, cost: 0 };
        item.units += row.units;
        item.cost += row.laborCost;
        byWork.set(row.workId, item);
      });
      const contributions = [...byWork.entries()].map(([workId, ownWork]) => {
        const financial = workMap.get(workId);
        const participation = financial?.totalUnits > 0 ? ownWork.units / financial.totalUnits : 0;
        return {
          work: ownWork.work,
          units: ownWork.units,
          cost: ownWork.cost,
          participation,
          received: financial?.received || 0,
          expenses: financial?.expenses || 0,
          workResult: financial?.result || 0,
          associatedResult: financial?.financialComplete ? financial.result * participation : null,
          financialComplete: Boolean(financial?.financialComplete),
          receiptCount: financial?.receipts.length || 0,
          financialIssue: financial?.financialIssue || ''
        };
      });
      const complete = contributions.filter((item) => item.financialComplete);
      const associatedResult = complete.reduce((sum, item) => sum + item.associatedResult, 0);
      const financialUnits = complete.reduce((sum, item) => sum + item.units, 0);
      const financialCost = complete.reduce((sum, item) => sum + item.cost, 0);
      const positiveUnits = complete.reduce((sum, item) => sum + item.units * (item.workResult > 0 ? 1 : item.workResult === 0 ? 0.5 : 0), 0);
      const absoluteResults = complete.map((item) => Math.abs(number(item.associatedResult)));
      const absoluteTotal = absoluteResults.reduce((sum, value) => sum + value, 0);
      const positiveShare = complete.length ? complete.filter((item) => item.workResult > 0).length / complete.length : null;
      let diversification = null;
      if (complete.length >= 2) {
        if (!absoluteTotal) diversification = 1;
        else {
          const concentration = Math.max(...absoluteResults) / absoluteTotal;
          diversification = clamp((1 - concentration) / (1 - 1 / complete.length));
        }
      }
      return {
        employee,
        group: groupAtDate(employee, range.to),
        role: String(employee.role || 'Função não informada'),
        workedUnits,
        absences,
        unassignedUnits,
        ambiguousDays,
        regularity,
        regularitySource: plannedKeys.size ? 'escala e presença' : 'sem escala suficiente',
        scheduledDays: plannedKeys.size,
        unknownScheduledDays,
        contributions,
        completeContributions: complete,
        workCount: contributions.length,
        associatedResult,
        financialUnits,
        financialCost,
        roi: financialCost > 0 ? associatedResult / financialCost : null,
        associatedPerDay: financialUnits > 0 ? associatedResult / financialUnits : null,
        positiveRate: financialUnits > 0 ? positiveUnits / financialUnits : null,
        consistency: complete.length >= 2 ? clamp(number(positiveShare) * 0.7 + number(diversification) * 0.3) : null
      };
    });
    return { range, attendanceRows, workRows, metrics };
  }

  function quantile(sorted, ratio) {
    if (!sorted.length) return null;
    const position = (sorted.length - 1) * ratio;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  }

  function normalizedValue(rows, metric, key) {
    const ownRole = rows.filter((row) => row.role === metric.role && Number.isFinite(row[key]));
    const all = rows.filter((row) => Number.isFinite(row[key]));
    const cohort = ownRole.length >= 2 ? ownRole : all;
    if (!Number.isFinite(metric[key]) || !cohort.length) return { value: null, scope: 'sem comparação', cohortSize: 0 };
    const values = cohort.map((row) => row[key]).sort((a, b) => a - b);
    const low = quantile(values, 0.1);
    const high = quantile(values, 0.9);
    return {
      value: high === low ? 0.5 : clamp((metric[key] - low) / (high - low)),
      scope: ownRole.length >= 2 ? `mesma função (${metric.role})` : 'equipe geral',
      cohortSize: cohort.length
    };
  }

  function weightedAverage(criteria, includeEvolution = true) {
    const entries = Object.entries(criteria).filter(([key, value]) => (includeEvolution || key !== 'evolution') && Number.isFinite(value) && WEIGHTS[key]);
    const weight = entries.reduce((sum, [key]) => sum + WEIGHTS[key], 0);
    return weight ? entries.reduce((sum, [key, value]) => sum + value * WEIGHTS[key], 0) / weight : null;
  }

  function preliminaryScores(snapshot) {
    return new Map(snapshot.metrics.map((metric) => {
      const roi = normalizedValue(snapshot.metrics, metric, 'roi');
      const perDay = normalizedValue(snapshot.metrics, metric, 'associatedPerDay');
      const efficiencyParts = [roi.value, perDay.value].filter(Number.isFinite);
      const financialConfidence = Math.min(1, metric.financialUnits / 10)
        * Math.min(1, metric.completeContributions.length / 3)
        * Math.min(1, Math.max(0, Math.max(roi.cohortSize, perDay.cohortSize) - 1) / 4);
      const outcomeConfidence = Math.min(1, metric.financialUnits / 10) * Math.min(1, metric.completeContributions.length / 3);
      const scheduleConfidence = Math.min(1, metric.scheduledDays / 10);
      const consistencyConfidence = Math.sqrt(Math.min(1, metric.completeContributions.length / 6) * Math.min(1, metric.completeContributions.length / 3));
      const shrink = (value, confidence) => Number.isFinite(value) ? clamp(0.5 + (value - 0.5) * confidence) : null;
      const observedEfficiency = efficiencyParts.length ? efficiencyParts.reduce((sum, value) => sum + value, 0) / efficiencyParts.length : null;
      const criteria = {
        efficiency: shrink(observedEfficiency, financialConfidence),
        positive: shrink(metric.positiveRate, outcomeConfidence),
        regularity: shrink(metric.regularity, scheduleConfidence),
        consistency: shrink(metric.consistency, consistencyConfidence)
      };
      return [metric.employee.id, { criteria, base: weightedAverage(criteria, false), comparisonScope: roi.scope === perDay.scope ? roi.scope : `${roi.scope} / ${perDay.scope}` }];
    }));
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function historicalBaseSeries(snapshots) {
    const byEmployee = new Map();
    [...snapshots].reverse().forEach((snapshot, periodIndex) => {
      const scores = preliminaryScores(snapshot);
      snapshot.metrics.forEach((metric) => {
        const preliminary = scores.get(metric.employee.id);
        const mainAvailable = ['efficiency', 'positive', 'regularity', 'consistency'].every((key) => Number.isFinite(preliminary?.criteria?.[key]));
        if (metric.workedUnits < MIN_WORKED_UNITS || metric.completeContributions.length < MIN_FINANCIAL_OBSERVATIONS || !mainAvailable || !Number.isFinite(preliminary.base)) return;
        const rows = byEmployee.get(metric.employee.id) || [];
        rows.push({ periodIndex, base: preliminary.base, range: snapshot.range });
        byEmployee.set(metric.employee.id, rows);
      });
    });
    return byEmployee;
  }

  function theilSenTrend(series) {
    if (!series || series.length < 2) return { evolution: null, slopePoints: null, status: 'dados insuficientes' };
    const slopes = [];
    for (let i = 0; i < series.length; i += 1) {
      for (let j = i + 1; j < series.length; j += 1) {
        const distance = series[j].periodIndex - series[i].periodIndex;
        if (distance > 0) slopes.push((series[j].base - series[i].base) / distance);
      }
    }
    const slope = median(slopes);
    if (!Number.isFinite(slope)) return { evolution: null, slopePoints: null, status: 'dados insuficientes' };
    const confidence = Math.min(1, (series.length - 1) / 4);
    const observed = clamp(0.5 + 2 * slope);
    const evolution = clamp(0.5 + (observed - 0.5) * confidence);
    const slopePoints = slope * 100;
    return { evolution, slopePoints, status: slopePoints >= 2 ? 'melhorando' : slopePoints <= -2 ? 'caindo' : 'estável' };
  }

  function performanceBand(score) {
    if (!Number.isFinite(score)) return { key: 'insufficient', label: 'Dados insuficientes', color: 'neutro' };
    if (score >= 85) return { key: 'excellent', label: 'Desempenho excelente', color: 'verde' };
    if (score >= 70) return { key: 'very-good', label: 'Desempenho muito bom', color: 'azul' };
    if (score >= 55) return { key: 'regular', label: 'Desempenho regular', color: 'amarelo' };
    if (score >= 40) return { key: 'attention', label: 'Atenção', color: 'laranja' };
    return { key: 'below', label: 'Desempenho abaixo do esperado', color: 'vermelho' };
  }

  function calculate(data, filters = {}) {
    const range = resolveRange(filters);
    const previous = previousRange(range);
    const currentSnapshot = buildSnapshot(data, range, filters.workId || '');
    const previousSnapshot = buildSnapshot(data, previous, filters.workId || '');
    const currentPreliminary = preliminaryScores(currentSnapshot);
    const previousPreliminary = preliminaryScores(previousSnapshot);
    const previousMetrics = new Map(previousSnapshot.metrics.map((metric) => [metric.employee.id, metric]));
    const trendSnapshots = [currentSnapshot, previousSnapshot];
    let trendCursor = previous;
    for (let index = 2; index < 6; index += 1) {
      trendCursor = previousRange(trendCursor);
      trendSnapshots.push(buildSnapshot(data, trendCursor, filters.workId || ''));
    }
    const trendSeries = historicalBaseSeries(trendSnapshots);
    const rows = currentSnapshot.metrics.map((metric) => {
      const preliminary = currentPreliminary.get(metric.employee.id);
      const priorMetric = previousMetrics.get(metric.employee.id);
      const evidence = metric.completeContributions.length + (priorMetric?.completeContributions.length || 0);
      const combinedContributions = [...metric.completeContributions, ...(priorMetric?.completeContributions || [])];
      let consistency = preliminary?.criteria?.consistency;
      if (!Number.isFinite(consistency) && combinedContributions.length >= 2) {
        const positiveShare = combinedContributions.reduce((sum, item) => sum + (item.workResult > 0 ? 1 : item.workResult === 0 ? 0.5 : 0), 0) / combinedContributions.length;
        const absolute = combinedContributions.map((item) => Math.abs(number(item.associatedResult)));
        const absoluteTotal = absolute.reduce((sum, value) => sum + value, 0);
        const concentration = absoluteTotal ? Math.max(...absolute) / absoluteTotal : 1 / combinedContributions.length;
        const diversification = absoluteTotal ? clamp((1 - concentration) / (1 - 1 / combinedContributions.length)) : 1;
        const observed = clamp(positiveShare * 0.7 + diversification * 0.3);
        const confidence = Math.sqrt(Math.min(1, combinedContributions.length / 6) * Math.min(1, new Set(combinedContributions.map((item) => item.work.id)).size / 3));
        consistency = clamp(0.5 + (observed - 0.5) * confidence);
      }
      const historicalTrend = theilSenTrend(trendSeries.get(metric.employee.id));
      const evolution = historicalTrend.evolution;
      const evolutionDelta = historicalTrend.slopePoints;
      const criteria = { ...preliminary.criteria, consistency, evolution };
      const principalCriteriaAvailable = ['efficiency', 'positive', 'regularity', 'consistency'].every((key) => Number.isFinite(criteria[key]));
      const scaleComparable = metric.regularitySource === 'escala e presença';
      const sufficient = metric.workedUnits >= MIN_WORKED_UNITS && evidence >= MIN_FINANCIAL_OBSERVATIONS && principalCriteriaAvailable && scaleComparable;
      const availableCriteria = Object.entries(criteria).filter(([key, value]) => WEIGHTS[key] && Number.isFinite(value));
      const availableWeight = availableCriteria.reduce((sum, [key]) => sum + WEIGHTS[key], 0);
      const dataCoverage = availableWeight / Object.values(WEIGHTS).reduce((sum, value) => sum + value, 0);
      const rawAutomaticScore = weightedAverage(criteria, true);
      const attendanceEvidence = metric.workedUnits + metric.absences;
      const attendanceRate = attendanceEvidence > 0 ? metric.workedUnits / attendanceEvidence : null;
      const attendanceConfidence = Math.min(1, attendanceEvidence / MIN_WORKED_UNITS);
      const attendanceFallback = Number.isFinite(attendanceRate)
        ? clamp(0.5 + (attendanceRate - 0.5) * attendanceConfidence)
        : null;
      const provisionalBase = Number.isFinite(rawAutomaticScore) ? rawAutomaticScore : attendanceFallback;
      const rankable = attendanceEvidence > 0 && Number.isFinite(provisionalBase);
      const score = sufficient ? rawAutomaticScore * 100 : null;
      const provisionalScore = !sufficient && rankable
        ? provisionalBase * 100
        : null;
      const displayScore = Number.isFinite(score) ? score : provisionalScore;
      const trend = historicalTrend.status;
      const missing = [];
      if (metric.workedUnits < MIN_WORKED_UNITS) missing.push(`menos de ${MIN_WORKED_UNITS} diárias`);
      if (evidence < MIN_FINANCIAL_OBSERVATIONS) missing.push(`menos de ${MIN_FINANCIAL_OBSERVATIONS} observações financeiras`);
      if (!Number.isFinite(criteria.efficiency) || !Number.isFinite(criteria.positive)) missing.push('recebimento financeiro no período');
      if (!scaleComparable) missing.push('escala diária comparável');
      if (!Number.isFinite(criteria.consistency)) missing.push('histórico em mais obras ou períodos');
      return {
        ...metric,
        criteria,
        score,
        provisionalScore,
        displayScore,
        band: sufficient ? performanceBand(score) : rankable ? { key: 'provisional', label: 'Nota automática provisória', color: 'neutro' } : performanceBand(null),
        sufficient,
        rankable,
        scoreConfidence: sufficient ? 'completa' : rankable ? 'provisória' : 'sem dados',
        dataCoverage,
        financialObservations: evidence,
        comparisonScope: preliminary.comparisonScope,
        evolutionDelta,
        trend,
        insufficiencyReason: sufficient ? '' : rankable
          ? `Nota automática provisória calculada somente com os dados disponíveis, sem transformar informação ausente em zero. Para virar nota completa, falta: ${missing.join(', ') || 'ampliar o histórico comparável'}.`
          : 'Ainda não há presença trabalhada no período para calcular uma nota automática.'
      };
    });
    const ranked = rows.filter((row) => row.sufficient).sort((a, b) => b.score - a.score || (b.regularity ?? -Infinity) - (a.regularity ?? -Infinity) || b.workedUnits - a.workedUnits || String(a.employee.name).localeCompare(String(b.employee.name), 'pt-BR'));
    ranked.forEach((row, index) => { row.rank = index + 1; });
    const automaticRanked = rows.filter((row) => row.rankable).sort((a, b) => Number(b.sufficient) - Number(a.sufficient) || b.displayScore - a.displayScore || (b.regularity ?? -Infinity) - (a.regularity ?? -Infinity) || b.workedUnits - a.workedUnits || String(a.employee.name).localeCompare(String(b.employee.name), 'pt-BR'));
    automaticRanked.forEach((row, index) => { row.automaticRank = index + 1; });
    rows.forEach((row) => {
      if (!row.sufficient) row.rank = null;
      if (!row.rankable) row.automaticRank = null;
      const roleRanked = ranked.filter((candidate) => candidate.role === row.role);
      const automaticRoleRanked = automaticRanked.filter((candidate) => candidate.role === row.role);
      row.roleRank = row.sufficient ? roleRanked.findIndex((candidate) => candidate.employee.id === row.employee.id) + 1 : null;
      row.automaticRoleRank = row.rankable ? automaticRoleRanked.findIndex((candidate) => candidate.employee.id === row.employee.id) + 1 : null;
    });
    return { range, previousRange: previous, snapshot: currentSnapshot, previousSnapshot, rows, ranked, automaticRanked, weights: WEIGHTS };
  }

  function filterAndSort(model, filters = {}) {
    let rows = model.rows.filter((row) => !filters.role || row.role === filters.role)
      .filter((row) => !filters.group || row.group === filters.group)
      .filter((row) => !filters.sufficientOnly || row.sufficient);
    const compare = {
      score_desc: (a, b) => (b.displayScore ?? -Infinity) - (a.displayScore ?? -Infinity),
      score_asc: (a, b) => (a.displayScore ?? Infinity) - (b.displayScore ?? Infinity),
      evolution: (a, b) => (b.evolutionDelta ?? -Infinity) - (a.evolutionDelta ?? -Infinity),
      associated: (a, b) => b.associatedResult - a.associatedResult,
      regularity: (a, b) => (b.regularity ?? -Infinity) - (a.regularity ?? -Infinity),
      days: (a, b) => b.workedUnits - a.workedUnits
    }[filters.sort] || ((a, b) => (b.displayScore ?? -Infinity) - (a.displayScore ?? -Infinity));
    return rows.sort((a, b) => {
      if (a.sufficient !== b.sufficient) return a.sufficient ? -1 : 1;
      return compare(a, b) || String(a.employee.name).localeCompare(String(b.employee.name), 'pt-BR');
    });
  }

  function historyForEmployee(data, filters, employeeId, count = 6) {
    const ranges = [];
    let cursor = resolveRange(filters);
    for (let index = 0; index < count; index += 1) { ranges.unshift(cursor); cursor = previousRange(cursor); }
    return ranges.map((range) => {
      const model = calculate(data, { ...filters, range: 'custom', from: range.from, to: range.to });
      const row = model.rows.find((item) => item.employee.id === employeeId);
      return { range, score: row?.score ?? null, workedUnits: row?.workedUnits || 0, associatedResult: row?.associatedResult || 0 };
    });
  }

  function colleagueAssociations(data, employeeId, filters = {}, minimum = 5) {
    const totals = new Map();
    let cursor = resolveRange(filters);
    for (let index = 0; index < 12; index += 1) {
      const snapshot = buildSnapshot(data, cursor, '');
      snapshot.workRows.filter((work) => work.financialComplete).forEach((work) => {
        const participantDates = (id) => new Set(snapshot.attendanceRows.filter((row) => row.employee.id === id && row.workId === work.work.id && row.present).map((row) => row.date));
        const targetDates = participantDates(employeeId);
        const participants = snapshot.metrics.filter((metric) => metric.contributions.some((item) => item.work.id === work.work.id && item.units > 0));
        if (!participants.some((metric) => metric.employee.id === employeeId)) return;
        participants.filter((metric) => metric.employee.id !== employeeId).forEach((metric) => {
          const otherDates = participantDates(metric.employee.id);
          const sharedDays = [...targetDates].filter((date) => otherDates.has(date)).length;
          if (!sharedDays) return;
          const item = totals.get(metric.employee.id) || { employee: metric.employee, together: 0, positive: 0, sharedDays: 0, works: new Set(), periods: new Set() };
          item.together += 1;
          item.sharedDays += sharedDays;
          item.works.add(work.work.id);
          item.periods.add(`${cursor.from}|${cursor.to}`);
          if (work.result > 0) item.positive += 1;
          totals.set(metric.employee.id, item);
        });
      });
      cursor = previousRange(cursor);
    }
    return [...totals.values()]
      .filter((item) => item.together >= minimum && item.sharedDays >= 5 && (item.works.size >= 2 || item.periods.size >= 2))
      .map((item) => ({ ...item, workCount: item.works.size, periodCount: item.periods.size, works: undefined, periods: undefined }))
      .sort((a, b) => b.together - a.together || b.positive - a.positive)
      .slice(0, 5);
  }

  let panelVisible = false;
  let filters = { range: 'fortnight', from: '', to: '', role: '', workId: '', group: '', sufficientOnly: false, sort: 'score_desc' };
  let originalTeamPage = null;

  function installStyle() {
    if (document.getElementById('employeePerformanceStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="employeePerformanceStyle">
      .employee-performance-switch{display:flex;gap:8px;margin-bottom:15px;padding:6px;border:1px solid #d5e4dd;border-radius:12px;background:#f8fcfa;overflow-x:auto;scrollbar-width:none}.employee-performance-switch::-webkit-scrollbar{display:none}.employee-performance-switch button{flex:0 0 auto;min-height:40px;padding:9px 13px;border:1px solid transparent;border-radius:9px;background:transparent;color:#557267;font-size:12px;font-weight:850}.employee-performance-switch button.active{border-color:#a9d2bd;background:#fff;color:#176a48;box-shadow:0 3px 10px #174e3420}
      .employee-performance{display:grid;gap:15px}.employee-performance-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px}.employee-performance-head h1{margin:0;color:#143f55}.employee-performance-head p{max-width:760px;margin:5px 0 0;color:#647a80;font-size:12px;line-height:1.5}.employee-performance-kicker{display:block;color:#20805a;font-size:10px;font-weight:900;letter-spacing:.1em}.employee-performance-note{padding:11px 13px;border:1px dashed #b9d8c8;border-radius:11px;background:#f6fcf8;color:#557269;font-size:11px;line-height:1.5}
      .employee-performance-filters{display:grid;grid-template-columns:repeat(6,minmax(125px,1fr));gap:9px;padding:13px;border:1px solid #d7e6df;border-radius:13px;background:#fff}.employee-performance-filters .field{min-width:0}.employee-performance-filters label{font-size:10px}.employee-performance-custom{display:grid;grid-template-columns:1fr 1fr;gap:8px;grid-column:span 2}.employee-performance-check{display:flex;align-items:center;gap:7px;min-width:0;min-height:42px;padding:8px 10px;border:1px solid #dfe8e4;border-radius:9px;background:#fbfdfc;font-size:11px;font-weight:750}.employee-performance-check input{flex:0 0 18px;width:18px;height:18px}.employee-performance-check span{min-width:0;overflow-wrap:anywhere;line-height:1.25}
      .employee-performance-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px}.employee-performance-summary article{padding:13px;border:1px solid #d8e7e0;border-radius:12px;background:#fff}.employee-performance-summary small{display:block;color:#6b8178;font-size:9px;font-weight:900;letter-spacing:.06em}.employee-performance-summary b{display:block;margin-top:6px;color:#164c3a;font-size:18px}.employee-performance-summary span{display:block;margin-top:3px;color:#71857d;font-size:10px;line-height:1.35}
      .employee-performance-ranking{display:grid;gap:10px}.employee-performance-ranking-head{display:flex;justify-content:space-between;align-items:end;gap:12px}.employee-performance-ranking-head h2{margin:0;color:#184a3a;font-size:18px}.employee-performance-ranking-head p{margin:4px 0 0;color:#6a8077;font-size:11px}.employee-performance-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.employee-performance-card{display:grid;gap:10px;padding:14px;border:1px solid #d8e6e0;border-radius:13px;background:#fff;text-align:left;cursor:pointer;transition:.15s}.employee-performance-card:hover{transform:translateY(-1px);border-color:#9ccab2;box-shadow:0 7px 18px #244e3b14}.employee-performance-card.provisional{border-color:#c8d9e8;background:#f8fbfe}.employee-performance-card.insufficient{background:#fafbfb;color:#657570}.employee-performance-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.employee-performance-position{display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0 6px;border-radius:8px;background:#edf5f1;color:#356452;font-size:11px;font-weight:900}.employee-performance-name{min-width:0;flex:1}.employee-performance-name b,.employee-performance-name small{display:block}.employee-performance-name b{overflow:hidden;color:#173f4d;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.employee-performance-name small{margin-top:3px;color:#70817c;font-size:10px}.employee-performance-score{min-width:58px;text-align:right}.employee-performance-score b{display:block;font-size:22px;line-height:1}.employee-performance-score small{display:block;margin-top:4px;font-size:9px}.employee-performance-score.excellent b{color:#17804d}.employee-performance-score.very-good b{color:#2173a9}.employee-performance-score.regular b{color:#8a7115}.employee-performance-score.attention b{color:#b35f20}.employee-performance-score.below b{color:#b43b45}.employee-performance-score.provisional b{color:#376d92}.employee-performance-score.insufficient b{color:#77837e}
      .employee-performance-bar{height:6px;overflow:hidden;border-radius:99px;background:#e8eeeb}.employee-performance-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2b8c60,#75ba78)}.employee-performance-card.provisional .employee-performance-bar i{background:linear-gradient(90deg,#4d83aa,#8fb4cf)}.employee-performance-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.employee-performance-facts div{padding:8px;border-radius:8px;background:#f7faf8}.employee-performance-facts small,.employee-performance-facts b{display:block}.employee-performance-facts small{color:#75857f;font-size:9px}.employee-performance-facts b{margin-top:3px;color:#294e42;font-size:11px}.employee-performance-status{display:flex;justify-content:space-between;gap:8px;color:#637871;font-size:10px}.employee-performance-empty{padding:24px;border:1px dashed #c8d8d1;border-radius:12px;background:#fafcfb;color:#6c7e77;text-align:center}
      .employee-performance-profile{display:grid;gap:14px}.employee-performance-profile-head{display:flex;align-items:flex-start;justify-content:space-between;gap:13px}.employee-performance-profile-head h2{margin:0;color:#153f51}.employee-performance-profile-head p{margin:4px 0 0;color:#6c7e82;font-size:11px}.employee-performance-profile-score{text-align:right}.employee-performance-profile-score b{display:block;color:#19734d;font-size:30px}.employee-performance-profile-score span{font-size:10px}.employee-performance-profile-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.employee-performance-profile-grid div{padding:10px;border:1px solid #e0e9e5;border-radius:9px;background:#fafcfb}.employee-performance-profile-grid small,.employee-performance-profile-grid b{display:block}.employee-performance-profile-grid small{color:#73847e;font-size:9px}.employee-performance-profile-grid b{margin-top:4px;color:#224b3e;font-size:12px}.employee-performance-criteria{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.employee-performance-criteria div{padding:9px;border-radius:9px;background:#f3f8f5}.employee-performance-criteria small,.employee-performance-criteria b{display:block}.employee-performance-criteria small{font-size:9px;color:#6f817a}.employee-performance-criteria b{margin-top:4px;color:#245341;font-size:13px}.employee-performance-history{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}.employee-performance-history div{display:grid;align-content:end;min-height:90px;padding:8px;border:1px solid #e0e9e5;border-radius:9px;background:#fafcfb}.employee-performance-history i{display:block;width:100%;border-radius:5px 5px 2px 2px;background:#6cae87}.employee-performance-history b,.employee-performance-history small{display:block;margin-top:5px}.employee-performance-history small{color:#74847e;font-size:8px}.employee-performance-work-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.employee-performance-work{padding:11px;border:1px solid #dce8e2;border-radius:10px;background:#fff}.employee-performance-work h4{margin:0;color:#1d4b3c;font-size:12px}.employee-performance-work p{margin:6px 0 0;color:#647970;font-size:10px;line-height:1.45}.employee-performance-incomplete{color:#956224!important}.employee-performance-associations{display:grid;gap:7px}.employee-performance-associations div{padding:9px 11px;border-radius:9px;background:#f5f9f7;color:#4e6e62;font-size:10px}.employee-performance-explanation{padding:11px 13px;border-left:4px solid #55a176;border-radius:9px;background:#f3faf6;color:#45685b;font-size:11px;line-height:1.55}
      @media(max-width:1180px){.employee-performance-filters{grid-template-columns:repeat(3,minmax(0,1fr))}.employee-performance-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.employee-performance-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.employee-performance-profile-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:760px){.employee-performance-head{display:block}.employee-performance-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.employee-performance-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.employee-performance-cards{grid-template-columns:1fr}.employee-performance-work-list{grid-template-columns:1fr}.employee-performance-criteria{grid-template-columns:repeat(2,minmax(0,1fr))}.employee-performance-history{grid-template-columns:repeat(3,minmax(0,1fr))}.employee-performance-profile-head{display:block}.employee-performance-profile-score{margin-top:8px;text-align:left}}
      @media(max-width:470px){.employee-performance-filters,.employee-performance-summary,.employee-performance-profile-grid{grid-template-columns:1fr}.employee-performance-custom{grid-template-columns:1fr;grid-column:auto}.employee-performance-criteria{grid-template-columns:1fr}.employee-performance-history{grid-template-columns:repeat(2,minmax(0,1fr))}}
    </style>`);
  }

  function switchMarkup(active) {
    return `<nav class="employee-performance-switch" aria-label="Áreas da equipe"><button class="${active === 'team' ? 'active' : ''}" type="button" onclick="showEmployeeList()">👷 Equipe</button><button class="${active === 'performance' ? 'active' : ''}" type="button" onclick="showEmployeePerformance()">📈 Desempenho dos Funcionários</button></nav>`;
  }

  function option(value, label, selected) {
    return `<option value="${html(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${html(label)}</option>`;
  }

  function criteriaLabel(key) {
    return ({ efficiency: 'Eficiência financeira', positive: 'Resultados positivos', regularity: 'Regularidade', consistency: 'Consistência', evolution: 'Evolução histórica' })[key] || key;
  }

  function performancePage(data) {
    installStyle();
    const model = calculate(data, filters);
    const summaryRows = filterAndSort(model, { ...filters, sufficientOnly: false });
    const rows = filterAndSort(model, filters);
    const evaluated = summaryRows.filter((row) => row.rankable);
    const waiting = summaryRows.filter((row) => !row.rankable);
    const complete = evaluated.filter((row) => row.sufficient).length;
    const provisional = evaluated.length - complete;
    const average = evaluated.length ? evaluated.reduce((sum, row) => sum + row.displayScore, 0) / evaluated.length : null;
    const leader = evaluated.slice().sort((a, b) => b.displayScore - a.displayScore)[0];
    const rowsWithFinancialData = evaluated.filter((row) => row.completeContributions.length > 0);
    const associated = rowsWithFinancialData.reduce((sum, row) => sum + row.associatedResult, 0);
    const roles = [...new Set(model.rows.map((row) => row.role))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const works = (data.works || []).filter((work) => work && !work.archived).sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
    const cards = rows.map((row) => `<article class="employee-performance-card ${row.band.key}" role="button" tabindex="0" data-employee-performance-id="${html(row.employee.id)}"><div class="employee-performance-card-head"><span class="employee-performance-position">${row.automaticRank ? `${row.automaticRank}º` : '—'}</span><div class="employee-performance-name"><b>${html(row.employee.name)}</b><small>${html(row.role)} · Grupo ${html(row.group || '—')}</small></div><div class="employee-performance-score ${row.band.key}"><b>${row.rankable ? Math.round(row.displayScore) : '—'}</b><small>${row.sufficient ? html(row.band.label) : row.rankable ? 'Nota automática provisória' : 'Sem presença no período'}</small></div></div><div class="employee-performance-bar" aria-label="Pontuação ${row.rankable ? Math.round(row.displayScore) : 'indisponível'} de 100"><i style="width:${row.rankable ? clamp(row.displayScore, 0, 100) : 0}%"></i></div><div class="employee-performance-facts"><div><small>DIÁRIAS</small><b>${decimal(row.workedUnits)}</b></div><div><small>OBRAS</small><b>${row.workCount}</b></div><div><small>CUSTO DA MÃO DE OBRA</small><b>${currency(row.contributions.reduce((sum, item) => sum + item.cost, 0))}</b></div><div><small>RESULTADO ASSOCIADO</small><b>${row.completeContributions.length ? currency(row.associatedResult) : '—'}</b></div></div><div class="employee-performance-status"><span>${row.trend === 'dados insuficientes' && row.rankable ? '• base atual' : `${row.trend === 'melhorando' ? '↗' : row.trend === 'caindo' ? '↘' : row.trend === 'estável' ? '→' : '•'} ${html(row.trend)}`}</span><span>${row.rankable ? 'Ver perfil' : 'Sem presença registrada'}</span></div></article>`).join('');
    return `${switchMarkup('performance')}<main class="employee-performance"><header class="employee-performance-head"><div><span class="employee-performance-kicker">ANÁLISE AUTOMÁTICA · SOMENTE LEITURA</span><h1 class="page-title">Desempenho dos Funcionários</h1><p>O ranking aparece automaticamente a partir da presença e acrescenta os critérios financeiros conforme os recebimentos reais ficam disponíveis. Nenhuma avaliação manual é necessária.</p></div></header><section class="employee-performance-filters"><div class="field"><label>Período</label><select onchange="setEmployeePerformanceFilter('range',this.value)">${option('fortnight', 'Quinzena atual', filters.range)}${option('month', 'Mês atual', filters.range)}${option('custom', 'Período personalizado', filters.range)}</select></div>${filters.range === 'custom' ? `<div class="employee-performance-custom"><div class="field"><label>Data inicial</label><input type="date" value="${html(filters.from)}" onchange="setEmployeePerformanceFilter('from',this.value)"></div><div class="field"><label>Data final</label><input type="date" value="${html(filters.to)}" onchange="setEmployeePerformanceFilter('to',this.value)"></div></div>` : ''}<div class="field"><label>Função</label><select onchange="setEmployeePerformanceFilter('role',this.value)">${option('', 'Todas as funções', filters.role)}${roles.map((role) => option(role, role, filters.role)).join('')}</select></div><div class="field"><label>Obra</label><select onchange="setEmployeePerformanceFilter('workId',this.value)">${option('', 'Todas as obras', filters.workId)}${works.map((work) => option(work.id, work.name, filters.workId)).join('')}</select></div><div class="field"><label>Grupo</label><select onchange="setEmployeePerformanceFilter('group',this.value)">${option('', 'Grupos A e B', filters.group)}${option('A', 'Grupo A', filters.group)}${option('B', 'Grupo B', filters.group)}</select></div><div class="field"><label>Ordenar por</label><select onchange="setEmployeePerformanceFilter('sort',this.value)">${option('score_desc', 'Maior pontuação', filters.sort)}${option('score_asc', 'Menor pontuação', filters.sort)}${option('evolution', 'Maior evolução', filters.sort)}${option('associated', 'Maior resultado associado', filters.sort)}${option('regularity', 'Maior regularidade', filters.sort)}${option('days', 'Maior quantidade de dias', filters.sort)}</select></div><label class="employee-performance-check"><input type="checkbox" ${filters.sufficientOnly ? 'checked' : ''} onchange="setEmployeePerformanceFilter('sufficientOnly',this.checked)"><span>Somente com dados suficientes</span></label></section><section class="employee-performance-summary"><article><small>RANKING AUTOMÁTICO</small><b>${evaluated.length}</b><span>${complete} completa(s) · ${provisional} provisória(s)</span></article><article><small>SEM PRESENÇA NO PERÍODO</small><b>${waiting.length}</b><span>não entram no ranking</span></article><article><small>MÉDIA GERAL</small><b>${Number.isFinite(average) ? Math.round(average) : '—'}</b><span>entre as notas calculadas</span></article><article><small>MELHOR PONTUAÇÃO</small><b>${leader ? html(leader.employee.name) : '—'}</b><span>${leader ? `${Math.round(leader.displayScore)} de 100${leader.sufficient ? '' : ' · provisória'}` : 'Sem presença no período'}</span></article><article><small>RESULTADO ASSOCIADO</small><b>${rowsWithFinancialData.length ? currency(associated) : '—'}</b><span>${rowsWithFinancialData.length ? html(model.range.label) : 'financeiro pendente no período'}</span></article></section><section class="employee-performance-ranking"><div class="employee-performance-ranking-head"><div><h2>Ranking automático</h2><p>${html(model.range.label)} · ${rows.length} funcionário(s) exibido(s)</p></div></div><div class="employee-performance-cards">${cards || '<div class="employee-performance-empty">Nenhum funcionário corresponde aos filtros selecionados.</div>'}</div></section><div class="employee-performance-note"><b>Leitura justa:</b> a nota provisória usa somente os critérios disponíveis e aproxima resultados parciais do ponto neutro. Obras sem recebimento registrado não entram nos critérios financeiros, e informação ausente nunca vira zero. Quando a escala e as observações financeiras mínimas estiverem completas, a mesma nota passa a ser identificada como completa.</div></main>`;
  }

  function profileMarkup(data, employeeId) {
    const model = calculate(data, filters);
    const row = model.rows.find((item) => item.employee.id === employeeId);
    if (!row) return '<div class="employee-performance-empty">Funcionário não encontrado.</div>';
    const history = historyForEmployee(data, filters, employeeId);
    const associations = colleagueAssociations(data, employeeId, filters);
    const points = Object.entries(row.criteria).map(([key, value]) => `<div><small>${html(criteriaLabel(key))} · peso ${WEIGHTS[key]}</small><b>${Number.isFinite(value) ? `${decimal(value * WEIGHTS[key], 1)} pts` : 'Sem dados'}</b></div>`).join('');
    const works = row.contributions.map((item) => `<article class="employee-performance-work"><h4>🏗️ ${html(item.work.name)}</h4><p>${decimal(item.units)} diária(s) · participação ${decimal(item.participation * 100, 1)}%<br>Custo: <b>${currency(item.cost)}</b> · recebido na obra: <b>${item.financialComplete ? currency(item.received) : '—'}</b><br>Gastos registrados: <b>${currency(item.expenses)}</b> · resultado financeiro: <b>${item.financialComplete ? currency(item.workResult) : '—'}</b><br><span class="${item.financialComplete ? '' : 'employee-performance-incomplete'}">Resultado associado: <b>${item.financialComplete ? currency(item.associatedResult) : `não pontuado — ${html(item.financialIssue || 'dados financeiros incompletos')}`}</b></span></p></article>`).join('');
    const high = Object.entries(row.criteria).filter(([, value]) => Number.isFinite(value) && value >= 0.6).map(([key]) => criteriaLabel(key));
    const low = Object.entries(row.criteria).filter(([, value]) => Number.isFinite(value) && value < 0.45).map(([key]) => criteriaLabel(key));
    const completePositive = row.completeContributions.filter((item) => item.workResult > 0).length;
    const completeNegative = row.completeContributions.filter((item) => item.workResult < 0).length;
    const financialExplanation = row.completeContributions.length
      ? `Teve resultado associado positivo em ${completePositive} obra(s) e negativo em ${completeNegative}.`
      : 'O resultado financeiro ainda está pendente no período e não foi convertido em zero.';
    const automaticBasis = row.sufficient
      ? 'presença, escala e financeiro completos'
      : Object.entries(row.criteria).some(([, value]) => Number.isFinite(value))
        ? 'critérios disponíveis e presença registrada'
        : 'presença e falta registradas';
    const explanation = `${row.employee.name} trabalhou ${decimal(row.workedUnits)} diária(s) em ${row.workCount} obra(s). ${financialExplanation} ${row.trend === 'dados insuficientes' ? 'Ainda não há histórico comparável suficiente para indicar evolução.' : `O desempenho está ${row.trend} em relação ao período anterior.`}`;
    return `<div class="employee-performance-profile"><header class="employee-performance-profile-head"><div><h2>${html(row.employee.name)}</h2><p>${html(row.role)} · Grupo ${html(row.group || '—')} · ${html(model.range.label)}</p></div><div class="employee-performance-profile-score"><b>${row.rankable ? Math.round(row.displayScore) : '—'}</b><span>${row.sufficient ? html(row.band.label) : row.rankable ? 'Nota automática provisória' : 'Sem presença no período'}</span></div></header>${row.sufficient ? '' : `<div class="employee-performance-note">${html(row.insufficiencyReason)}</div>`}<section class="employee-performance-profile-grid"><div><small>POSIÇÃO GERAL</small><b>${row.automaticRank ? `${row.automaticRank}º` : 'Sem posição'}</b></div><div><small>POSIÇÃO NA FUNÇÃO</small><b>${row.automaticRoleRank ? `${row.automaticRoleRank}º` : 'Sem posição'}</b></div><div><small>DIÁRIAS</small><b>${decimal(row.workedUnits)}</b></div><div><small>OBRAS</small><b>${row.workCount}</b></div><div><small>CUSTO DA MÃO DE OBRA</small><b>${currency(row.contributions.reduce((sum, item) => sum + item.cost, 0))}</b></div><div><small>RESULTADO ASSOCIADO</small><b>${row.completeContributions.length ? currency(row.associatedResult) : '—'}</b></div><div><small>REGULARIDADE</small><b>${Number.isFinite(row.regularity) ? `${decimal(row.regularity * 100)}%` : 'Sem escala comparável'}</b></div><div><small>BASE DA NOTA</small><b>${html(automaticBasis)}</b></div><div><small>DIÁRIAS SEM OBRA</small><b>${decimal(row.unassignedUnits)}</b></div><div><small>ATRIBUIÇÕES CONFLITANTES</small><b>${row.ambiguousDays}</b></div></section><section><h3>Composição da pontuação</h3><div class="employee-performance-criteria">${points}</div><p class="sub">${row.sufficient ? `Pontos que elevaram: ${html(high.join(', ') || 'ainda não identificados')}. Pontos que reduziram: ${html(low.join(', ') || 'nenhum critério abaixo da faixa de atenção')}.` : `Nota provisória calculada automaticamente com ${html(automaticBasis)}. Os critérios financeiros ausentes permanecem marcados como “Sem dados”.`}</p></section><section><h3>Evolução recente</h3><div class="employee-performance-history">${history.map((item) => `<div><i style="height:${Number.isFinite(item.score) ? Math.max(5, item.score) : 5}%"></i><b>${Number.isFinite(item.score) ? Math.round(item.score) : '—'}</b><small>${displayDate(item.range.from)}<br>${displayDate(item.range.to)}</small></div>`).join('')}</div></section><section><h3>Participação nas obras</h3><div class="employee-performance-work-list">${works || '<div class="employee-performance-empty">Nenhuma obra associada no período.</div>'}</div></section><div class="employee-performance-explanation">${html(explanation)}</div><section><h3>Associações estatísticas</h3><div class="employee-performance-associations">${associations.length ? associations.map((item) => `<div>${html(row.employee.name)} e ${html(item.employee.name)} participaram juntos de ${item.together} período(s) de obra e ${item.sharedDays} dia(s), sendo ${item.positive} período(s) com resultado positivo.</div>`).join('') : '<div>Ainda não há o mínimo seguro de 5 participações e 5 dias conjuntos para exibir associações.</div>'}</div><p class="sub">Associação não significa que a dupla causou o resultado.</p></section></div>`;
  }

  function install() {
    if (!root || typeof document === 'undefined') return;
    const attempt = () => {
      if (originalTeamPage || typeof teamByRole !== 'function' || typeof render !== 'function') return;
      originalTeamPage = teamByRole;
      installStyle();
      teamByRole = function teamWithPerformance() {
        return panelVisible ? performancePage(db) : `${switchMarkup('team')}${originalTeamPage()}`;
      };
      Object.assign(root, {
        showEmployeeList() { panelVisible = false; render(); },
        showEmployeePerformance() { panelVisible = true; filters.sufficientOnly = false; render(); },
        setEmployeePerformanceFilter(key, value) { filters[key] = value; render(); },
        openEmployeePerformanceProfile(employeeId) {
          const dialog = document.getElementById('dialog');
          const modal = document.getElementById('modal');
          if (!dialog || !modal) return;
          dialog.innerHTML = `${profileMarkup(db, employeeId)}<footer><button class="btn alt" type="button" onclick="closeModal()">Fechar</button></footer>`;
          modal.classList.add('show');
        }
      });
      if (document.documentElement.dataset.employeePerformanceActionsReady !== '1') {
        document.documentElement.dataset.employeePerformanceActionsReady = '1';
        document.addEventListener('click', (event) => {
          const card = event.target?.closest?.('.employee-performance-card[data-employee-performance-id]');
          if (card) root.openEmployeePerformanceProfile(card.dataset.employeePerformanceId);
        });
        document.addEventListener('keydown', (event) => {
          const card = event.target?.closest?.('.employee-performance-card[data-employee-performance-id]');
          if (!card || !['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          root.openEmployeePerformanceProfile(card.dataset.employeePerformanceId);
        });
      }
      if (typeof page !== 'undefined' && page === 'team') render();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attempt, { once: true });
    else attempt();
  }

  return {
    WEIGHTS,
    MIN_WORKED_UNITS,
    MIN_FINANCIAL_OBSERVATIONS,
    resolveRange,
    previousRange,
    effectiveAttendanceRows,
    actualReceipts,
    buildSnapshot,
    calculate,
    filterAndSort,
    historyForEmployee,
    colleagueAssociations,
    performanceBand,
    install
  };
});
