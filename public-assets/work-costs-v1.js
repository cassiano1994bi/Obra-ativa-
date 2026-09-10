(function () {
  'use strict';
  const C = window.ObraAtivaWorkCostCore, control = window.ObraAtivaWorkControl;
  if (!C || !control || window.ObraAtivaWorkCosts) return;
  const list = (v) => Array.isArray(v) ? v : [], h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cash = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));
  const dateLabel = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v.split('-').reverse().join('/') : 'Não informado';
  const q = (selector) => document.querySelector(selector), sum = (rows) => Math.round(rows.reduce((total, row) => total + Number(row.value || 0), 0) * 100) / 100;
  const editable = (workId, works = false) => control.canEdit('financial') && (!works || control.canEdit('works')) && !workById(workId)?.archived && workById(workId)?.status !== 'Finalizada';
  const phaseName = (workId, id) => list(db.workPhases).find((row) => row.workId === workId && row.id === id)?.name || 'Sem fase definida';
  const options = (rows, value) => rows.map(([id, label]) => `<option value="${h(id)}" ${id === value ? 'selected' : ''}>${h(label)}</option>`).join('');
  const phaseOptions = (workId, selected) => options([['', 'Sem fase definida'], ...list(db.workPhases).filter((row) => row.workId === workId).map((row) => [row.id, row.name])], selected);
  const input = (name, label, value = '', type = 'text', extra = '') => `<label class="oa-cost-field"><span>${h(label)}</span><input name="${name}" type="${type}" value="${h(value)}" ${extra}></label>`;
  const select = (name, label, markup, extra = '') => `<label class="oa-cost-field"><span>${h(label)}</span><select name="${name}" ${extra}>${markup}</select></label>`;
  function error(message) { const element = q('#oaCostError'); if (element) { element.textContent = message; element.hidden = false; element.scrollIntoView({ block: 'nearest' }); } else window.alert(message); }
  function snapshot(workId, model) {
    return control.readMemo ? control.readMemo('costSnapshot', workId, () => calculateSnapshot(workId, model)) : calculateSnapshot(workId, model);
  }
  function calculateSnapshot(workId, model) {
    model ??= control.model(workId);
    const companyId = control.context().companyId;
    const result = C.breakdown(db, workId, control.ledger().filter((row) => !row.companyId || row.companyId === companyId), model?.finance?.costs?.total);
    const position = C.clientPosition(db, workId);
    const received = position.received;
    const client = C.clientContract(db, workId);
    const discount = typeof receivableDiscountTotal === 'function' ? Number(receivableDiscountTotal(workId) || 0) : 0;
    const expected = client.value == null ? (typeof workCashExpected === 'function' ? workCashExpected(workId) : Number(model?.finance?.outstanding || 0)) : Math.max(0, Math.round((client.value - received - discount) * 100) / 100);
    return { ...result, received, expected, undatedReceived: position.undated, receivedNeedsReview: position.undatedNeedsReview, labor: result.daily, contract: client.value, contractSource: client.source,
      otherCosts: result.extras + result.contractPaid + result.prior, balanceAfterCosts: received - result.totalCost,
      estimated: client.value == null ? null : client.value - result.totalCost - result.commitment };
  }
  function dialog(title, workId, markup, onSubmit, label = 'Salvar') {
    if (!editable(workId)) return;
    const operationId = uid(), openedContext = control.context();
    q('#dialog').innerHTML = `<section class="oa-cost-dialog"><header><small>${h(workById(workId)?.name)}</small><h2>${h(title)}</h2></header><form id="oaCostForm"><div class="oa-cost-fields">${markup}</div><p id="oaCostError" role="alert" hidden></p><footer><button type="button" class="btn alt" onclick="closeModal()">Cancelar</button><button type="submit" class="btn">${h(label)}</button></footer></form></section>`;
    q('#modal').classList.remove('work-media-viewer'); q('#modal').classList.add('show');
    const form = q('#oaCostForm'); let saving = false;
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (saving || !form.reportValidity()) return;
      saving = true; const button = form.querySelector('[type=submit]'); button.disabled = true; button.textContent = 'Salvando…';
      try {
        if (openedContext.companyId !== control.context().companyId || openedContext.userId !== control.context().userId) throw Error('A conta ou empresa mudou. Reabra este formulário na obra correta.');
        await onSubmit(Object.fromEntries(new FormData(form)), operationId, form); closeModal(); render();
      }
      catch (problem) { error(problem.message || 'Não foi possível salvar. Nenhum lançamento foi substituído.'); }
      finally { saving = false; button.disabled = false; button.textContent = label; }
    });
    form.querySelector('input,select')?.focus({ preventScroll: true });
  }
  function save(next, action, workId, works = false) {
    if (works && !control.canEdit('works')) throw Error('Seu perfil não permite alterar a contratação da obra.');
    control.commit(next, action, workById(workId)?.name || '', 'financial');
  }
  function confirmPossibleDuplicate(workId, values, kind, id = '') {
    const key = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
    const candidates = kind === 'contract' ? C.contracts(db, workId).filter(row => row.id !== id && key(row.name) === key(values.name)) :
      list(db.otherExpenses).filter(row => row.workId === workId && row.date === values.date && Number(row.value) === Number(values.value));
    if (candidates.length && !window.confirm(kind === 'contract' ?
      'Já existe uma empreita com esse nome nesta obra. Deseja cadastrar mesmo assim? O registro anterior será preservado.' :
      `Já há um gasto de ${cash(values.value)} nesta obra em ${dateLabel(values.date)}. Confira se não é o mesmo pagamento. Deseja registrar outro lançamento?`)) {
      throw Error('Nenhum novo lançamento foi salvo. Confira o histórico antes de continuar.');
    }
  }
  function contractForm(workId, id = '') {
    if (!editable(workId, true)) return;
    const current = C.contracts(db, workId).find((row) => row.id === id) || {};
    const people = list(db.employees).filter((row) => !row.archived || row.id === current.employeeId);
    dialog(id ? 'Editar empreita' : 'Nova empreita', workId,
      input('name', 'Qual é o serviço?', current.name, 'text', 'required maxlength="160" placeholder="Ex.: assentamento do piso"') +
      select('employeeId', 'Responsável', options([['', 'Empreiteiro não cadastrado na equipe'], ...people.map((row) => [row.id, row.name])], current.employeeId || '')) +
      `<div data-cost-responsible>${input('responsible', 'Nome do empreiteiro', current.responsible, 'text', 'maxlength="160"')}</div>` +
      select('phaseId', 'Fase da obra', phaseOptions(workId, current.phaseId || '')) +
      select('mode', 'Como foi combinado?', options([['fixed', 'Valor fechado'], ['meters', 'Por metragem']], current.mode || 'fixed')) +
      `<div data-cost-meters>${select('unit', 'Unidade de medida', options([['', 'Escolha: m², metro linear ou m³'], ['m²', 'Metro quadrado (m²)'], ['m', 'Metro linear (m)'], ['m³', 'Metro cúbico (m³)']], current.unit || ''))}${input('quantity', 'Quantidade medida', current.quantity, 'number', 'min="0.001" step="0.001"')}${input('unitPrice', 'Valor por unidade (R$)', current.unitPrice, 'number', 'min="0.01" step="0.01"')}</div>` +
      `<div data-cost-fixed>${input('total', 'Valor total contratado (R$)', current.total, 'number', 'min="0.01" step="0.01"')}</div>` +
      '<output class="oa-cost-total" id="oaContractTotal" aria-live="polite"></output>' +
      input('start', 'Data de início (opcional)', current.start, 'date') + input('end', 'Previsão de término (opcional)', current.end, 'date') +
      '<p class="oa-cost-hint"><b>Depois de salvar:</b> em Equipe e escala, selecione esta empreita nos dias do serviço. Assim a presença não gera diária. Quem ainda não está na Equipe precisa ser cadastrado para registrar presença.</p>',
      (values, operationId) => { confirmPossibleDuplicate(workId, values, 'contract', id); const result = C.saveContract(db, workId, { ...values, id, operationId }, control.context()); save(result.state, id ? 'Empreita atualizada' : 'Empreita criada', workId, true); }, 'Salvar empreita');
    const form = q('#oaCostForm'); if (!form) return;
    const update = () => {
      const meters = form.elements.mode.value === 'meters', external = !form.elements.employeeId.value;
      q('[data-cost-responsible]').hidden = !external; form.elements.responsible.required = external;
      q('[data-cost-meters]').hidden = !meters; q('[data-cost-fixed]').hidden = meters;
      for (const name of ['quantity', 'unitPrice', 'unit']) { form.elements[name].disabled = !meters; form.elements[name].required = meters; }
      form.elements.total.disabled = meters; form.elements.total.required = !meters;
      const total = meters ? Number(form.elements.quantity.value) * Number(form.elements.unitPrice.value) : Number(form.elements.total.value);
      q('#oaContractTotal').hidden = !meters;
      q('#oaContractTotal').textContent = `Total calculado: ${cash(total)}`;
    };
    form.addEventListener('input', update); form.addEventListener('change', update); update();
  }
  function clientContractForm(workId) {
    const values = snapshot(workId), agreement = C.clientAgreement(db, workId);
    dialog('Valor do contrato da obra', workId,
      input('total', 'Valor inicial combinado com o cliente (R$)', agreement.original ?? '', 'number', 'required min="0" max="1000000000000" step="0.01"') +
      `<p class="oa-cost-hint">É o orçamento aprovado pelo cliente para a obra inteira. <b>Não é um recebimento e não é o custo da obra.</b> Serviços extras combinados depois entram pelo botão Aditivo.${agreement.added ? ` Aditivos já registrados: <b>${cash(agreement.added)}</b>, somados automaticamente ao valor inicial.` : ''} Já recebido: <b>${cash(values.received)}</b>, preservado.</p><output class="oa-cost-total" id="oaClientRemaining" aria-live="polite"></output>`,
      (input, operationId) => save(C.saveClientContract(db, workId, { total: Math.round((Number(input.total) + C.clientAgreement(db, workId).added) * 100) / 100, operationId }, control.context()), 'Contrato do cliente atualizado', workId), 'Salvar contrato');
    const form = q('#oaCostForm'); if (!form) return;
    const update = () => {
      const total = Number(form.elements.total.value) + agreement.added, discount = typeof receivableDiscountTotal === 'function' ? Number(receivableDiscountTotal(workId) || 0) : 0;
      q('#oaClientRemaining').textContent = form.elements.total.value === '' ? 'Falta receber: informe o contrato primeiro.' : `Contrato atualizado: ${cash(total)} · Falta receber no total: ${cash(Math.max(0, total - values.received - discount))}${total < values.received + discount ? ' · Atenção: o total é menor que os recebimentos e descontos já registrados.' : ''}`;
    };
    form.addEventListener('input', update); update();
  }
  function addendumForm(workId) {
    const agreement = C.clientAgreement(db, workId);
    if (agreement.value == null) { window.alert('Informe primeiro o valor inicial da obra. Depois registre o serviço extra como aditivo.'); return clientContractForm(workId); }
    dialog('Adicionar serviço ao contrato', workId,
      input('description', 'Qual serviço extra o cliente aprovou?', '', 'text', 'required maxlength="160" placeholder="Ex.: construção da área de serviço"') +
      input('value', 'Valor adicional combinado (R$)', '', 'number', 'required min="0.01" step="0.01"') +
      input('date', 'Data do acordo', today(), 'date', `required max="${today()}"`) +
      '<p class="oa-cost-hint"><b>O aditivo aumenta o contrato da obra.</b> Não registra dinheiro recebido nem custo. Quando o cliente pagar, use Registrar recebimento.</p><output class="oa-cost-total" id="oaAddendumTotal" aria-live="polite"></output>',
      (values, operationId) => {
        const duplicate = C.clientAgreement(db, workId).addenda.some(row => row.date === values.date && Number(row.value) === Number(values.value) && row.description.trim().toLocaleLowerCase('pt-BR') === values.description.trim().toLocaleLowerCase('pt-BR'));
        if (duplicate && !window.confirm('Já existe um aditivo com esse serviço, valor e data. Deseja registrar outro? O anterior será preservado.')) throw Error('Nenhum novo aditivo foi salvo. Confira o histórico.');
        save(C.saveClientAddendum(db, workId, { ...values, operationId }, control.context()), 'Aditivo do cliente registrado', workId);
      }, 'Salvar aditivo');
    const form = q('#oaCostForm'); if (!form) return;
    const update = () => { q('#oaAddendumTotal').textContent = `Contrato atual: ${cash(agreement.value)} → com este aditivo: ${cash(agreement.value + Number(form.elements.value.value || 0))}`; };
    form.addEventListener('input', update); update();
  }
  function forecastForm(workId, id = '', expectedDate = '') {
    const position = C.clientPosition(db, workId, today()), forecasts = C.clientForecasts(db, workId, null, today());
    if (position.value == null) { window.alert('Informe primeiro o contrato. A previsão é a parte que o cliente combinou pagar em uma data.'); return clientContractForm(workId); }
    const current = forecasts.rows.find(row => row.id === id) || {};
    dialog(id ? 'Editar previsão de recebimento' : 'Prever recebimento do cliente', workId,
      input('value', 'Quanto o cliente combinou pagar nessa data? (R$)', current.value ?? '', 'number', 'required min="0.01" step="0.01"') +
      input('expectedDate', 'Data combinada para receber', current.expectedDate || expectedDate || today(), 'date', 'required') +
      input('note', 'Referência (opcional)', current.note || '', 'text', 'maxlength="2000" placeholder="Ex.: parcela da quinzena"') +
      `<p class="oa-cost-hint"><b>Previsão não é dinheiro recebido.</b> É uma parte do contrato, não um aditivo. Falta receber na obra: <b>${cash(position.remaining)}</b>. As previsões já cadastradas continuam preservadas.${current.received ? ` Já recebido nesta previsão: <b>${cash(current.received)}</b>.` : ''}</p>`,
      (values, operationId) => {
        const duplicate = C.clientForecasts(db, workId).rows.some(row => row.id !== id && row.expectedDate === values.expectedDate && Number(row.value) === Number(values.value));
        if (duplicate && !window.confirm('Já existe uma previsão com esse valor e data. Deseja registrar outra?')) throw Error('Nenhuma nova previsão foi salva. Confira as existentes.');
        save(C.saveClientForecast(db, workId, { ...values, id, operationId }, control.context()), 'Previsão de recebimento salva', workId);
      }, 'Salvar previsão');
  }
  function receiptForm(workId, closingId = '') {
    const position = C.clientPosition(db, workId, today()), forecasts = C.clientForecasts(db, workId, null, today()).rows.filter(row => row.id && row.pending > 0);
    if (position.value == null) { window.alert('Informe primeiro o contrato da obra. Depois registre o pagamento do cliente.'); return clientContractForm(workId); }
    dialog('Registrar recebimento do cliente', workId,
      `<p class="oa-cost-hint"><b>Use somente quando o dinheiro já entrou.</b> Falta receber no total: <b>${cash(position.remaining)}</b>.</p>` +
      (forecasts.length ? select('closingId', 'Ligar a uma previsão (opcional)', options([['', 'Sem previsão (avulso)'], ...forecasts.map(row => [row.id, `${dateLabel(row.expectedDate)} · falta ${cash(row.pending)}${row.note ? ` · ${row.note}` : ''}`])], closingId)) : '') +
      input('value', 'Valor que o cliente pagou agora (R$)', '', 'number', `required min="0.01" max="${position.remaining}" step="0.01"`) +
      input('date', 'Data em que recebeu', today(), 'date', `required max="${today()}"`) +
      select('method', 'Forma de recebimento', options(['PIX', 'Dinheiro', 'Transferência', 'Outro'].map(value => [value, value]), 'PIX')) +
      input('note', 'Observação (opcional)', '', 'text', 'maxlength="2000"') +
      '<p class="oa-cost-hint">Entrará no recebido da obra e na quinzena da data informada. Não é necessário lançar novamente em Finanças.</p>',
      (values, operationId) => {
        if (C.clientReceiptRows(db, workId).some(row => row.date === values.date && row.value === Number(values.value)) && !window.confirm('Já há um recebimento com esse valor e data nesta obra. Deseja registrar outro pagamento?')) throw Error('Nenhum novo recebimento foi salvo. Confira o histórico.');
        save(C.saveClientReceipt(db, workId, { ...values, operationId }, control.context()), 'Recebimento do cliente registrado', workId);
      }, 'Confirmar recebimento');
    const form = q('#oaCostForm'); if (!form?.elements.closingId) return;
    const update = () => { form.elements.value.max = Math.min(position.remaining, forecasts.find(row => row.id === form.elements.closingId.value)?.pending ?? position.remaining); };
    form.elements.closingId.addEventListener('change', update); update();
  }
  function clientAgreementMarkup(workId) {
    const agreement = C.clientAgreement(db, workId);
    return `<details class="oa-cost-client-agreement oa-cost-history"><summary>Ver valor inicial e aditivos (${agreement.addenda.length})</summary><div><span><b>Valor inicial aprovado pelo cliente</b><small>Orçamento combinado para a obra, não é dinheiro recebido</small></span><strong>${agreement.original == null ? 'Não informado' : cash(agreement.original)}</strong></div>${agreement.addenda.map(row => `<div><span><b>${h(row.description)}</b><small>Aditivo · ${dateLabel(row.date)}</small></span><strong>+ ${cash(row.value)}</strong></div>`).join('') || '<p>Nenhum aditivo registrado. Novos serviços aprovados pelo cliente podem ser acrescentados pelo botão Aditivo.</p>'}<div><span><b>Contrato atualizado</b><small>Valor inicial + aditivos</small></span><strong>${agreement.value == null ? 'Não informado' : cash(agreement.value)}</strong></div></details>`;
  }
  function clientForecastMarkup(workId, period = null) {
    const forecasts = C.clientForecasts(db, workId, period, today());
    return `<section class="oa-cost-client-forecast" aria-label="Previsão de recebimento"><header><div><h3>${period ? 'Combinado para receber nesta quinzena' : 'Previsões de recebimento do cliente'}</h3><p>Parte do contrato com uma data combinada. Só entra no resultado quando você registra o pagamento recebido.</p></div>${editable(workId) ? `<button type="button" class="btn alt" data-oa-cost-action="forecast" data-work="${h(workId)}" data-date="${h(period?.to || '')}">Informar previsão</button>` : ''}</header><div class="oa-work-hub-cost-composition"><article><small>COMBINADO PARA RECEBER</small><b data-oa-client-planned>${cash(forecasts.planned)}</b><span>${period ? 'Previsões com data nesta quinzena' : 'Soma das previsões cadastradas'}</span></article><article><small>FALTA RECEBER DESSAS PREVISÕES</small><b data-oa-client-pending>${cash(forecasts.pending)}</b><span>Desconta só os pagamentos vinculados a elas</span></article></div><details class="oa-cost-history"><summary>Ver previsões (${forecasts.rows.length})</summary>${forecasts.rows.map(row => `<div><span><b>${dateLabel(row.expectedDate)}${row.pending > 0 && row.expectedDate < today() ? ' · Em atraso' : row.pending === 0 ? ' · Recebida' : ''}</b><small>${h(row.note || 'Recebimento combinado')}${!row.clientForecast ? ' · Fechamento já cadastrado' : ''}</small><small>Combinado: ${cash(row.value)} · Recebido: ${cash(row.received)} · Falta: ${cash(row.pending)}</small>${editable(workId) && row.id ? `<span class="oa-cost-forecast-actions"><button type="button" class="btn alt" data-oa-cost-action="forecast" data-work="${h(workId)}" data-id="${h(row.id)}">Editar previsão</button>${row.pending > 0 ? `<button type="button" class="btn" data-oa-cost-action="client-receipt" data-work="${h(workId)}" data-id="${h(row.id)}">Registrar recebimento</button>` : ''}</span>` : ''}</span></div>`).join('') || '<p>Nenhuma previsão cadastrada para este período. O valor do contrato continua separado em Total da obra.</p>'}</details></section>`;
  }
  function paymentForm(workId, id) {
    const contract = C.contracts(db, workId).find((row) => row.id === id); if (!contract) return;
    const totals = C.totals(db, workId, id);
    dialog('Registrar pagamento', workId, `<div class="oa-cost-form-summary"><b>${h(contract.name)}</b><span>${h(contract.responsible)}</span><strong>Saldo a pagar: ${cash(totals.outstanding)}</strong></div>` +
      input('value', 'Valor deste pagamento (R$)', '', 'number', `required min="0.01" max="${totals.outstanding}" step="0.01"`) +
      input('date', 'Data do pagamento', today(), 'date', `required max="${today()}"`) +
      select('phaseId', 'Fase deste pagamento', phaseOptions(workId, contract.phaseId || '')) +
      input('note', 'Observação (opcional)', '', 'text', 'maxlength="2000" placeholder="Ex.: pagamento da quinzena"') +
      '<p class="oa-cost-hint">Registre somente o valor que já foi pago. O restante continua como compromisso a pagar.</p>',
      (values, operationId) => { confirmPossibleDuplicate(workId, values, 'expense'); save(C.savePayment(db, workId, id, { ...values, operationId }, control.context()), 'Pagamento de empreita', workId); }, 'Registrar pagamento');
  }
  async function proofImage(file) {
    if (!file?.size) return null;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw Error('Escolha uma foto JPG, PNG ou WebP com até 10 MB.');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const canvas = document.createElement('canvas'), ratio = Math.min(1, 960 / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * ratio)); canvas.height = Math.max(1, Math.round(img.height * ratio));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL('image/jpeg', .75);
      if (data.length > 220000) data = canvas.toDataURL('image/jpeg', .45);
      if (data.length > 220000) throw Error('A foto ainda está muito grande. Recorte o comprovante e tente novamente.');
      return { name: file.name, data };
    } finally { URL.revokeObjectURL(url); }
  }
  function extraForm(workId) {
    dialog('Registrar custo extra', workId,
      select('category', 'Qual foi o custo?', options(C.categories.map((name) => [name, name]), 'Combustível')) +
      `<div data-cost-custom hidden>${input('customCategory', 'Nome do custo', '', 'text', 'maxlength="80" placeholder="Digite o tipo de gasto"')}</div>` +
      input('value', 'Valor pago (R$)', '', 'number', 'required min="0.01" step="0.01"') +
      input('date', 'Data do gasto', today(), 'date', `required max="${today()}"`) +
      select('phaseId', 'Fase da obra (opcional)', phaseOptions(workId, '')) +
      '<p class="oa-cost-hint">Escolha a fase para acompanhar o gasto nela. Sem fase, ele entra no total da obra. Pagou uma empreita? Registre em Empreitas, sem lançar novamente aqui.</p>' +
      input('description', 'Descrição / observação (opcional)', '', 'text', 'maxlength="2000"') +
      '<details class="oa-cost-proof-field"><summary>Anexar comprovante (opcional)</summary><label class="oa-cost-field"><span>Foto JPG, PNG ou WebP</span><input type="file" name="proofFile" accept="image/jpeg,image/png,image/webp"></label><small>A imagem será compactada. Não é uma galeria da obra.</small></details>',
      async (values, operationId, form) => { confirmPossibleDuplicate(workId, values, 'expense'); const before = control.context(), proof = await proofImage(form.elements.proofFile.files[0]); if (before.companyId !== control.context().companyId || before.userId !== control.context().userId) throw Error('A conta ou empresa mudou. Reabra o formulário.'); save(C.saveExtra(db, workId, { ...values, proof, operationId }, control.context()), 'Custo extra registrado', workId); }, 'Registrar custo extra');
    const form = q('#oaCostForm'); if (!form) return;
    form.elements.category.addEventListener('change', () => { const custom = form.elements.category.value === 'Outro'; q('[data-cost-custom]').hidden = !custom; form.elements.customCategory.required = custom; });
  }
  function contractSelect(workId, personId, selected = '', disabled = false) {
    const records = C.contracts(db, workId);
    if (!records.length && !selected) return '';
    const items = [['', 'Diária (pela presença)'], ...records.map((row) => [row.id, `Empreita · ${row.name}`])];
    if (selected && !records.some((row) => row.id === selected)) items.push([selected, 'Empreita anterior — vínculo preservado']);
    const hasAgreement = records.some(row => row.employeeId === personId);
    return `<label class="oa-cost-schedule"><span>Tipo de trabalho neste dia</span><select data-oa-contract-person="${h(personId)}" aria-label="Contratação de ${h(emp(personId)?.name)}" ${disabled ? 'disabled' : ''}>${options(items, selected)}</select></label>${hasAgreement && !selected ? '<small class="oa-cost-mode-hint">Esta pessoa tem empreita cadastrada. Se trabalhar nela neste dia, selecione-a acima para não gerar diária.</small>' : ''}`;
  }
  function contractsMarkup(work) {
    const totals = C.totals(db, work.id), records = C.contracts(db, work.id);
    return `<section class="oa-cost-contracts"><div class="oa-work-hub-section-title"><div><small>EMPREITAS</small><h2>Serviços contratados nesta obra</h2><p>Por metragem ou valor fechado. Pague aos poucos e acompanhe o saldo.</p></div>${editable(work.id, true) ? `<button type="button" class="btn" data-oa-cost-action="contract" data-work="${h(work.id)}">Nova empreita</button>` : ''}</div>
      <div class="oa-cost-all-contracts"><p>Total de todas as empreitas desta obra (${records.length})</p><div class="oa-cost-summary"><article><small>TOTAL CONTRATADO</small><b>${cash(totals.contracted)}</b></article><article><small>TOTAL JÁ PAGO</small><b>${cash(totals.paid)}</b></article><article><small>TOTAL A PAGAR</small><b>${cash(totals.outstanding)}</b></article></div></div>
      <div class="oa-cost-contract-list">${records.map((row) => {
        const values = C.totals(db, work.id, row.id), payments = C.payments(db, work.id, row.id).slice().sort((a, b) => b.date.localeCompare(a.date));
        return `<article class="oa-cost-contract" data-contract-id="${h(row.id)}">
          <header><div><small>${h(row.responsible)}</small><h3>${h(row.name)}</h3><p>${h(phaseName(work.id, row.phaseId))}</p></div><span class="oa-cost-status">${values.outstanding <= 0 ? 'Pago' : 'A pagar'}</span></header>
          <p class="oa-cost-contract-mode">${row.mode === 'meters' ? `${h(row.quantity)} ${h(row.unit || 'metros (unidade anterior)')} × ${cash(row.unitPrice)}` : 'Valor fechado'}<span>Início: ${dateLabel(row.start)} · Término: ${dateLabel(row.end)}</span></p>
          <div class="oa-cost-summary"><article><small>ESTA EMPREITA</small><b>${cash(row.total)}</b></article><article><small>JÁ PAGO</small><b>${cash(values.paid)}</b></article><article><small>FALTA PAGAR</small><b>${cash(values.outstanding)}</b></article></div>
          <footer>${editable(work.id) && values.outstanding > 0 ? `<button type="button" class="btn" data-oa-cost-action="payment" data-work="${h(work.id)}" data-id="${h(row.id)}">Registrar pagamento</button>` : ''}${editable(work.id, true) ? `<button type="button" class="btn alt" data-oa-cost-action="contract" data-work="${h(work.id)}" data-id="${h(row.id)}">Editar empreita</button>` : ''}</footer>
          <details class="oa-cost-history"><summary>Histórico de pagamentos (${payments.length})</summary>${payments.length ? payments.map((p) => `<div><span><b>${dateLabel(p.date)}</b><small>${h(phaseName(work.id, p.phaseId))}${p.note ? ` · ${h(p.note)}` : ''}</small></span><strong>${cash(p.value)}</strong></div>`).join('') : '<p>Nenhum pagamento registrado.</p>'}</details>
        </article>`;
      }).join('') || '<div class="oa-cost-empty"><h3>Nenhuma empreita nesta obra ainda</h3><p>Combine o serviço e o valor. Depois registre cada pagamento aqui.</p></div>'}</div></section>`;
  }
  function phaseCostsMarkup(workId, values = snapshot(workId)) {
    return `<details class="oa-cost-phase-breakdown"><summary>Ver gastos por fase</summary><div class="oa-cost-phase-list">${values.byPhase.map((p) => `<article><h3>${h(p.name)}</h3><dl><div><dt>Diárias</dt><dd>${cash(p.daily)}</dd></div><div><dt>Empreitas pagas</dt><dd>${cash(p.contractPaid)}</dd></div><div><dt>Custos extras</dt><dd>${cash(p.extras)}</dd></div>${!p.id && values.prior > 0 ? `<div><dt>Custo anterior preservado</dt><dd>${cash(values.prior)}</dd></div>` : ''}<div class="oa-cost-phase-total"><dt>Total gasto</dt><dd>${cash(p.total)}</dd></div></dl></article>`).join('')}</div></details>`;
  }
  function financialHistoryMarkup(workId) {
    const model = control.model(workId), ledger = list(model?.finance?.rows);
    const represented = new Set(ledger.map((row) => row.id));
    const rows = ledger.map((row) => ({ id: `ledger:${row.source}:${row.id}`, date: row.date,
      title: row.kind === 'receipt' ? 'Recebimento do cliente' : row.kind === 'labor' ? 'Diária confirmada' : row.costType === 'contractPayment' ? `Pagamento de empreita · ${row.label || ''}` : row.category || 'Custo extra',
      detail: row.label || row.note || '', phaseId: row.phaseId, value: row.value, receipt: row.kind === 'receipt', expenseId: row.source === 'otherExpenses' ? row.id : '' }));
    const receiptIdentities = new Set(ledger.filter(row => row.kind === 'receipt').map(row => row.identity || `receipt:${row.id}`));
    for (const receipt of C.clientReceiptRows(db, workId)) if (!receiptIdentities.has(receipt.identity)) {
      rows.push({ id: receipt.identity, date: receipt.date, title: 'Recebimento do cliente', detail: receipt.note || receipt.notes || 'Registro anterior preservado', value: receipt.value, receipt: true });
      represented.add(receipt.id);
    }
    // O lançamento já está no financeiro: não repetir seu evento de auditoria como outro gasto.
    for (const event of list(db.workUpdates).filter((row) => row.workId === workId && row.financialEvent && !represented.has(row.expenseId) && !represented.has(row.receiptId))) rows.push({ id: `event:${event.id}`, date: event.date, title: event.title ?? event.kind, detail: event.description || '', phaseId: event.phaseId, value: event.value, event: true });
    rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    return `<details class="oa-cost-history" data-oa-finance-history><summary>Ver histórico da obra (${rows.length})</summary>${rows.map((row) => {
      // Compatibilidade de leitura: registros anteriores podem não ter título ou descrição textual.
      // Normaliza somente a apresentação, sem editar, excluir ou contabilizar o registro de novo.
      const title = String(row.title ?? '').trim() || 'Registro financeiro';
      const detail = String(row.detail ?? '');
      const proof = row.expenseId && list(db.otherExpenses).find((expense) => expense.id === row.expenseId && expense.workId === workId)?.proof;
      return `<div><span><b>${h(title)}</b><small>${dateLabel(row.date)}${row.receipt ? '' : ` · ${h(phaseName(workId, row.phaseId))}`}${detail && !title.includes(detail) ? ` · ${h(detail)}` : ''}</small>${row.event ? '<small>Registro do acordo — não é outro gasto</small>' : ''}${proof ? `<button class="btn alt" type="button" data-oa-cost-action="proof" data-work="${h(workId)}" data-id="${h(row.expenseId)}">Ver comprovante</button>` : ''}</span>${row.value != null ? `<strong>${row.event ? '' : row.receipt ? '+ ' : '− '}${cash(row.value)}</strong>` : ''}</div>`;
    }).join('') || '<p>Nenhum lançamento nesta obra ainda.</p>'}</details>`;
  }
  function expenses() {
    const ledger = control.ledger().filter((row) => row.kind !== 'receipt' && (!row.companyId || row.companyId === control.context().companyId));
    if (typeof financeAttendanceLaborRows === 'function') for (const row of financeAttendanceLaborRows().filter((r) => r.unassigned && r.confirmed && r.paymentMode !== 'contract')) {
      ledger.push({ id: `${row.employee.id}|${row.attendance.date}`, identity: `attendance:${row.employee.id}|${row.attendance.date}`, source: 'attendance', kind: 'labor', workId: row.work.id, date: row.attendance.date, value: row.value, label: row.employee.name });
    }
    const ids = [...new Set(ledger.map((row) => row.workId))];
    const rows = ids.flatMap((id) => window.ObraAtivaWorkCore.ledgerFor(ledger, id).rows);
    for (const work of list(db.works)) { const prior = snapshot(work.id).prior; if (prior > 0) rows.push({ id: `baseline:${work.id}`, workId: work.id, date: work.control?.baseline?.asOfDate, value: prior, category: 'Custos anteriores', label: work.name }); }
    return rows.map((row) => ({ ...row, category: row.kind === 'labor' ? 'Mão de obra por diária' : row.costType === 'contractPayment' ? 'Empreita paga' : row.category || 'Custo extra', reference: `${workById(row.workId)?.name || 'Sem obra atribuída'} · ${row.label || ''}` }));
  }

  // Uma presença de empreita continua no controle de pessoas, mas não gera diária.
  // Recibos migrados para um fechamento conservam o ID de origem: uma entrada, uma vez.
  if (typeof workCashEntries === 'function') { const before = workCashEntries; workCashEntries = function (workId, ...args) { const seen = new Set(); return before(workId, ...args).filter((entry) => { const original = entry.closingId ? list(db.workClosings).find((row) => row.id === entry.closingId && row.workId === workId)?.receipts?.find((row) => row.id === entry.id) : null; const id = original?.sourceReceiptId || entry.id; if (!id) return true; if (seen.has(id)) return false; seen.add(id); return true; }); }; }
  if (typeof amountForPresence === 'function') { const before = amountForPresence; amountForPresence = function (record, employee) { return C.attendanceMode(db, record).paymentMode === 'contract' ? 0 : before(record, employee); }; }
  if (typeof financeAttendanceLaborRows === 'function') { const before = financeAttendanceLaborRows; financeAttendanceLaborRows = function (...args) { const calculate = () => before(...args).map((row) => { const mode = C.attendanceMode(db, row.attendance); return { ...row, ...mode, value: mode.paymentMode === 'contract' ? 0 : row.value }; }); return control.readMemo ? control.readMemo('attendanceLabor', JSON.stringify(args), calculate) : calculate(); }; }
  if (typeof planningDaily === 'function') { const before = planningDaily; planningDaily = function () { const container = document.createElement('div'); container.innerHTML = before(); container.querySelectorAll('[data-wc-plan-person]').forEach((element) => { const personId = element.dataset.wcPlanPerson, assignment = distributionFor(personId, planningDate || tomorrow()); element.insertAdjacentHTML('afterend', contractSelect(planningWorkId, personId, assignment?.workId === planningWorkId ? assignment.contractId || '' : '', !control.canEdit('planning'))); }); return container.innerHTML; }; }
  if (typeof workCashRows === 'function') { const before = workCashRows; workCashRows = function () { const calculate = () => before().map((row) => { if (row.unassigned) return row; const cost = snapshot(row.work.id); return { ...row, ...cost, cash: cost.balanceAfterCosts, forecast: cost.estimated }; }); const read = () => control.readMemo ? control.readMemo('workCashRows', '', calculate) : calculate(); return control.withReadSnapshot ? control.withReadSnapshot(read) : read(); }; }
  if (typeof financeWorkGuideMarkup === 'function') { const before = financeWorkGuideMarkup; financeWorkGuideMarkup = function (row) { if (row.unassigned) return before(row); const values = snapshot(row.work.id), container = document.createElement('div'); container.innerHTML = before(row); let metrics = container.querySelector('.finance-work-guide-metrics'); if (!metrics) { metrics = document.createElement('div'); metrics.className = 'finance-work-guide-metrics'; container.querySelector('.finance-work-guide-toolbar')?.after(metrics); } if (metrics) { metrics.insertAdjacentHTML('beforeend', `<article><small>VALOR DO CLIENTE</small><b>${values.contract == null ? 'Não informado' : cash(values.contract)}</b></article><article><small>EMPREITAS PAGAS</small><b>${cash(values.contractPaid)}</b></article><article><small>CUSTOS EXTRAS</small><b>${cash(values.extras + values.prior)}</b></article><article><small>TOTAL GASTO</small><b>${cash(values.totalCost)}</b></article><article><small>EMPREITAS A PAGAR</small><b>${cash(values.commitment)}</b></article>`); } container.querySelector('.work-cash-history')?.remove(); container.querySelector('section')?.insertAdjacentHTML('beforeend', financialHistoryMarkup(row.work.id)); return container.innerHTML; }; }
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-oa-cost-action]'); if (!button) return;
    event.preventDefault(); const { oaCostAction: action, work, id } = button.dataset;
    try {
      if (!control.context().modules.includes('financial')) return;
      if (action === 'contract') contractForm(work, id || '');
      if (action === 'payment') paymentForm(work, id);
      if (action === 'extra') extraForm(work);
      if (action === 'addendum') addendumForm(work);
      if (action === 'forecast') forecastForm(work, id || '', button.dataset.date || '');
      if (action === 'client-receipt') receiptForm(work, id || '');
      if (action === 'proof') { const row = list(db.otherExpenses).find((r) => r.workId === work && r.id === id), data = row?.proof?.data; if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data || '')) return; q('#dialog').innerHTML = `<section class="oa-cost-dialog"><h2>Comprovante do custo</h2><p>${h(row.category)} · ${cash(row.value)}</p><img class="oa-cost-proof" src="${h(data)}" alt="Comprovante anexado ao custo"><button class="btn" onclick="closeModal()">Fechar</button></section>`; q('#modal').classList.add('show'); }
    } catch (problem) { error(problem.message); }
  });
  window.ObraAtivaWorkCosts = Object.freeze({ snapshot, contractsMarkup, contractSelect, phaseCostsMarkup, financialHistoryMarkup, expenses, contractForm, paymentForm, extraForm, clientContractForm, addendumForm, forecastForm, receiptForm, clientAgreementMarkup, clientForecastMarkup });
})();
