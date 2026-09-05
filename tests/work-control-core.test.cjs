const assert = require('node:assert/strict');
const { test } = require('node:test');
const core = require('../public-assets/work-control-core-v1.js');
let sequence = 0;
const ctx = () => ({ companyId: 'EMPRESA-TESTE', userId: 'USUARIO-TESTE', userName: 'GESTOR FICTÍCIO', now: '2031-01-15T12:00:00Z', today: '2031-01-15', id: () => `FICTICIO-${++sequence}`, modules: ['works', 'planning', 'financial'] });
const fixture = () => ({ companyId: 'EMPRESA-TESTE', works: [], employees: [{ id: 'PESSOA-TESTE', daily: 17, name: 'PESSOA FICTÍCIA' }], attendance: [], distributions: [], workPhases: [], workUpdates: [], workMedia: [], payments: [], receipts: [], otherExpenses: [] });
const workFixture = () => ({ ...fixture(), works: [{ id: 'OBRA-TESTE', name: 'OBRA FICTÍCIA', status: 'Em andamento' }] });
const phaseFixture = () => core.savePhase(workFixture(), 'OBRA-TESTE', { name: 'ETAPA FICTÍCIA', percent: 10, status: 'Em andamento' }, ctx()).state;
const row = (id, value, kind = 'labor', extra = {}) => ({ id, source: 'FONTE-TESTE', workId: 'OBRA-TESTE', date: '2031-01-15', value, kind, ...extra });
test('zero automático de uma pasta antiga não vira medição confirmada',()=>{
  const folder={percent:0,status:'Não iniciada',startDate:''};
  assert.equal(core.progress([folder]).value,null);assert.equal(folder.percent,0);
  assert.equal(core.progress([{...folder,controlVersion:1}]).value,0);
});
test('plano atual pode evoluir sem sobrescrever o marco inicial nem inventar valores apagados',()=>{
  const saved=core.saveWork(workFixture(),{id:'OBRA-TESTE',name:'OBRA FICTÍCIA',baseline:{entry:'new',contractValue:171,budgetValue:79}},ctx()).state;
  const initial=JSON.stringify(saved.works[0].control.baseline);
  const changed=core.saveWork(saved,{id:'OBRA-TESTE',name:'OBRA FICTÍCIA',plan:{contractValue:193,budgetValue:null}},ctx()).state;
  assert.equal(JSON.stringify(changed.works[0].control.baseline),initial);assert.equal(core.financialSummary(changed,'OBRA-TESTE',[],ctx()).contract,193);
  assert.equal(core.financialSummary(changed,'OBRA-TESTE',[],ctx()).budget,null);
  assert.throws(()=>core.saveWork(saved,{id:'OBRA-TESTE',name:'OBRA FICTÍCIA',plan:{budgetValue:99}},{...ctx(),modules:['works']}),/financeiros/);
});
test('custo ignora origem declarada de outra empresa e não conta falta como dia de trabalho',()=>{
  const state=phaseFixture(),phaseId=state.workPhases[0].id;
  const result=core.costSummary(state,'OBRA-TESTE',[row('OUTRA',31,'labor',{companyId:'OUTRA-EMPRESA-TESTE',phaseId,units:1}),row('FALTA',0,'labor',{units:0,phaseId})],ctx());
  assert.equal(result.costs.total,0);assert.equal(result.phaseCosts[0].days,0);assert.equal(result.phaseCosts[0].people,0);
  assert.equal(core.day('2031-99-99'),false);
});
test('benchmark precisa de comparação e usa datas reais e resultados conhecidos',()=>{
  const state=workFixture();state.works[0].control={baseline:{startedAt:'2031-01-01',entry:'new',priorCost:0,priorReceived:0,contractValue:171}};
  state.workPhases=[{id:'FASE-A-TESTE',workId:'OBRA-TESTE',name:'FASE FICTÍCIA',status:'Concluída',percent:100,startDate:'2031-01-01',endDate:'2031-01-05'}];
  assert.equal(core.benchmark(state,[row('CUSTO-A',31)],ctx()).fastest,null);
  state.works.push({id:'OBRA-B-TESTE',name:'OBRA B FICTÍCIA',control:{baseline:{startedAt:'2031-01-01',entry:'new',priorCost:0,priorReceived:0,contractValue:193}}});
  state.workPhases.push({id:'FASE-B-TESTE',workId:'OBRA-B-TESTE',name:'FASE FICTÍCIA',status:'Concluída',percent:100,startDate:'2031-01-01',endDate:'2031-01-09'});
  const result=core.benchmark(state,[row('CUSTO-A',31),row('CUSTO-B',79,'material',{workId:'OBRA-B-TESTE'})],ctx());
  assert.equal(result.fastest.workId,'OBRA-TESTE');assert.equal(result.profit.workId,'OBRA-TESTE');assert.equal(result.cost.workId,'OBRA-B-TESTE');
});
test('fase 1: marco opcional preserva desconhecidos, zero e todos os registros antigos', () => {
  const state = fixture(), original = JSON.stringify(state);
  const { state: next, workId } = core.saveWork(state, { name: 'OBRA FICTÍCIA', baseline: { entry: 'ongoing', priorReceived: 0, priorCost: '', contractValue: 127, startedAt: '2030-12-01' } }, ctx());
  const base = next.works[0].control.baseline;
  assert.equal(base.priorReceived, 0); assert.equal(base.priorCost, null); assert.equal(base.approximateStart, false);
  assert.equal(JSON.stringify(state), original); assert.equal(next.workUpdates[0].workId, workId);
  assert.throws(() => core.saveWork(next, { id: workId, name: 'TESTE', baseline: {} }, ctx()), /já está registrado/);
});
test('fase 5: pagamento não duplica custo, mesma origem conta uma vez e fase não é inventada', () => {
  const state = phaseFixture(), phaseId = state.workPhases[0].id;
  const labor = row('CUSTO-TESTE', 8.5, 'labor', { employeeId: 'PESSOA-TESTE', phaseId, units: 0.5 });
  const result = core.costSummary(state, 'OBRA-TESTE', [labor, labor, row('PAGAMENTO-TESTE', 8.5, 'payment'), row('MATERIAL-TESTE', 13, 'material'), row('OUTRA-EMPRESA', 91, 'labor', { workId: 'OUTRA-OBRA' })], ctx());
  assert.equal(result.costs.total, 21.5); assert.equal(result.labor, 8.5); assert.equal(result.phaseCosts[0].personDays, 0.5); assert.equal(result.unassigned, 13);
});
test('fase 5: marco e lançamentos anteriores são conciliados sem somar duas vezes', () => {
  const state = core.saveWork(workFixture(), { id: 'OBRA-TESTE', name: 'OBRA FICTÍCIA', baseline: { entry: 'ongoing', priorCost: 51, asOfDate: '2031-01-13' } }, ctx()).state;
  const result = core.costSummary(state, 'OBRA-TESTE', [row('ANTIGO-TESTE', 21, 'labor', { date: '2031-01-12' }), row('NOVO-TESTE', 17)], ctx());
  assert.equal(result.costs.total, 68); assert.equal(result.costs.unitemized, 30);
  const unknown = core.reconcile([row('REG-TESTE', 21)], null, '2031-01-13');
  assert.equal(unknown.initial, null); assert.equal(unknown.missingHistory, true);
});
test('fase 3: registra autoria, delta e correção; repetição não duplica atualização', () => {
  const state = phaseFixture(), phaseId = state.workPhases[0].id;
  const next = core.updateProgress(state, 'OBRA-TESTE', phaseId, { percent: 41, note: 'OBSERVAÇÃO FICTÍCIA', operationId: 'ENVIO-TESTE' }, ctx());
  const entry = next.workUpdates.at(-1); assert.equal(entry.delta, 31); assert.equal(entry.actorId, 'USUARIO-TESTE');
  assert.equal(entry.createdAt, ctx().now); assert.equal(core.updateProgress(next, 'OBRA-TESTE', phaseId, { percent: 41, operationId: 'ENVIO-TESTE' }, ctx()), next);
  assert.throws(() => core.updateProgress(next, 'OBRA-TESTE', phaseId, { percent: 12, operationId: 'CORRECAO-TESTE' }, ctx()), /corrigir/);
  const corrected = core.updateProgress(next, 'OBRA-TESTE', phaseId, { percent: 12, operationId: 'CORRECAO-TESTE', correction: true, note: 'CORREÇÃO FICTÍCIA' }, ctx());
  assert.equal(corrected.workUpdates.at(-1).delta, -29); assert.equal(corrected.workUpdates.at(-1).correction, true);
});
test('fase 4: seleção por pessoa usa a mesma escala e não cria presença ou pagamento', () => {
  const state = phaseFixture(), phaseId = state.workPhases[0].id;
  const next = core.schedulePhases(state, 'OBRA-TESTE', ctx().today, [{ employeeId: 'PESSOA-TESTE', phaseId }], ctx());
  assert.equal(next.distributions.length, 1); assert.equal(next.distributions[0].phaseId, phaseId);
  const again = core.schedulePhases(next, 'OBRA-TESTE', ctx().today, [{ employeeId: 'PESSOA-TESTE', phaseId: '' }], ctx());
  assert.equal(again.distributions.length, 1); assert.equal(again.distributions[0].id, next.distributions[0].id);
  assert.equal(again.attendance.length, 0); assert.equal(again.payments.length, 0);
});
test('fase 2: amplia a fase original e preserva fotos, flags e ID', () => {
  const state = workFixture(); state.workPhases = [{ id: 'FASE-TESTE', workId: 'OBRA-TESTE', name: 'ETAPA FICTÍCIA', percent: 12, showPublic: true, legacyData: 'PRESERVAR' }];
  state.workMedia = [{ id: 'FOTO-TESTE', phaseId: 'FASE-TESTE' }];
  const next = core.savePhase(state, 'OBRA-TESTE', { id: 'FASE-TESTE', name: 'ETAPA FICTÍCIA AJUSTADA', percent: 23, status: 'Pausada' }, ctx()).state;
  assert.equal(next.workPhases.length, 1); assert.equal(next.workPhases[0].legacyData, 'PRESERVAR'); assert.equal(next.workPhases[0].showPublic, true);
  assert.deepEqual(next.workMedia, state.workMedia); assert.equal(next.workUpdates[0].delta, 11);
  const templated = core.addTemplate(next, 'OBRA-TESTE', 'renovation', ctx());
  assert.equal(core.addTemplate(templated, 'OBRA-TESTE', 'renovation', ctx()).workPhases.length, templated.workPhases.length);
});
test('fase 2: rejeita cronologia, status e vinculação incoerentes', () => {
  for (const input of [{ status: 'Concluída', percent: 20 }, { status: 'Em andamento', percent: 100 }, { status: 'Programada', percent: 30 }, { plannedStart: '2031-02-05', plannedEnd: '2031-01-05' }, { weight: 0 }]) {
    assert.throws(() => core.savePhase(workFixture(), 'OBRA-TESTE', { name: 'FASE FICTÍCIA', ...input }, ctx()));
  }
});
test('fase 1: valida dinheiro, datas, equipe e acesso antes de modificar', () => {
  for (const baseline of [{ contractValue: -1 }, { entry: 'ongoing', startedAt: '2031-02-01' }, { teamIds: ['PESSOA-OUTRA-EMPRESA'] }, { asOfDate: '2031-02-30' }]) {
    assert.throws(() => core.saveWork(fixture(), { name: 'TESTE', baseline }, ctx()));
  }
  assert.throws(() => core.saveWork(fixture(), { name: 'TESTE' }, { ...ctx(), readOnly: true }), /acesso/);
  assert.throws(() => core.saveWork(fixture(), { name: 'TESTE' }, { ...ctx(), companyId: 'OUTRA-EMPRESA-TESTE' }), /outra empresa/);
});
test('fase 6: toda nota tem fórmula e dados ausentes não viram saúde perfeita', () => {
  const empty = core.overview(workFixture(), 'OBRA-TESTE', [], ctx());
  for (const key of ['general', 'finance', 'schedule', 'efficiency']) { assert.equal(empty.health[key].value, null); assert.ok(empty.health[key].explanation); }
  const phases = [{ percent: 25, weight: 1, plannedStart: '2031-01-01', plannedEnd: '2031-01-29' }];
  const health = core.indicators(phases, null, '2031-01-15'); assert.equal(health.schedule.value, 50); assert.equal(health.general.value, null);
  assert.equal(core.progress([{ percent: 100 }, { percent: '' }]).value, null);
});
test('fase 7: contrato, orçado, recebimento e saldo ficam separados', () => {
  const state = core.saveWork(workFixture(), { id: 'OBRA-TESTE', name: 'OBRA FICTÍCIA', baseline: { entry: 'new', contractValue: 177, budgetValue: 131 } }, ctx()).state;
  const finance = core.financialSummary(state, 'OBRA-TESTE', [row('REC-TESTE', 73, 'receipt'), row('CUSTO-TESTE', 19)], ctx());
  assert.equal(finance.contract, 177); assert.equal(finance.budget, 131); assert.equal(finance.outstanding, 104); assert.equal(finance.cash, 54);
});
test('fase 8: equipe vem da escala de hoje, atraso das datas, sem inventar funcionários', () => {
  const state = phaseFixture(); Object.assign(state.workPhases[0], { plannedEnd: '2031-01-13' });
  state.distributions = [{ workId: 'OBRA-TESTE', date: ctx().today, employeeId: 'PESSOA-TESTE' }, { workId: 'OBRA-TESTE', date: '2031-01-14', employeeId: 'PESSOA-ANTIGA-TESTE' }];
  const model = core.overview(state, 'OBRA-TESTE', [], ctx()); assert.equal(model.team.length, 1); assert.equal(model.late.length, 1);
});
test('fase 9: previsão exige histórico datado e não atravessa uma correção regressiva', () => {
  let state = phaseFixture(); const id = state.workPhases[0].id; state.workPhases[0].createdAt = '2030-12-01T12:00:00Z';
  for (const [i, d, value] of [[1, '2031-01-01', 15], [2, '2031-01-08', 25], [3, '2031-01-15', 35]]) state = core.updateProgress(state, 'OBRA-TESTE', id, { percent: value, operationId: `PREVISAO-TESTE-${i}` }, { ...ctx(), today: d, now: `${d}T12:00:00Z` });
  const result = core.overview(state, 'OBRA-TESTE', [], ctx()); assert.equal(result.prediction.sample, 3); assert.equal(result.prediction.remainingDays, 46); assert.equal(result.prediction.confidence, 'Baixa'); assert.equal(result.prediction.projectedCost, null);
  state = core.updateProgress(state, 'OBRA-TESTE', id, { percent: 20, operationId: 'PREVISAO-CORRECAO', correction: true, note: 'CORREÇÃO FICTÍCIA' }, ctx());
  assert.equal(core.overview(state, 'OBRA-TESTE', [], ctx()).prediction.endDate, null);
});
test('fases 10 e 13: estatísticas usam fases concluídas da própria empresa, amostra mínima e variação', () => {
  const state = workFixture();
  state.workPhases = [{ id: 'FASE-TESTE', workId: 'OBRA-TESTE', name: 'FASE FICTÍCIA', status: 'Concluída', startDate: '2031-01-01', endDate: '2031-01-09', plannedEnd: '2031-01-07' }, { id: 'FASE-OUTRA', workId: 'OBRA-OUTRA', name: 'FASE FICTÍCIA', status: 'Concluída', startDate: '2030-01-01', endDate: '2031-01-09' }];
  state.works.push({ id: 'OBRA-OUTRA', companyId: 'OUTRA-EMPRESA-TESTE' });
  const stats = core.historical(state, [], ctx()); assert.equal(stats.length, 1); assert.equal(stats[0].meanDays, 9); assert.equal(stats[0].distinctWorks, 1); assert.equal(stats[0].confidence, 'Baixa'); assert.equal(stats[0].meanCost, null);
});
test('fase 11: histórico filtrado preserva origem, valor e restringe informações financeiras', () => {
  const state = phaseFixture();
  const rows = core.timeline(state, 'OBRA-TESTE', [row('REC-TESTE', 13, 'receipt')], ctx(), 'Financeiro'); assert.equal(rows.length, 1); assert.equal(rows[0].value, 13);
  assert.equal(core.timeline(state, 'OBRA-TESTE', [row('REC-TESTE', 13, 'receipt')], { ...ctx(), modules: ['works'] }, 'Financeiro').length, 0);
});
test('fases 12 e 14: radar mantém obras sem movimento e filtra somente por escolha explícita', () => {
  const state = workFixture(); state.works.push({ id: 'ARQUIVADA-TESTE', name: 'OBRA FICTÍCIA ARQUIVADA', archived: true });
  assert.equal(core.radar(state, [], ctx()).length, 2); assert.equal(core.radar(state, [], ctx(), 'active').length, 1);
  assert.equal(core.radar(state, [], { ...ctx(), modules: ['works'] })[0].finance, null);
});
