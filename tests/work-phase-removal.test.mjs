import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const W = createRequire(import.meta.url)('../public-assets/work-control-core-v1.js');
let n = 0; const workId = 'OBRA-FICTICIA-EXCLUSAO';
const ctx = { companyId: 'EMPRESA-FICTICIA-EXCLUSAO', userId: 'USUARIO-FICTICIO', modules: ['works', 'financial'], now: '2031-01-15T12:00:00Z', today: '2031-01-15', id: () => `EXCLUSAO-FICTICIA-${++n}` };
const fixture = () => ({ companyId: ctx.companyId, works: [{ id: workId, name: 'OBRA FICTÍCIA', status: 'Em andamento' }], workPhases: [
  { id: 'PRONTA-FICTICIA', workId, name: 'FASE PRONTA FICTÍCIA', percent: 100, status: 'Concluída', controlVersion: 1, endDate: '2031-01-10', weight: 1, order: 1 },
  { id: 'NAO-INICIADA-FICTICIA', workId, name: 'FASE NÃO INICIADA FICTÍCIA', percent: 0, status: 'Não iniciada', controlVersion: 1, weight: 1, order: 2 }],
  workUpdates: [{ id: 'HISTORICO-FICTICIO', workId, phaseId: 'NAO-INICIADA-FICTICIA', controlEvent: true }], workMedia: [{ id: 'FOTO-FICTICIA', workId, phaseId: 'NAO-INICIADA-FICTICIA' }], receipts: [{ id: 'RECEBIDO-FICTICIO', workId, value: 19 }], otherExpenses: [{ id: 'CUSTO-FICTICIO', workId, phaseId: 'NAO-INICIADA-FICTICIA', value: 17 }], distributions: [{ id: 'ESCALA-FICTICIA', workId, phaseId: 'NAO-INICIADA-FICTICIA' }] });
test('excluir fase incompleta não transforma 50% em 100% nem registra conclusão', () => {
  const base = fixture(), before = JSON.stringify(base), next = W.deletePhase(base, workId, 'NAO-INICIADA-FICTICIA', ctx);
  assert.equal(W.workProgress(base, workId).value, 50); assert.equal(W.workProgress(next, workId).value, 50);
  assert.equal(W.workProgress(next, workId).needsReview, true); assert.equal(W.workProgress(next, workId).calculatedValue, 100);
  assert.equal(W.overview(next, workId, [], ctx).physical.value, 50);
  assert.equal(W.timeline(next, workId, [], ctx).some(row => row.title === 'Todas as fases concluídas'), false);
  assert.deepEqual(next.workPhases[0], base.workPhases[0]); assert.equal(next.works[0].status, 'Em andamento');
  for (const key of ['receipts', 'otherExpenses', 'distributions']) assert.deepEqual(next[key], base[key]);
  assert.deepEqual(next.workUpdates[0], base.workUpdates[0]); assert.equal(next.workMedia.length, 1); assert.equal(next.workMedia[0].phaseId, '');
  assert.equal(next.workUpdates.at(-1).scopeChange, true); assert.equal(next.workUpdates.at(-1).delta, undefined);
  assert.equal(JSON.stringify(base), before);
  const reviewed = W.reviewPhaseRemoval(next, workId, ctx);
  assert.equal(W.workProgress(reviewed, workId).value, 100); assert.equal(W.workProgress(reviewed, workId).needsReview, undefined);
  assert.deepEqual(reviewed.workPhases, next.workPhases); assert.equal(reviewed.workUpdates.at(-1).kind, 'Escopo da obra conferido');
  assert.equal(W.reviewPhaseRemoval(reviewed, workId, ctx), reviewed);
});
test('exclusões consecutivas, pesos e última fase mantêm histórico sem falso avanço', () => {
  const base = fixture(); base.workPhases[0].weight = 3;
  let next = W.deletePhase(base, workId, 'NAO-INICIADA-FICTICIA', ctx);
  assert.equal(W.workProgress(next, workId).value, 75);
  next = W.deletePhase(next, workId, 'PRONTA-FICTICIA', ctx);
  assert.equal(W.workProgress(next, workId).value, null); assert.equal(next.workPhases.length, 0);
  assert.equal(next.works[0].status, 'Em andamento'); assert.equal(next.workUpdates.filter(e => e.kind === 'Fase excluída').length, 2);
});
test('subetapa não muda a média; acesso negado, obra finalizada e fase estrangeira não alteram dados', () => {
  const base = fixture(); base.workPhases.push({ id: 'SUBETAPA-FICTICIA', name: 'SUBETAPA FICTÍCIA', workId, parentPhaseId: 'PRONTA-FICTICIA', controlVersion: 1, percent: 0, order: 3 });
  const original = JSON.stringify(base);
  assert.equal(W.workProgress(W.deletePhase(base, workId, 'SUBETAPA-FICTICIA', ctx), workId).needsReview, undefined);
  assert.throws(() => W.deletePhase(base, workId, 'PRONTA-FICTICIA', ctx), /subetapas/);
  assert.throws(() => W.deletePhase(base, workId, 'SUBETAPA-FICTICIA', { ...ctx, readOnly: true }), /acesso/);
  assert.throws(() => W.deletePhase(base, workId, 'SUBETAPA-FICTICIA', { ...ctx, modules: ['financial'] }), /acesso/);
  assert.throws(() => W.deletePhase(base, workId, 'SUBETAPA-FICTICIA', { ...ctx, companyId: 'OUTRA-FICTICIA' }), /empresa/);
  const final = structuredClone(base); final.works[0].status = 'Finalizada'; assert.throws(() => W.deletePhase(final, workId, 'SUBETAPA-FICTICIA', ctx), /Reabra/);
  assert.equal(JSON.stringify(base), original);
});
