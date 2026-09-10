(function (root, factory) {
  const core = typeof module === 'object' && module.exports ? require('./work-control-core-v1.js') : root.ObraAtivaWorkCore;
  const api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ObraAtivaWorkCostCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (C) {
  'use strict';
  const list = C.list, round = C.round, copy = (value) => JSON.parse(JSON.stringify(value));
  const text = (value) => String(value ?? '').trim();
  const fail = (message) => { throw new Error(message); };
  const categories = Object.freeze(['Combustível', 'Marmita / alimentação', 'Alojamento', 'Material', 'Equipamento / ferramenta', 'Frete / transporte', 'Serviço terceirizado', 'Outro']);
  const contracts = (state, workId) => list(list(state.works).find((work) => work.id === workId)?.control?.empreitas);
  const payments = (state, workId, contractId) => list(state.otherExpenses).filter((row) => row.workId === workId && row.costType === 'contractPayment' && (!contractId || row.contractId === contractId));
  function positive(value, label) {
    const number = C.number(value);
    if (number == null || !Number.isFinite(number) || number <= 0 || number > 1e9) fail(`Informe ${label} maior que zero e dentro do limite permitido.`);
    return number;
  }
  function amount(value, label = 'um valor') {
    const number = positive(value, label);
    if (round(number) !== number) fail('Use no máximo duas casas decimais nos valores em reais.');
    return round(number);
  }
  function phase(state, workId, phaseId, ctx) {
    if (!phaseId) return '';
    if (C.find(state, 'workPhases', phaseId, ctx).workId !== workId) fail('A fase precisa pertencer a esta obra.');
    return phaseId;
  }
  function writable(state, workId, ctx, works = false) {
    C.context(ctx, 'financial');
    if (works) C.context(ctx, 'works');
    const work = C.find(state, 'works', workId, ctx);
    if (work.archived || work.status === 'Finalizada') fail('Esta obra está encerrada. Os registros continuam disponíveis para consulta.');
    return work;
  }
  function operation(input) { if (!text(input.operationId)) fail('Identificador do lançamento ausente. Reabra o formulário.'); }
  function dated(value, ctx) {
    if (!C.day(value) || value > ctx.today) fail('Informe a data real do gasto, até hoje.');
    return value;
  }
  function totals(state, workId, contractId) {
    const rows = contracts(state, workId).filter((row) => !contractId || row.id === contractId);
    const paidRows = C.ledgerFor(payments(state, workId, contractId).map((row) => ({ ...row, source: 'otherExpenses' })), workId).rows;
    const contracted = round(rows.reduce((sum, row) => sum + Number(row.total || 0), 0));
    const paid = round(paidRows.reduce((sum, row) => sum + row.value, 0));
    return { contracted, paid, outstanding: round(Math.max(0, contracted - paid)) };
  }
  function recordEvent(next, workId, kind, data, ctx) {
    // Usa a linha do tempo existente da obra; não cria um histórico paralelo.
    if (ctx.modules.includes('works')) C.event(next, workId, kind, { ...data, financialEvent: true }, ctx);
  }
  function saveContract(state, workId, input, ctx) {
    writable(state, workId, ctx, true); operation(input);
    const next = copy(state), work = C.find(next, 'works', workId, ctx);
    const existingOperation = contracts(next, workId).find((row) => row.operationId === input.operationId);
    if (existingOperation) return { state: next, contractId: existingOperation.id };
    const old = input.id ? contracts(next, workId).find((row) => row.id === input.id) : null;
    if (input.id && !old) fail('Empreita não encontrada nesta obra.');
    const name = text(input.name), employeeId = text(input.employeeId);
    if (!name || name.length > 160) fail('Informe o serviço, com até 160 caracteres.');
    const responsible = employeeId ? C.find(next, 'employees', employeeId, ctx).name : text(input.responsible);
    if (!responsible || responsible.length > 160) fail('Informe quem é responsável pela empreita.');
    if (!['meters', 'fixed'].includes(input.mode)) fail('Escolha por metragem ou valor fechado.');
    const quantity = input.mode === 'meters' ? positive(input.quantity, 'uma metragem') : null;
    const unitPrice = input.mode === 'meters' ? amount(input.unitPrice, 'o valor por metro') : null;
    const unit = input.mode === 'meters' ? text(input.unit || old?.unit) : '';
    if (unit && !['m', 'm²', 'm³'].includes(unit)) fail('Escolha a unidade: m, m² ou m³.');
    const total = input.mode === 'meters' ? amount(round(quantity * unitPrice), 'o valor total') : amount(input.total, 'o valor total');
    const phaseId = phase(next, workId, text(input.phaseId), ctx);
    const start = C.date(input.start, 'Data de início'), end = C.date(input.end, 'Previsão de término');
    if (start && end && end < start) fail('O término não pode ser anterior ao início.');
    const paid = old ? totals(next, workId, old.id).paid : 0;
    if (total < paid) fail('O valor contratado não pode ser menor que os pagamentos já registrados.');
    const row = { ...(old || {}), id: old?.id || ctx.id(), workId, companyId: ctx.companyId,
      employeeId, responsible, name, mode: input.mode, quantity, unitPrice, unit, total, phaseId, start, end,
      createdAt: old?.createdAt || ctx.now, updatedAt: ctx.now, operationId: input.operationId };
    work.control ??= {}; work.control.empreitas ??= [];
    if (old) work.control.empreitas[work.control.empreitas.findIndex((item) => item.id === old.id)] = row;
    else work.control.empreitas.push(row);
    const changedValue = old && old.total !== total, changedPhase = old && old.phaseId !== phaseId;
    const title = !old ? 'Empreita criada' : changedValue && changedPhase ? 'Valor e fase da empreita alterados' : changedValue ? 'Valor da empreita alterado' : changedPhase ? 'Fase da empreita alterada' : 'Empreita atualizada';
    recordEvent(next, workId, title, { contractId: row.id, phaseId, value: total, operationId: input.operationId,
      description: name, before: old ? copy(old) : null, after: copy(row) }, ctx);
    return { state: next, contractId: row.id };
  }
  function savePayment(state, workId, contractId, input, ctx) {
    writable(state, workId, ctx); operation(input);
    const next = copy(state), contract = contracts(next, workId).find((row) => row.id === contractId);
    if (!contract) fail('Empreita não encontrada nesta obra.');
    if (list(next.otherExpenses).some((row) => row.workId === workId && row.operationId === input.operationId)) return next;
    const value = amount(input.value), date = dated(input.date, ctx);
    if (value > totals(next, workId, contractId).outstanding) fail('O pagamento não pode ultrapassar o saldo a pagar desta empreita.');
    const note = text(input.note).slice(0, 2000);
    const row = { id: ctx.id(), workId, companyId: ctx.companyId, contractId, costType: 'contractPayment',
      category: 'Empreita', value, date, phaseId: phase(next, workId, text(input.phaseId), ctx),
      description: contract.name, note, employeeId: contract.employeeId, responsible: contract.responsible,
      createdAt: ctx.now, operationId: input.operationId };
    // Pagamentos de empreita são despesas realizadas, na coleção financeira já existente.
    // Não entram em db.payments (quitação de diárias), evitando pagamento/custo em dobro.
    next.otherExpenses ??= []; next.otherExpenses.push(row);
    recordEvent(next, workId, 'Pagamento de empreita', { contractId, expenseId: row.id, date, value, phaseId: row.phaseId, description: contract.name, note, operationId: input.operationId }, ctx);
    return next;
  }
  function saveExtra(state, workId, input, ctx) {
    writable(state, workId, ctx); operation(input);
    const next = copy(state);
    if (list(next.otherExpenses).some((row) => row.workId === workId && row.operationId === input.operationId)) return next;
    if (!categories.includes(input.category)) fail('Escolha a categoria do custo.');
    const category = input.category === 'Outro' ? text(input.customCategory) : input.category;
    if (!category || category.length > 80) fail('Informe o tipo do custo, com até 80 caracteres.');
    const value = amount(input.value), date = dated(input.date, ctx), phaseId = phase(next, workId, text(input.phaseId), ctx);
    const proof = input.proof || null;
    if (proof && (typeof proof.data !== 'string' || proof.data.length > 220000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(proof.data))) fail('Use um comprovante em imagem de até 160 KB após a compactação.');
    const row = { id: ctx.id(), workId, companyId: ctx.companyId, costType: 'extra', category,
      value, date, phaseId, description: text(input.description).slice(0, 2000),
      proof: proof ? { name: text(proof.name).slice(0, 160), data: proof.data } : null,
      createdAt: ctx.now, operationId: input.operationId };
    next.otherExpenses ??= []; next.otherExpenses.push(row);
    recordEvent(next, workId, 'Custo extra registrado', { expenseId: row.id, phaseId, date, value, category, description: row.description, operationId: input.operationId }, ctx);
    return next;
  }
  function attendanceMode(state, attendance) {
    const linked = list(state.attendance).find((row) => row.employeeId === attendance.employeeId && row.date === attendance.date && row.workId);
    const assignment = list(state.distributions).find((row) => row.employeeId === attendance.employeeId && row.date === attendance.date);
    const workId = attendance.workId || linked?.workId || assignment?.workId || '';
    // O vínculo gravado na presença preserva o regime mesmo que a escala seja removida depois.
    const recorded = [attendance, linked].find((row) => row?.paymentMode && (!row.workId || row.workId === workId));
    const source = recorded || (assignment?.workId === workId ? assignment : null);
    const contractId = source?.contractId || '';
    const contracted = source?.paymentMode === 'contract' || !!contractId;
    return { workId, paymentMode: contracted ? 'contract' : 'daily', contractId, phaseId: source?.phaseId || '' };
  }
  function breakdown(state, workId, ledger, initialTotal = 0) {
    const rows = C.ledgerFor(ledger, workId).rows.filter((row) => row.kind !== 'receipt' && (!state.companyId || !row.companyId || row.companyId === state.companyId));
    const sum = (items) => round(items.reduce((total, row) => total + row.value, 0));
    const daily = sum(rows.filter((row) => row.kind === 'labor'));
    const contractPaid = sum(rows.filter((row) => row.costType === 'contractPayment'));
    const extras = sum(rows.filter((row) => row.kind !== 'labor' && row.costType !== 'contractPayment'));
    const recorded = sum(rows), totalCost = round(Math.max(recorded, Number(initialTotal || 0)));
    const prior = round(totalCost - recorded), commitment = totals(state, workId).outstanding;
    const phases = list(state.workPhases).filter((row) => row.workId === workId).map((row) => ({ id: row.id, name: row.name }));
    const valid = new Set(phases.map((row) => row.id)); phases.push({ id: '', name: 'Sem fase definida' });
    const byPhase = phases.map((p) => {
      const items = rows.filter((row) => (valid.has(row.phaseId) ? row.phaseId : '') === p.id);
      return { ...p, daily: sum(items.filter((row) => row.kind === 'labor')),
        contractPaid: sum(items.filter((row) => row.costType === 'contractPayment')),
        extras: sum(items.filter((row) => row.kind !== 'labor' && row.costType !== 'contractPayment')),
        total: round(sum(items) + (!p.id ? prior : 0)) };
    });
    return { daily, contractPaid, extras, prior, totalCost, commitment, byPhase, rows };
  }
  // Consulta por período: usa os mesmos lançamentos e a mesma deduplicação do
  // total da obra. Não cria despesas, não quita diárias e não altera o estado.
  function periodBreakdown(state, workId, ledger, period, initialTotal = 0, asOf = '', initialReceived = 0) {
    if (!C.day(period?.from) || !C.day(period?.to) || period.from > period.to || (asOf && !C.day(asOf))) fail('Não foi possível identificar as datas da quinzena.');
    const scoped = list(ledger).filter(row => !state.companyId || !row.companyId || row.companyId === state.companyId);
    const all = breakdown(state, workId, scoped, initialTotal);
    const through = asOf && asOf < period.to ? asOf : period.to;
    const inPeriod = all.rows.filter(row => row.date >= period.from && row.date <= period.to);
    const rows = inPeriod.filter(row => row.date <= through);
    const unique = C.ledgerFor(scoped, workId);
    // Recebimentos comuns e de fechamentos usam a mesma identidade de origem;
    // uma transferência para fechamento não vira uma segunda entrada.
    const allReceipts = unique.rows.filter(row => row.kind === 'receipt');
    const receiptRows = allReceipts.filter(row => row.date >= period.from && row.date <= period.to && row.date <= through);
    const received = round(receiptRows.reduce((total, row) => total + row.value, 0));
    // Um saldo inicial sem lançamentos datados permanece no total da obra;
    // nunca atribuir esse saldo inteiro a uma quinzena escolhida arbitrariamente.
    const result = breakdown(state, workId, rows);
    const people = new Map();
    for (const row of result.rows.filter(row => row.kind === 'labor')) {
      const id = row.employeeId || '';
      const employee = list(state.employees).find(person => person.id === id && (!state.companyId || !person.companyId || person.companyId === state.companyId));
      if (!people.has(id)) people.set(id, { id, name: employee?.name || 'Pessoa não identificada', dates: new Set(), units: 0, total: 0, rows: [] });
      const person = people.get(id), units = C.number(row.units) ?? 1;
      if (units > 0) person.dates.add(row.date);
      person.units += units; person.total += row.value; person.rows.push(row);
    }
    return { ...result, received, result: round(received - result.totalCost), receiptRows,
      period: { from: period.from, to: period.to }, through,
      partial: !!asOf && period.from <= asOf && period.to >= asOf, future: !!asOf && period.from > asOf,
      unallocatedPrior: all.prior,
      unallocatedReceived: round(Math.max(0, Number(initialReceived || 0) - allReceipts.reduce((total, row) => total + row.value, 0))),
      futureCost: round(inPeriod.filter(row => row.date > through).reduce((total, row) => total + row.value, 0)),
      futureReceived: round(allReceipts.filter(row => row.date >= period.from && row.date <= period.to && row.date > through).reduce((total, row) => total + row.value, 0)),
      warnings: unique.warnings,
      byEmployee: [...people.values()].map(person => ({ ...person, days: person.dates.size, dates: [...person.dates].sort(), units: round(person.units), total: round(person.total) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) };
  }
  function clientContract(state, workId) {
    const work = list(state.works).find((row) => row.id === workId);
    const receivable = list(state.receivables).find((row) => row.workId === workId);
    // O botão vigente “Definir valor” grava receivables.total. Não usar saldo restante
    // nem somar recebido ao total cadastrado: isso duplicaria a receita do cliente.
    if (receivable && C.number(receivable.total) != null) return { value: Number(receivable.total), source: 'Valor cadastrado no Financeiro' };
    const configured = C.number(work?.control?.plan?.contractValue) ?? C.number(work?.control?.baseline?.contractValue);
    if (configured != null) return { value: configured, source: 'Total combinado com o cliente' };
    const closings = list(state.workClosings).filter((row) => row.workId === workId);
    return closings.length ? { value: round(closings.reduce((sum, row) => sum + Number(row.value || 0), 0)), source: 'Total dos fechamentos cadastrados' } : { value: null, source: 'Informe o valor em Definir valor' };
  }
  function clientReceiptRows(state, workId) {
    const rows = list(state.receipts).map((row, index) => ({ ...row, source: 'receipts', kind: 'receipt', identity: `receipt:${row.sourceReceiptId || row.id || `legacy:${index}`}` }));
    for (const [index, closing] of list(state.workClosings).entries()) {
      if (closing.workId !== workId || (state.companyId && closing.companyId && closing.companyId !== state.companyId)) continue;
      rows.push(...list(closing.receipts).map((row, receiptIndex) => ({ ...row, workId, source: 'closingReceipts', kind: 'receipt', identity: `receipt:${row.sourceReceiptId || row.id || `closing:${closing.id || index}:${receiptIndex}`}` })));
    }
    const seen = new Set();
    // Recebimentos antigos sem data continuam no total da obra. A quinzena,
    // por outro lado, só pode usar uma data válida: nunca inventar a data de hoje.
    // Duplicidade se reconhece pela identidade, não por valor/data iguais.
    return rows.filter(row => row.workId === workId && (!state.companyId || !row.companyId || row.companyId === state.companyId) && C.number(row.value) != null && C.number(row.value) >= 0)
      .filter(row => !seen.has(row.identity) && seen.add(row.identity))
      .map(row => ({ ...row, value: round(Number(row.value)), dateKnown: C.day(row.date) }));
  }
  function clientAgreement(state, workId) {
    const contract = clientContract(state, workId), record = list(state.receivables).find(row => row.workId === workId);
    const addenda = list(record?.addenda), added = round(addenda.reduce((total, row) => total + Number(row.value || 0), 0));
    return { ...contract, addenda, added, original: contract.value == null ? null : round(contract.value - added) };
  }
  function clientPosition(state, workId, asOf = '') {
    const agreement = clientAgreement(state, workId);
    const baseline = list(state.works).find(work => work.id === workId)?.control?.baseline || {};
    const rows = clientReceiptRows(state, workId).filter(row => !asOf || !row.dateKnown || row.date <= asOf);
    const datedRows = rows.filter(row => row.dateKnown), undated = round(rows.filter(row => !row.dateKnown).reduce((total, row) => total + row.value, 0));
    const known = C.reconcile(datedRows, C.number(baseline.priorReceived), baseline.asOfDate);
    // Sem data não é possível saber se um recibo já integra o marco anterior.
    // Preserva o maior total comprovado e sinaliza a conferência, sem somar o
    // marco mais uma vez e sem apagar o recibo do histórico.
    const received = undated && baseline.asOfDate ? Math.max(known.total, round(datedRows.reduce((total, row) => total + row.value, 0) + undated)) : round(known.total + undated);
    const discounts = round(list(state.receivableDiscounts).filter(row => row.workId === workId).reduce((total, row) => total + Number(row.value || 0), 0));
    return { ...agreement, received, discounts, undated, undatedNeedsReview: undated > 0 && Number(baseline.priorReceived) > 0,
      remaining: agreement.value == null ? null : round(Math.max(0, agreement.value - received - discounts)) };
  }
  function clientForecasts(state, workId, period = null, asOf = '') {
    const seen = new Set();
    const all = list(state.workClosings).filter(row => row.workId === workId && (!state.companyId || !row.companyId || row.companyId === state.companyId)).map(row => {
      const paid = clientReceiptRows({ ...state, receipts: [], workClosings: [row] }, workId).filter(receipt => {
        if ((asOf && receipt.dateKnown && receipt.date > asOf) || seen.has(receipt.identity)) return false;
        seen.add(receipt.identity); return true;
      });
      const received = round(paid.reduce((total, receipt) => total + receipt.value, 0));
      return { ...row, value: C.number(row.value), received, pending: round(Math.max(0, Number(row.value || 0) - received)) };
    });
    const rows = all.filter(row => row.value != null && (!period || (C.day(row.expectedDate) && row.expectedDate >= period.from && row.expectedDate <= period.to)));
    const sum = key => round(rows.reduce((total, row) => total + Number(row[key] || 0), 0));
    return { rows, planned: sum('value'), received: sum('received'), pending: sum('pending'),
      pendingAll: round(all.reduce((total, row) => total + row.pending, 0)) };
  }
  function ensureClientRecord(state, workId, value, ctx) {
    state.receivables ??= [];
    let record = state.receivables.find(row => row.workId === workId);
    if (!record) {
      record = { id: ctx.id(), workId, total: value, startDate: [ctx.today, ...clientReceiptRows(state, workId).filter(row => row.dateKnown).map(row => row.date)].sort()[0], notes: '', createdAt: ctx.now };
      state.receivables.push(record);
    }
    return record;
  }
  function saveClientAddendum(state, workId, input, ctx) {
    writable(state, workId, ctx); operation(input);
    const agreement = clientAgreement(state, workId);
    if (agreement.value == null) fail('Informe primeiro o valor inicial combinado da obra. Depois acrescente o aditivo.');
    if (agreement.addenda.some(row => row.operationId === input.operationId)) return state;
    const description = text(input.description), value = amount(input.value), date = dated(input.date, ctx);
    if (!description || description.length > 160) fail('Descreva o serviço extra, com até 160 caracteres.');
    const total = round(agreement.value + value);
    if (total > 1e12) fail('O contrato atualizado ultrapassa o limite permitido.');
    const next = copy(state), record = ensureClientRecord(next, workId, agreement.value, ctx);
    const addition = { id: ctx.id(), workId, companyId: ctx.companyId, description, value, date, operationId: input.operationId, createdAt: ctx.now };
    record.addenda ??= []; record.addenda.push(addition); record.total = total; record.updatedAt = ctx.now;
    // Aditivo muda o contrato, nunca cria recebimento, previsão ou despesa.
    recordEvent(next, workId, 'Aditivo combinado com o cliente', { addendumId: addition.id, date, value, operationId: input.operationId, description, beforeTotal: agreement.value, afterTotal: total }, ctx);
    return next;
  }
  function saveClientForecast(state, workId, input, ctx) {
    writable(state, workId, ctx); operation(input);
    const position = clientPosition(state, workId, ctx.today), forecasts = clientForecasts(state, workId, null, ctx.today);
    if (position.value == null) fail('Informe primeiro o valor do contrato da obra. A previsão é uma parte desse valor.');
    if (forecasts.rows.some(row => row.operationId === input.operationId)) return state;
    const old = input.id ? forecasts.rows.find(row => row.id === input.id) : null;
    if (input.id && !old) fail('Previsão não encontrada nesta obra.');
    const value = amount(input.value), expectedDate = C.date(input.expectedDate, 'Data combinada');
    if (!expectedDate) fail('Informe a data combinada para receber.');
    const received = old?.received || 0, available = round(Math.max(0, position.remaining - forecasts.pendingAll + (old?.pending || 0)));
    if (value < received) fail('A previsão não pode ser menor que o valor já recebido nela.');
    if (round(value - received) > available) fail('As previsões ultrapassam o saldo do contrato. Confira as previsões existentes ou registre um aditivo para os serviços extras.');
    const next = copy(state); ensureClientRecord(next, workId, position.value, ctx); next.workClosings ??= [];
    const current = old ? next.workClosings.find(row => row.id === old.id) : null;
    const record = { ...(current || {}), id: current?.id || ctx.id(), workId, companyId: ctx.companyId, value, expectedDate,
      closedDate: current?.closedDate || ctx.today, periodFrom: current?.periodFrom || '', periodTo: current?.periodTo || '',
      note: text(input.note).slice(0, 2000), receipts: current?.receipts || [], clientForecast: true, operationId: input.operationId,
      createdAt: current?.createdAt || ctx.now, updatedAt: ctx.now };
    if (current) Object.assign(current, record); else next.workClosings.push(record);
    recordEvent(next, workId, old ? 'Previsão de recebimento atualizada' : 'Previsão de recebimento combinada', { closingId: record.id, value, expectedDate, operationId: input.operationId, description: 'Parte do contrato; não é dinheiro recebido nem um novo aditivo.' }, ctx);
    return next;
  }
  function saveClientReceipt(state, workId, input, ctx) {
    writable(state, workId, ctx); operation(input);
    if (clientReceiptRows(state, workId).some(row => row.operationId === input.operationId)) return state;
    const position = clientPosition(state, workId, ctx.today), value = amount(input.value), date = dated(input.date, ctx);
    if (position.value == null) fail('Informe primeiro o contrato da obra. Depois registre o valor pago pelo cliente.');
    if (value > position.remaining) fail('O recebimento ultrapassa o saldo total da obra. Confira o contrato ou registre o aditivo antes.');
    const forecast = input.closingId ? clientForecasts(state, workId, null, ctx.today).rows.find(row => row.id === input.closingId) : null;
    if (input.closingId && !forecast) fail('A previsão não pertence a esta obra.');
    if (forecast && value > forecast.pending) fail('O recebimento ultrapassa o que falta pagar nesta previsão.');
    const next = copy(state); ensureClientRecord(next, workId, position.value, ctx);
    const row = { id: ctx.id(), workId, companyId: ctx.companyId, date, value, method: ['PIX', 'Dinheiro', 'Transferência', 'Outro'].includes(input.method) ? input.method : 'Outro',
      note: text(input.note).slice(0, 2000), notes: text(input.note).slice(0, 2000), operationId: input.operationId, createdAt: ctx.now };
    if (forecast) { const current = next.workClosings.find(item => item.id === forecast.id); current.receipts ??= []; current.receipts.push(row); current.updatedAt = ctx.now; }
    else { next.receipts ??= []; next.receipts.push(row); }
    recordEvent(next, workId, 'Recebimento do cliente registrado', { receiptId: row.id, date, value, operationId: input.operationId, description: row.note }, ctx);
    return next;
  }
  function saveClientContract(state, workId, input, ctx) {
    writable(state, workId, ctx); operation(input);
    const value = C.number(input.total);
    if (value == null || value < 0 || value > 1e12 || round(value) !== value) fail('Informe o valor total do contrato, em reais e com até duas casas decimais.');
    if (value < clientAgreement(state, workId).added) fail('O total do contrato não pode ser menor que os aditivos registrados. Confira o valor inicial.');
    const next = copy(state); next.receivables ??= [];
    const record = next.receivables.find((row) => row.workId === workId);
    if (record?.operationId === input.operationId) return next;
    // É o TOTAL contratado, nunca o saldo acrescido de recebimentos. Preserva
    // comprovantes, recebimentos, fechamentos e todas as informações anteriores.
    if (record) Object.assign(record, { total: value, updatedAt: ctx.now, operationId: input.operationId });
    else {
      const startDate = [ctx.today, ...list(next.receipts).filter(row => row.workId === workId && C.day(row.date)).map(row => row.date)].sort()[0];
      next.receivables.push({ id: ctx.id(), workId, total: value, startDate, notes: '', createdAt: ctx.now, operationId: input.operationId });
    }
    recordEvent(next, workId, 'Contrato com o cliente atualizado', { value, operationId: input.operationId, description: 'Valor total combinado com o cliente; não é um novo recebimento.' }, ctx);
    return next;
  }
  return Object.freeze({ categories, contracts, payments, totals, saveContract, savePayment, saveExtra, attendanceMode, breakdown, periodBreakdown, clientContract, saveClientContract,
    clientReceiptRows, clientAgreement, clientPosition, clientForecasts, saveClientAddendum, saveClientForecast, saveClientReceipt });
});
