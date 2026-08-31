(function assistantActionsCoreModule(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.AssistantActionsCore = api;
})(typeof window !== 'undefined' ? window : null, function assistantActionsCoreFactory() {
  'use strict';

  const ACTION_DEFINITIONS = Object.freeze({
    scale: Object.freeze({ label: 'Preparar escala', modules: ['team', 'planning', 'works'], mode: 'write', reinforced: false }),
    attendance: Object.freeze({ label: 'Preparar presença', modules: ['team', 'planning', 'attendance', 'works'], mode: 'write', reinforced: false }),
    reminder: Object.freeze({ label: 'Sugerir lembrete', modules: ['planning'], mode: 'write', reinforced: false }),
    whatsapp: Object.freeze({ label: 'Preparar lista para WhatsApp', modules: ['team', 'planning', 'works'], mode: 'copy', reinforced: true }),
    report: Object.freeze({ label: 'Preparar relatório', modules: ['reports'], mode: 'navigate', reinforced: false }),
    payments: Object.freeze({ label: 'Preparar pagamentos', modules: ['team', 'attendance', 'payments'], mode: 'navigate', reinforced: true })
  });
  const ATTENDANCE_STATUSES = Object.freeze(['Trabalhou', 'Meio período', 'Faltou', 'Folga', 'Atraso']);
  const iso = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
  const finite = (value) => Number.isFinite(Number(value));
  const number = (value) => finite(value) ? Number(value) : 0;
  const text = (value, max = 300) => String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const multilineText = (value, max = 5000) => String(value == null ? '' : value).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trimEnd()).join('\n').trim().slice(0, max);

  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((result, key) => { result[key] = stable(value[key]); return result; }, {});
  }

  function hash(value) {
    const source = JSON.stringify(stable(value));
    let result = 2166136261;
    for (let index = 0; index < source.length; index += 1) { result ^= source.charCodeAt(index); result = Math.imul(result, 16777619); }
    return `fnv1a-${(result >>> 0).toString(16).padStart(8, '0')}`;
  }

  function relevantState(data, type) {
    const definitions = {
      scale: ['employees', 'works', 'distributions'],
      attendance: ['employees', 'works', 'distributions', 'attendance'],
      reminder: ['works', 'reminders'],
      whatsapp: ['employees', 'works', 'distributions'],
      report: [],
      payments: ['employees', 'attendance', 'payments', 'advances', 'discounts']
    };
    const keys = definitions[type] || [];
    return keys.reduce((result, key) => { result[key] = Array.isArray(data?.[key]) ? data[key] : []; return result; }, {});
  }

  function stateHash(data, type) { return hash(relevantState(data, type)); }
  function activeEmployees(data) { return new Map((data.employees || []).filter((item) => item && item.id && !item.archived && item.status !== 'Inativo').map((item) => [String(item.id), item])); }
  function works(data) { return new Map((data.works || []).filter((item) => item && item.id && !item.archived).map((item) => [String(item.id), item])); }
  function proposalBase({ data, type, companyId, originalRequest, now, id }) {
    if (!ACTION_DEFINITIONS[type]) throw new Error('Tipo de ação não permitido.');
    const createdAt = new Date(now || Date.now()).toISOString();
    return {
      id: text(id || `proposal-${hash(`${companyId}|${type}|${createdAt}|${originalRequest}`)}`, 120),
      companyId: text(companyId, 80),
      type,
      label: ACTION_DEFINITIONS[type].label,
      mode: ACTION_DEFINITIONS[type].mode,
      reinforced: ACTION_DEFINITIONS[type].reinforced,
      originalRequest: text(originalRequest || ACTION_DEFINITIONS[type].label, 500),
      createdAt,
      beforeHash: stateHash(data, type),
      items: [],
      before: [],
      after: [],
      warnings: [],
      values: { total: 0 },
      date: '',
      sourceDate: '',
      workIds: [],
      employeeIds: []
    };
  }

  function buildScaleProposal({ data = {}, companyId = '', originalRequest = '', sourceDate = '', targetDate = '', now, id } = {}) {
    if (!iso(sourceDate) || !iso(targetDate)) throw new Error('Informe datas válidas para a escala.');
    if (sourceDate === targetDate) throw new Error('A data de origem e a data de destino precisam ser diferentes.');
    const proposal = proposalBase({ data, type: 'scale', companyId, originalRequest, now, id });
    const employees = activeEmployees(data), workMap = works(data);
    const targetKeys = new Set((data.distributions || []).filter((item) => item?.date === targetDate).map((item) => String(item.employeeId)));
    const source = (data.distributions || []).filter((item) => item?.date === sourceDate && employees.has(String(item.employeeId)) && workMap.has(String(item.workId)));
    const counts = source.reduce((map, item) => { const key = String(item.employeeId); map.set(key, (map.get(key) || 0) + 1); return map; }, new Map());
    const warned = new Set();
    source.forEach((item) => {
      const employeeId = String(item.employeeId), workId = String(item.workId);
      if (counts.get(employeeId) > 1) { if (!warned.has(employeeId)) proposal.warnings.push(`${employees.get(employeeId)?.name || 'Funcionário'} possui mais de uma obra na data de origem e não foi incluído automaticamente.`); warned.add(employeeId); return; }
      if (targetKeys.has(employeeId)) return;
      proposal.items.push({ employeeId, employeeName: text(employees.get(employeeId)?.name || 'Funcionário', 160), workId, workName: text(workMap.get(workId)?.name || 'Obra', 160), date: targetDate });
    });
    proposal.sourceDate = sourceDate; proposal.date = targetDate;
    proposal.before = proposal.items.map((item) => `${item.employeeName}: sem escala em ${targetDate}`);
    proposal.after = proposal.items.map((item) => `${item.employeeName}: ${item.workName} em ${targetDate}`);
    proposal.employeeIds = proposal.items.map((item) => item.employeeId);
    proposal.workIds = [...new Set(proposal.items.map((item) => item.workId))];
    if (!source.length) proposal.warnings.push('Não existe escala válida na data de origem para preparar a cópia.');
    if (source.length && !proposal.items.length) proposal.warnings.push('A escala de destino já possui registros ou a origem contém atribuições ambíguas.');
    return Object.freeze(proposal);
  }

  function buildAttendanceProposal({ data = {}, companyId = '', originalRequest = '', date = '', now, id } = {}) {
    if (!iso(date)) throw new Error('Informe uma data válida para a presença.');
    const proposal = proposalBase({ data, type: 'attendance', companyId, originalRequest, now, id });
    const employees = activeEmployees(data), workMap = works(data);
    const existing = new Set((data.attendance || []).filter((item) => item?.date === date).map((item) => String(item.employeeId)));
    const scheduled = (data.distributions || []).filter((item) => item?.date === date && employees.has(String(item.employeeId)) && workMap.has(String(item.workId)));
    const counts = scheduled.reduce((map, item) => { const key = String(item.employeeId); map.set(key, (map.get(key) || 0) + 1); return map; }, new Map());
    const warned = new Set();
    scheduled.forEach((item) => {
      const employeeId = String(item.employeeId), workId = String(item.workId);
      if (counts.get(employeeId) > 1) { if (!warned.has(employeeId)) proposal.warnings.push(`${employees.get(employeeId)?.name || 'Funcionário'} possui escala ambígua e não foi incluído.`); warned.add(employeeId); return; }
      if (existing.has(employeeId)) return;
      proposal.items.push({ employeeId, employeeName: text(employees.get(employeeId)?.name || 'Funcionário', 160), workId, workName: text(workMap.get(workId)?.name || 'Obra', 160), date, status: '' });
    });
    proposal.date = date;
    proposal.before = proposal.items.map((item) => `${item.employeeName}: sem presença em ${date}`);
    proposal.after = proposal.items.map((item) => `${item.employeeName}: status aguardando escolha`);
    proposal.employeeIds = proposal.items.map((item) => item.employeeId);
    proposal.workIds = [...new Set(proposal.items.map((item) => item.workId))];
    if (!proposal.items.length) proposal.warnings.push('Não há presença pendente baseada na escala desta data.');
    return Object.freeze(proposal);
  }

  function withAttendanceStatuses(proposal, statuses = {}) {
    if (proposal?.type !== 'attendance') throw new Error('A proposta não é de presença.');
    const items = proposal.items.map((item) => {
      const status = text(statuses[item.employeeId], 40);
      if (!ATTENDANCE_STATUSES.includes(status)) throw new Error(`Escolha um status válido para ${item.employeeName}.`);
      return { ...item, status };
    });
    return Object.freeze({ ...proposal, items, after: items.map((item) => `${item.employeeName}: ${item.status} em ${item.workName}`) });
  }

  function buildReminderProposal({ data = {}, companyId = '', originalRequest = '', title = '', date = '', time = '', workId = '', notes = '', now, id } = {}) {
    const cleanTitle = text(title, 180), cleanWorkId = text(workId, 120);
    if (!cleanTitle || !iso(date)) throw new Error('Informe título e data válidos para o lembrete.');
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) throw new Error('Informe um horário válido.');
    const workMap = works(data);
    if (cleanWorkId && !workMap.has(cleanWorkId)) throw new Error('A obra do lembrete não existe.');
    const proposal = proposalBase({ data, type: 'reminder', companyId, originalRequest, now, id });
    proposal.date = date;
    proposal.items = [{ title: cleanTitle, date, time: String(time || ''), workId: cleanWorkId, workName: text(workMap.get(cleanWorkId)?.name || '', 160), notes: text(notes, 600) }];
    proposal.before = [`Lembrete “${cleanTitle}” ainda não existe`];
    proposal.after = [`Criar lembrete “${cleanTitle}” em ${date}${time ? ` às ${time}` : ''}`];
    proposal.workIds = cleanWorkId ? [cleanWorkId] : [];
    return Object.freeze(proposal);
  }

  function buildWhatsAppProposal({ data = {}, companyId = '', originalRequest = '', date = '', now, id } = {}) {
    if (!iso(date)) throw new Error('Informe uma data válida para a lista.');
    const proposal = proposalBase({ data, type: 'whatsapp', companyId, originalRequest, now, id });
    const employees = activeEmployees(data), workMap = works(data);
    const rows = (data.distributions || []).filter((item) => item?.date === date && employees.has(String(item.employeeId)) && workMap.has(String(item.workId)));
    const grouped = new Map();
    rows.forEach((item) => {
      const workId = String(item.workId), names = grouped.get(workId) || [];
      names.push(text(employees.get(String(item.employeeId))?.name || 'Funcionário', 160)); grouped.set(workId, names);
    });
    const lines = [`ESCALA DE ${date}`];
    grouped.forEach((names, workId) => { lines.push('', workMap.get(workId)?.name || 'OBRA', ...names.map((name) => `- ${name}`)); });
    proposal.date = date;
    proposal.message = multilineText(lines.join('\n'), 5000);
    proposal.items = rows.map((item) => ({ employeeId: String(item.employeeId), employeeName: text(employees.get(String(item.employeeId))?.name || 'Funcionário', 160), workId: String(item.workId), workName: text(workMap.get(String(item.workId))?.name || 'Obra', 160), date }));
    proposal.before = ['Nenhuma mensagem será enviada automaticamente.'];
    proposal.after = [`Copiar uma lista com ${proposal.items.length} pessoa(s) para a área de transferência.`];
    proposal.employeeIds = [...new Set(proposal.items.map((item) => item.employeeId))];
    proposal.workIds = [...new Set(proposal.items.map((item) => item.workId))];
    if (!rows.length) proposal.warnings.push('Não existe escala nesta data para montar a lista.');
    return Object.freeze(proposal);
  }

  function buildReportProposal({ data = {}, companyId = '', originalRequest = '', reportType = 'weekly', now, id } = {}) {
    const allowed = new Set(['daily', 'weekly', 'fortnightly', 'financial', 'payments', 'work', 'team', 'employee', 'vehicles', 'performance']);
    const selected = allowed.has(String(reportType)) ? String(reportType) : 'weekly';
    const proposal = proposalBase({ data, type: 'report', companyId, originalRequest, now, id });
    proposal.reportType = selected;
    proposal.before = ['Nenhum relatório será salvo ou publicado.'];
    proposal.after = ['Abrir a área oficial de relatórios inteligentes para gerar a prévia.'];
    return Object.freeze(proposal);
  }

  function buildPaymentsProposal({ data = {}, companyId = '', originalRequest = '', cycleDate = '', payrollRows = [], selectedEmployeeIds = [], now, id } = {}) {
    if (!iso(cycleDate)) throw new Error('Informe um ciclo de pagamento válido.');
    const selected = new Set(selectedEmployeeIds.map(String));
    const proposal = proposalBase({ data, type: 'payments', companyId, originalRequest, now, id });
    proposal.date = cycleDate;
    proposal.items = payrollRows.filter((row) => selected.has(String(row.employeeId)) && number(row.balance) > 0).map((row) => ({ employeeId: String(row.employeeId), employeeName: text(row.employeeName, 160), value: Math.round(number(row.balance) * 100) / 100, cycleDate }));
    proposal.values.total = Math.round(proposal.items.reduce((sum, item) => sum + item.value, 0) * 100) / 100;
    proposal.before = proposal.items.map((item) => `${item.employeeName}: saldo pendente de R$ ${item.value.toFixed(2)}`);
    proposal.after = ['Abrir a tela oficial de pagamentos. Nenhum pagamento será registrado pela Assistente.'];
    proposal.employeeIds = proposal.items.map((item) => item.employeeId);
    proposal.warnings.push('A confirmação desta proposta não registra pagamento: a quitação continuará exigindo o botão oficial na área Pagamentos da equipe.');
    return Object.freeze(proposal);
  }

  function validateProposal(proposal, { requireReady = false } = {}) {
    if (!proposal || !ACTION_DEFINITIONS[proposal.type] || !proposal.id || !proposal.companyId || !proposal.beforeHash) throw new Error('Proposta inválida.');
    if (!Array.isArray(proposal.items) || proposal.items.length > 100) throw new Error('Quantidade de registros inválida.');
    if (requireReady && ['scale', 'attendance', 'reminder', 'whatsapp', 'payments'].includes(proposal.type) && !proposal.items.length) throw new Error('A proposta não possui registros para confirmar.');
    if (proposal.type === 'attendance' && requireReady && proposal.items.some((item) => !ATTENDANCE_STATUSES.includes(item.status))) throw new Error('Todos os status de presença precisam ser escolhidos.');
    if (proposal.type === 'payments' && proposal.items.some((item) => !finite(item.value) || item.value <= 0)) throw new Error('A lista de pagamentos contém valor inválido.');
    return proposal;
  }

  function validateProposalForState(data, proposal, currentCompanyId) {
    validateProposal(proposal, { requireReady: true });
    if (String(proposal.companyId) !== String(currentCompanyId)) throw new Error('A proposta pertence a outra empresa.');
    if (stateHash(data, proposal.type) !== proposal.beforeHash) throw new Error('Os dados mudaram depois da prévia. Prepare a ação novamente.');
    const employeeMap = activeEmployees(data), workMap = works(data);
    if ((proposal.employeeIds || []).some((id) => !employeeMap.has(String(id)))) throw new Error('A proposta contém funcionário indisponível.');
    if ((proposal.workIds || []).some((id) => !workMap.has(String(id)))) throw new Error('A proposta contém obra indisponível.');
    return proposal;
  }

  function applyConfirmedProposal({ data, proposal, confirmation, currentCompanyId, currentUserId, now, uid }) {
    validateProposalForState(data, proposal, currentCompanyId);
    if (!confirmation || confirmation.proposalId !== proposal.id || confirmation.companyId !== String(currentCompanyId) || confirmation.userId !== String(currentUserId) || confirmation.actionType !== proposal.type) throw new Error('A confirmação segura não corresponde à proposta.');
    if (!confirmation.expiresAt || Date.parse(confirmation.expiresAt) <= Date.now()) throw new Error('A confirmação segura expirou. Prepare a ação novamente.');
    if (proposal.type === 'payments' && confirmation.reinforced !== true) throw new Error('A confirmação reforçada do pagamento não foi concluída.');
    if (proposal.type === 'whatsapp' && confirmation.reinforced !== true) throw new Error('A confirmação reforçada da cópia não foi concluída.');
    const createId = typeof uid === 'function' ? uid : () => `assistant-${hash(`${Date.now()}|${Math.random()}`)}`;
    const at = new Date(now || Date.now()).toISOString();
    const affected = [];
    if (proposal.type === 'scale') {
      data.distributions = Array.isArray(data.distributions) ? data.distributions : [];
      const keys = new Set();
      proposal.items.forEach((item) => { const key = `${item.employeeId}|${item.date}`; if (keys.has(key) || data.distributions.some((row) => row?.employeeId === item.employeeId && row?.date === item.date)) throw new Error('Uma escala foi alterada antes da confirmação.'); keys.add(key); });
      proposal.items.forEach((item) => { const record = { id: createId(), employeeId: item.employeeId, workId: item.workId, date: item.date, createdAt: at, source: 'assistant-confirmed', assistantProposalId: proposal.id }; data.distributions.push(record); affected.push({ collection: 'distributions', id: record.id, employeeId: item.employeeId, workId: item.workId, date: item.date }); });
    } else if (proposal.type === 'attendance') {
      data.attendance = Array.isArray(data.attendance) ? data.attendance : [];
      const keys = new Set();
      proposal.items.forEach((item) => { const key = `${item.employeeId}|${item.date}`; if (keys.has(key) || data.attendance.some((row) => row?.employeeId === item.employeeId && row?.date === item.date)) throw new Error('Uma presença foi alterada antes da confirmação.'); keys.add(key); });
      proposal.items.forEach((item) => { const record = { id: createId(), employeeId: item.employeeId, workId: item.workId, date: item.date, status: item.status, manual: false, createdAt: at, registeredAt: at, source: 'assistant-confirmed', assistantProposalId: proposal.id, statusHistory: [{ at, status: item.status, action: 'Confirmação explícita pela Assistente da Obra' }] }; data.attendance.push(record); affected.push({ collection: 'attendance', id: record.id, employeeId: item.employeeId, workId: item.workId, date: item.date, status: item.status }); });
    } else if (proposal.type === 'reminder') {
      data.reminders = Array.isArray(data.reminders) ? data.reminders : [];
      proposal.items.forEach((item) => { const record = { id: createId(), title: item.title, date: item.date, time: item.time || '', workId: item.workId || '', notes: item.notes || '', status: 'pending', createdAt: at, source: 'assistant-confirmed', assistantProposalId: proposal.id }; data.reminders.push(record); affected.push({ collection: 'reminders', id: record.id, date: item.date, workId: item.workId || '' }); });
    } else {
      proposal.items.forEach((item) => affected.push({ collection: proposal.type === 'payments' ? 'payments-preview' : proposal.type === 'whatsapp' ? 'clipboard-preview' : 'report-preview', employeeId: item.employeeId || '', workId: item.workId || '', date: item.date || proposal.date || '', value: item.value || null }));
    }
    data.assistantActionAudit = Array.isArray(data.assistantActionAudit) ? data.assistantActionAudit : [];
    const audit = { id: createId(), companyId: String(currentCompanyId), userId: String(currentUserId), at, originalRequest: proposal.originalRequest, actionType: proposal.type, actionProposed: proposal.label, proposalId: proposal.id, confirmationId: confirmation.id, confirmation: confirmation.reinforced ? 'explícita reforçada' : 'explícita por botão', result: 'confirmada', affectedRecords: affected, before: proposal.before.slice(0, 100), after: proposal.after.slice(0, 100) };
    data.assistantActionAudit.unshift(audit);
    return Object.freeze({ ok: true, audit, affectedRecords: Object.freeze(affected), dataChanged: ['scale', 'attendance', 'reminder'].includes(proposal.type) });
  }

  return Object.freeze({ ACTION_DEFINITIONS, ATTENDANCE_STATUSES, stateHash, buildScaleProposal, buildAttendanceProposal, withAttendanceStatuses, buildReminderProposal, buildWhatsAppProposal, buildReportProposal, buildPaymentsProposal, validateProposal, validateProposalForState, applyConfirmedProposal });
});
