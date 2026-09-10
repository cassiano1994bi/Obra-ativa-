import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), C = require('../public-assets/work-cost-core-v1.js');
let sequence = 0;
const ctx = { companyId: 'EMPRESA-FICTICIA-FINANCEIRO', userId: 'USUARIO-FICTICIO', modules: ['works', 'financial'], now: '2031-01-15T12:00:00Z', today: '2031-01-15', id: () => `ID-FICTICIO-${++sequence}` };
const workId = 'OBRA-FICTICIA-FINANCEIRO';
const initial = () => ({ companyId: ctx.companyId, works: [{ id: workId, name: 'OBRA FICTÍCIA', control: { baseline: { asOfDate: '2031-01-01', priorReceived: 0 } } }, { id: 'OUTRA-OBRA-FICTICIA' }], receivables: [{ id: 'CONTRATO-FICTICIO', workId, total: 2347 }], receipts: [], workClosings: [], workUpdates: [], workPhases: [], attendance: [{ id: 'PRESENCA-FICTICIA', status: 'Faltou' }], payments: [{ id: 'PAGAMENTO-FICTICIO', value: 37 }], otherExpenses: [{ id: 'CUSTO-FICTICIO', value: 11 }] });
const addition = { description: 'SERVIÇO EXTRA FICTÍCIO', value: 153.27, date: ctx.today, operationId: 'ADITIVO-FICTICIO' };
const forecast = { value: 431, expectedDate: '2031-01-17', note: 'PARCELA FICTÍCIA', operationId: 'PREVISAO-FICTICIA' };
const receipt = { value: 113, date: ctx.today, method: 'PIX', operationId: 'RECEBIMENTO-FICTICIO' };
test('contrato inicial, aditivo, previsão e dinheiro recebido são independentes e idempotentes', () => {
  const base = initial(), original = JSON.stringify(base);
  let state = C.saveClientAddendum(base, workId, addition, ctx);
  assert.equal(C.clientAgreement(state, workId).value, 2500.27); assert.equal(C.clientAgreement(state, workId).original, 2347);
  assert.equal(C.clientPosition(state, workId).received, 0); assert.equal(C.clientForecasts(state, workId).planned, 0);
  assert.equal(C.saveClientAddendum(state, workId, addition, ctx), state);
  state = C.saveClientForecast(state, workId, forecast, ctx);
  assert.equal(C.clientAgreement(state, workId).value, 2500.27); assert.equal(C.clientPosition(state, workId).received, 0);
  assert.equal(C.saveClientForecast(state, workId, forecast, ctx), state);
  const closingId = state.workClosings[0].id;
  state = C.saveClientReceipt(state, workId, { ...receipt, closingId }, ctx);
  assert.equal(state.receipts.length, 0); assert.equal(state.workClosings[0].receipts.length, 1);
  assert.equal(C.clientPosition(state, workId).received, 113); assert.equal(C.clientPosition(state, workId).remaining, 2387.27);
  assert.equal(C.clientForecasts(state, workId).pending, 318); assert.equal(C.saveClientReceipt(state, workId, receipt, ctx), state);
  state = C.saveClientReceipt(state, workId, { ...receipt, value: 17.13, operationId: 'AVULSO-FICTICIO' }, ctx);
  assert.equal(state.receipts.length, 1); assert.equal(C.clientPosition(state, workId).received, 130.13);
  assert.equal(C.clientForecasts(state, workId).pending, 318, 'avulso não quita previsão sem vínculo');
  state = C.saveClientForecast(state, workId, { ...forecast, id: closingId, value: 459, expectedDate: '2031-01-31', operationId: 'EDICAO-FICTICIA' }, ctx);
  assert.equal(state.workClosings.length, 1); assert.equal(state.workClosings[0].receipts.length, 1);
  assert.equal(C.clientForecasts(state, workId, { from: '2031-01-04', to: '2031-01-17' }).planned, 0);
  assert.equal(C.clientForecasts(state, workId, { from: '2031-01-18', to: '2031-01-31' }).pending, 346);
  for (const key of ['attendance', 'payments', 'otherExpenses', 'workPhases']) assert.deepEqual(state[key], base[key]);
  assert.equal(JSON.stringify(base), original);
});
test('previsões não inflacionam contratos antigos; aditivos preservados ao editar valor inicial', () => {
  let state = initial(); state.receivables = []; state.workClosings = [{ id: 'ANTIGO-FICTICIO', workId, value: 353, expectedDate: '2031-01-17', receipts: [] }];
  state = C.saveClientAddendum(state, workId, addition, ctx);
  assert.equal(C.clientAgreement(state, workId).original, 353);
  state = C.saveClientContract(state, workId, { total: 700 + addition.value, operationId: 'INICIAL-EDITADO-FICTICIO' }, ctx);
  assert.equal(C.clientAgreement(state, workId).original, 700); assert.equal(C.clientAgreement(state, workId).added, addition.value);
  state = C.saveClientForecast(state, workId, { ...forecast, value: 107 }, ctx);
  assert.equal(C.clientAgreement(state, workId).value, 853.27);
  assert.throws(() => C.saveClientContract(state, workId, { total: 1, operationId: 'MENOR-FICTICIO' }, ctx), /aditivos/);
});
test('leitura por obra inclui fontes antigas, ausência de data, marcos e recibos migrados uma vez', () => {
  const state = initial(); state.receipts = [
    { id: 'ANTIGO-FICTICIO', workId, value: 113, date: '2031-01-14' },
    { id: 'SEM-DATA-FICTICIO', workId, value: 29 },
    { id: 'OUTRO-FICTICIO', workId: 'OUTRA-OBRA-FICTICIA', value: 67, date: '2031-01-14' }];
  state.workClosings = [{ id: 'MIGRACAO-FICTICIA', workId, value: 211, receipts: [{ id: 'COPIA-FICTICIA', sourceReceiptId: 'ANTIGO-FICTICIO', value: 113, date: '2031-01-14' }, { id: 'NOVO-FICTICIO', value: 31, date: '2031-01-15' }] }];
  assert.equal(C.clientPosition(state, workId).received, 173); assert.equal(C.clientPosition(state, workId).undated, 29);
  assert.equal(C.clientPosition(state, 'OUTRA-OBRA-FICTICIA').received, 67);
  assert.equal(C.clientReceiptRows(state, workId).length, 3);
  assert.equal(C.periodBreakdown(state, workId, C.clientReceiptRows(state, workId), { from: '2031-01-04', to: '2031-01-17' }, 0, ctx.today, 173).received, 144, 'sem data não ganha quinzena inventada');
  state.works[0].control.baseline.priorReceived = 701;
  assert.equal(C.clientPosition(state, workId).received, 845, 'marco anterior preservado sem somar recibos desconhecidos em dobro');
  assert.equal(C.clientPosition(state, workId).undatedNeedsReview, true);
  state.receipts.push({ id: 'EMPRESA-ERRADA-FICTICIA', companyId: 'OUTRA-EMPRESA-FICTICIA', workId, value: 103, date: ctx.today });
  assert.equal(C.clientPosition(state, workId).received, 845);
  assert.equal(C.clientPosition({ ...state, receipts: [], workClosings: [], works: [{ id: workId }] }, workId).received, 0, 'só contrato não cria dinheiro recebido');
});
test('recusa valores, datas, duplicação por reenvio, excesso e acesso de outra empresa', () => {
  let state = initial(); state = C.saveClientForecast(state, workId, forecast, ctx);
  const closingId = state.workClosings[0].id;
  for (const save of [(s, c) => C.saveClientAddendum(s, workId, addition, c), (s, c) => C.saveClientForecast(s, workId, { ...forecast, operationId: 'OUTRA-PREVISAO-FICTICIA' }, c), (s, c) => C.saveClientReceipt(s, workId, receipt, c)]) {
    assert.throws(() => save(state, { ...ctx, readOnly: true }), /acesso/);
    assert.throws(() => save(state, { ...ctx, modules: ['works'] }), /acesso/);
    assert.throws(() => save(state, { ...ctx, companyId: 'OUTRA-EMPRESA-FICTICIA' }), /empresa/);
    assert.throws(() => save({ ...state, works: state.works.map(w => ({ ...w, archived: true })) }, ctx), /encerrada/);
  }
  for (const value of [-1, 0, 1.001, NaN, Infinity, 'abc']) {
    assert.throws(() => C.saveClientAddendum(state, workId, { ...addition, value }, ctx));
    assert.throws(() => C.saveClientReceipt(state, workId, { ...receipt, value }, ctx));
  }
  assert.throws(() => C.saveClientReceipt(state, workId, { ...receipt, value: 3000 }, ctx), /saldo/);
  assert.throws(() => C.saveClientReceipt(state, workId, { ...receipt, closingId, value: 433 }, ctx), /previsão/);
  assert.throws(() => C.saveClientReceipt(state, workId, { ...receipt, closingId: 'OUTRA-FICTICIA' }, ctx), /obra/);
  assert.throws(() => C.saveClientReceipt(state, workId, { ...receipt, date: '2031-01-16' }, ctx), /data real/);
  assert.throws(() => C.saveClientForecast(state, workId, { ...forecast, value: 2347, operationId: 'EXCESSO-FICTICIO' }, ctx), /saldo/);
  assert.throws(() => C.saveClientForecast(state, workId, { ...forecast, expectedDate: '2031-02-30', operationId: 'DATA-FICTICIA' }, ctx), /data/);
});
