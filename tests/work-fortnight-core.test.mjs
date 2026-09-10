import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url), C = require('../public-assets/work-cost-core-v1.js');
// Dados inteiramente FICTÍCIOS. Nenhuma conta, rede ou persistência da aplicação.
const workId = 'OBRA-QUINZENA-TESTE';
const state = { companyId: 'EMPRESA-QUINZENA-TESTE', works: [{ id: workId, control: { empreitas: [{ id: 'EMPREITA-TESTE', total: 731 }] } }],
  employees: [{ id: 'PESSOA-QUINZENA-TESTE', name: 'PESSOA FICTÍCIA DA QUINZENA' }],
  workPhases: [{ id: 'FASE-QUINZENA-TESTE', workId, name: 'FASE FICTÍCIA' }, { id: 'FASE-ZERO-TESTE', workId, name: 'FASE FICTÍCIA SEM CUSTO' }],
  otherExpenses: [{ id: 'PARCELA-TESTE', workId, contractId: 'EMPREITA-TESTE', costType: 'contractPayment', date: '2031-01-12', value: 131 }] };
const row = (id, date, value, rest = {}) => ({ id, source: 'otherExpenses', workId, date, value, kind: 'other', ...rest });
const ledger = [
  row('ANTES-TESTE', '2031-01-03', 7),
  row('DIARIA-1-TESTE', '2031-01-04', 23.1, { source: 'attendance', kind: 'labor', employeeId: 'PESSOA-QUINZENA-TESTE', units: 1, phaseId: 'FASE-QUINZENA-TESTE' }),
  row('DIARIA-2-TESTE', '2031-01-05', 13.7, { source: 'attendance', kind: 'labor', employeeId: 'PESSOA-QUINZENA-TESTE', units: 0.5, phaseId: 'FASE-QUINZENA-TESTE' }),
  row('PARCELA-TESTE', '2031-01-12', 131, { costType: 'contractPayment', kind: 'contract', phaseId: 'FASE-QUINZENA-TESTE' }),
  row('EXTRA-TESTE', '2031-01-15', 17.03), row('FIM-TESTE', '2031-01-17', 5.17), row('DEPOIS-TESTE', '2031-01-18', 19),
  row('SALARIO-TESTE', '2031-01-13', 36.8, { kind: 'payment', source: 'payments' }),
  row('ADIANTAMENTO-TESTE', '2031-01-13', 29, { kind: 'advance' }),
  row('RECEBIMENTO-TESTE', '2031-01-13', 887, { kind: 'receipt', source: 'receipts' }),
  row('OUTRA-OBRA-TESTE', '2031-01-13', 59, { workId: 'OUTRA-OBRA-TESTE' }),
  row('OUTRA-EMPRESA-TESTE', '2031-01-13', 61, { companyId: 'OUTRA-EMPRESA-TESTE' })
];
ledger.push({ ...ledger[1] }, { ...ledger[3] });
const period = { from: '2031-01-04', to: '2031-01-17' };
test('datas inclusivas, centavos, fontes únicas e valores ainda a pagar separados', () => {
  const before = JSON.stringify({ state, ledger });
  const value = C.periodBreakdown(state, workId, ledger, period, 0, '2031-01-18');
  assert.equal(value.daily, 36.8); assert.equal(value.contractPaid, 131); assert.equal(value.extras, 22.2);
  assert.equal(value.totalCost, 190); assert.equal(value.commitment, 600); assert.equal(value.rows.length, 5);
  assert.equal(value.received, 887); assert.equal(value.result, 697);
  assert.equal(value.byPhase.find(p => p.id === 'FASE-QUINZENA-TESTE').total, 167.8);
  assert.equal(value.byPhase.find(p => !p.id).total, 22.2);
  assert.equal(value.byPhase.find(p => p.id === 'FASE-ZERO-TESTE').total, 0);
  assert.equal(value.byEmployee[0].days, 2); assert.equal(value.byEmployee[0].units, 1.5); assert.equal(value.byEmployee[0].total, 36.8);
  assert.equal(JSON.stringify({ state, ledger }), before);
});
test('recebimentos comuns/fechamentos únicos e resultado positivo, negativo ou zero', () => {
  const original = row('ENTRADA-TESTE', '2031-01-15', 43.21, { kind: 'receipt', source: 'receipts', identity: 'receipt:ENTRADA-TESTE' });
  const moved = { ...original, id: 'ENTRADA-FECHAMENTO-TESTE', source: 'closingReceipts' };
  const other = row('RECEBIMENTO-FORA-TESTE', '2031-01-03', 53.29, { kind: 'receipt', source: 'receipts' });
  const future = row('RECEBIMENTO-FUTURO-TESTE', '2031-01-17', 7, { kind: 'receipt', source: 'receipts' });
  const expense = row('GASTO-TESTE', '2031-01-15', 23.19);
  const value = C.periodBreakdown(state, workId, [original, moved, other, future, expense], period, 0, '2031-01-15', 200);
  assert.equal(value.received, 43.21); assert.equal(value.receiptRows.length, 1); assert.equal(value.result, 20.02);
  assert.equal(value.futureReceived, 7); assert.equal(value.unallocatedReceived, 96.5);
  const negative = C.periodBreakdown(state, workId, [original, row('GASTO-MAIOR-TESTE', '2031-01-15', 71.33)], period, 0, '2031-01-15');
  assert.equal(negative.result, -28.12);
  assert.equal(C.periodBreakdown(state, workId, [original, { ...expense, value: 43.21 }], period, 0, '2031-01-15').result, 0);
  assert.equal(C.periodBreakdown(state, workId, [], period, 0, '2031-01-17').partial, true, 'último dia ainda pode receber lançamentos');
});
test('quinzena parcial: nada posterior a hoje entra no custo realizado', () => {
  const value = C.periodBreakdown(state, workId, ledger, period, 0, '2031-01-15');
  assert.equal(value.totalCost, 184.83); assert.equal(value.partial, true); assert.equal(value.futureCost, 5.17);
  assert.equal(value.through, '2031-01-15');
  const future = C.periodBreakdown(state, workId, ledger, { from: '2031-01-18', to: '2031-01-31' }, 0, '2031-01-15');
  assert.equal(future.totalCost, 0); assert.equal(future.futureCost, 19); assert.equal(future.future, true);
});
test('custos sem data e saldo anterior não são jogados em uma quinzena', () => {
  const value = C.periodBreakdown(state, workId, [...ledger, row('SEM-DATA-TESTE', '', 41)], period, 300, '2031-01-18');
  assert.equal(value.totalCost, 190); assert.equal(value.unallocatedPrior, 84); assert.equal(value.prior, 0);
  assert.ok(value.warnings.length); assert.equal(value.byPhase.find(p => !p.id).total, 22.2);
});
test('período vazio mantém fases com zero; troca de mês, ano e ano bissexto', () => {
  for (const [from, to] of [['2030-12-28', '2031-01-10'], ['2032-02-21', '2032-03-05']]) {
    const empty = C.periodBreakdown(state, workId, [], { from, to }, 79, to);
    assert.equal(empty.totalCost, 0); assert.equal(empty.byPhase.length, 3); assert.equal(empty.unallocatedPrior, 79);
  }
  assert.equal(C.periodBreakdown(state, workId, [row('BISSEXTO-TESTE', '2032-02-29', 31)], { from: '2032-02-21', to: '2032-03-05' }, 0, '2032-03-06').totalCost, 31);
  for (const invalid of [{ from: '2031-02-29', to: '2031-03-05' }, { from: '2031-01-17', to: '2031-01-04' }]) assert.throws(() => C.periodBreakdown(state, workId, ledger, invalid));
});
