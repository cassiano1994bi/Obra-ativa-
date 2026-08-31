/* Controle de Obra — aba Orçamentos (administração sincronizada)
   Os dados textuais passam pelo salvamento já existente do aplicativo. PDFs
   enviados permanecem neste aparelho até a ativação do armazenamento privado. */
(() => {
  const STATUS = ['Rascunho', 'Em revisão', 'Pronto para envio'];
  let activeId = '';
  let pendingPdf = null;

  const q = (selector) => document.querySelector(selector);
  const escape = (value) => typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  const items = () => { db.budgets ??= []; return db.budgets; };
  const byId = (id) => items().find((item) => item.id === id);
  const moneyValue = (value) => typeof money === 'function' ? money(Number(value || 0)) : `R$ ${Number(value || 0).toFixed(2)}`;
  const today = () => new Date().toISOString().slice(0, 10);
  const nextNumber = () => {
    const prefix = `ORC-${new Date().getFullYear()}-`;
    const last = items().filter((item) => String(item.number || '').startsWith(prefix))
      .map((item) => Number(String(item.number).slice(prefix.length)) || 0)
      .reduce((highest, number) => Math.max(highest, number), 0);
    return `${prefix}${String(last + 1).padStart(3, '0')}`;
  };
  const date = (value) => value && typeof dateBR === 'function' ? dateBR(value) : (value || 'Não definida');

  function saveBudget(action, detail) {
    // save() já atualiza o armazenamento e aciona a sincronização da nuvem.
    save(action, detail);
  }

  function installStyle() {
    if (q('#budgetAdminReleaseStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="budgetAdminReleaseStyle">
      .co-budget{max-width:1180px;margin:0 auto;padding-bottom:38px}.co-budget-head{display:flex;gap:18px;justify-content:space-between;align-items:end;margin-bottom:20px}.co-budget-head h1{margin:0;color:#173b68;font-size:30px}.co-budget-head p{margin:7px 0 0;color:#647b97;line-height:1.5}.co-budget-actions{display:flex;gap:9px;flex-wrap:wrap}.co-budget-note{display:flex;gap:10px;align-items:flex-start;padding:13px 15px;background:#fff8e5;border:1px solid #f3d477;border-radius:13px;color:#725500;font-size:13px;line-height:1.5;margin-bottom:18px}.co-budget-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}.co-budget-metric,.co-budget-card{background:#fff;border:1px solid #e0e9f3;border-radius:16px;box-shadow:0 8px 22px rgba(23,57,99,.05)}.co-budget-metric{padding:14px}.co-budget-metric span{display:block;color:#71829a;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.co-budget-metric strong{display:block;color:#173b68;font-size:25px;margin-top:7px}.co-budget-list{display:grid;gap:12px}.co-budget-card{padding:18px}.co-budget-card-top{display:flex;justify-content:space-between;gap:16px}.co-budget-number{font-size:12px;color:#71829a;font-weight:800;letter-spacing:.04em}.co-budget-card h2{font-size:18px;margin:5px 0;color:#173b68}.co-budget-card p{margin:0;color:#6b8099;line-height:1.5}.co-budget-value{text-align:right;white-space:nowrap;color:#173b68;font-size:22px;font-weight:800}.co-budget-status{display:inline-block;padding:5px 9px;border-radius:999px;background:#edf4fd;color:#235d9e;font-size:11px;font-weight:850;margin-bottom:7px}.co-budget-status.rascunho{background:#eef1f5;color:#5c6a7d}.co-budget-status.pronto-para-envio{background:#e8f7ea;color:#227246}.co-budget-meta{display:flex;gap:9px;flex-wrap:wrap;color:#71829a;font-size:12px;margin-top:13px}.co-budget-card footer{border-top:1px solid #eaf0f6;margin-top:15px;padding-top:13px;display:flex;gap:8px;flex-wrap:wrap}.co-budget-empty{text-align:center;padding:52px 20px;background:#fbfdff;border:1px dashed #cbd9e8;border-radius:17px;color:#657c97}.co-budget-pdf{padding:11px 12px;border-radius:10px;background:#f0f6fd;color:#416481;font-size:13px;line-height:1.45}.co-budget-import{padding:15px;border:1px dashed #aac6e3;border-radius:13px;background:#f7fbff}.co-budget-import b,.co-budget-import small{display:block}.co-budget-import small{margin-top:5px;color:#617a97;line-height:1.45}.co-budget-progress{margin-top:10px;color:#235d9e;font-weight:750;font-size:13px}@media(max-width:760px){.co-budget-head{align-items:stretch;flex-direction:column}.co-budget-actions .btn{flex:1}.co-budget-grid{grid-template-columns:repeat(2,1fr)}.co-budget-card-top{flex-direction:column}.co-budget-value{text-align:left}}
    </style>`);
  }

  function statusClass(status) {
    return String(status || 'Rascunho').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  }

  function metrics() {
    const all = items();
    const count = (status) => all.filter((item) => item.status === status).length;
    const total = all.reduce((sum, item) => sum + Number(item.value || 0), 0);
    return `<section class="co-budget-grid"><article class="co-budget-metric"><span>Rascunhos</span><strong>${count('Rascunho')}</strong></article><article class="co-budget-metric"><span>Em revisão</span><strong>${count('Em revisão')}</strong></article><article class="co-budget-metric"><span>Prontos</span><strong>${count('Pronto para envio')}</strong></article><article class="co-budget-metric"><span>Valor em propostas</span><strong>${moneyValue(total)}</strong></article></section>`;
  }

  function card(item) {
    const canDelete = item.status === 'Rascunho';
    return `<article class="co-budget-card"><div class="co-budget-card-top"><div><div class="co-budget-number">${escape(item.number)} · Versão ${Number(item.version || 1)}</div><h2>Orçamento de execução de obra</h2><p>${escape(item.description || 'Sem descrição.')}</p></div><div class="co-budget-value"><span class="co-budget-status ${statusClass(item.status)}">${escape(item.status || 'Rascunho')}</span><br>${moneyValue(item.value)}</div></div><div class="co-budget-meta"><span>Validade: <b>${date(item.validUntil)}</b></span>${item.updatedAt ? `<span>· Atualizado: ${date(item.updatedAt.slice(0, 10))}</span>` : ''}${item.sourcePdf?.name ? `<span>· PDF local: ${escape(item.sourcePdf.name)}</span>` : ''}</div><footer><button class="btn alt sm" onclick="COBudget.open('${item.id}')">Editar</button>${item.sourcePdf?.name ? `<button class="btn alt sm" onclick="COBudget.openPdf('${item.id}')">Abrir PDF neste aparelho</button>` : ''}${canDelete ? `<button class="btn danger sm" onclick="COBudget.remove('${item.id}')">Excluir rascunho</button>` : ''}</footer></article>`;
  }

  function pageHtml() {
    installStyle();
    const all = [...items()].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    return `<div class="co-budget"><div class="co-budget-head"><div><h1>Orçamentos</h1><p>Organize propostas no mesmo aplicativo e mantenha o histórico comercial da empresa.</p></div><div class="co-budget-actions"><button class="btn alt" onclick="COBudget.model()">Ver modelo oficial</button><button class="btn alt" onclick="COBudget.importPdf()">Importar PDF pronto</button><button class="btn" onclick="COBudget.open()">＋ Novo orçamento</button></div></div><div class="co-budget-note"><span>◈</span><span><b>Links públicos e aceite on-line ainda não foram ativados nesta publicação.</b> Eles só entrarão no ar depois do teste do servidor seguro, para o cliente receber uma proposta real e protegida.</span></div>${metrics()}${all.length ? `<section class="co-budget-list">${all.map(card).join('')}</section>` : `<section class="co-budget-empty"><div style="font-size:34px">▣</div><h2>Seu primeiro orçamento começa aqui</h2><p>Crie a proposta manualmente ou importe um PDF já pronto para preencher valor, escopo, pagamento e validade.</p><button class="btn" onclick="COBudget.open()">Criar orçamento</button></section>`}</div>`;
  }

  function open(id = '') {
    const item = id ? byId(id) : null;
    activeId = id;
    const validity = item?.validUntil || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
    q('#dialog').innerHTML = `<h2>${item ? 'Editar orçamento' : 'Novo orçamento'}</h2><p class="sub">Cadastro enxuto: não pede nome de cliente, telefone, e-mail, obra nem endereço.</p><form class="form" id="coBudgetForm"><div class="co-budget-pdf wide">Use o padrão visual profissional da proposta. Revise tudo antes de enviar por WhatsApp ou converter em PDF.</div><div class="field"><label>Número</label><input value="${escape(item?.number || nextNumber())}" disabled></div><div class="field"><label>Status</label><select name="status">${STATUS.map((status) => `<option ${status === (item?.status || 'Rascunho') ? 'selected' : ''}>${status}</option>`).join('')}</select></div><div class="field wide"><label>Descrição profissional</label><textarea name="description" required>${escape(item?.description || 'Execução da obra conforme projetos técnicos fornecidos pelo contratante e limites definidos nesta proposta.')}</textarea></div><div class="field wide"><label>Serviços incluídos <small>(um por linha)</small></label><textarea name="included" required>${escape(item?.included || 'Execução da fundação conforme projeto estrutural;\nExecução da estrutura de concreto armado;\nExecução das alvenarias;\nExecução da obra até a etapa cinza.')}</textarea></div><div class="field wide"><label>Serviços não incluídos <small>(um por linha)</small></label><textarea name="excluded" required>${escape(item?.excluded || 'Instalações hidráulicas;\nInstalações elétricas;\nPisos e revestimentos;\nPintura e acabamentos decorativos.')}</textarea></div><div class="field wide"><label>Responsabilidades e condições</label><textarea name="responsibilities" required>${escape(item?.responsibilities || 'O contratante fornecerá os projetos e materiais de sua responsabilidade. Alterações posteriores ou serviços adicionais serão avaliados separadamente.')}</textarea></div><div class="field"><label>Valor total</label><input name="value" type="number" min="0" step="0.01" value="${Number(item?.value || 0) || ''}" required></div><div class="field"><label>Forma de pagamento</label><input name="paymentTerms" value="${escape(item?.paymentTerms || 'Pagamento quinzenal, conforme medição dos serviços executados.')}" required></div><div class="field"><label>Validade</label><input name="validUntil" type="date" value="${escape(validity)}" required></div>${item?.sourcePdf?.name ? `<div class="field wide"><div class="co-budget-pdf">PDF guardado neste aparelho: <b>${escape(item.sourcePdf.name)}</b>.</div></div>` : ''}</form><footer><button class="btn alt" onclick="closeModal()">Cancelar</button><button class="btn" onclick="COBudget.saveForm()">Salvar orçamento</button></footer>`;
    q('#modal').classList.add('show');
  }

  async function saveForm() {
    const form = q('#coBudgetForm');
    if (!form?.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    const now = new Date().toISOString();
    let item = activeId ? byId(activeId) : null;
    const data = { description: values.description.trim(), included: values.included.trim(), excluded: values.excluded.trim(), responsibilities: values.responsibilities.trim(), paymentTerms: values.paymentTerms.trim(), validUntil: values.validUntil, status: values.status, value: Number(values.value || 0), updatedAt: now };
    if (item) Object.assign(item, data);
    else { item = { id: uid(), number: nextNumber(), version: 1, createdAt: now, ...data }; items().push(item); }
    if (pendingPdf) { item.sourcePdf = await storePdf(item.id, pendingPdf.file, pendingPdf.meta); pendingPdf = null; }
    saveBudget(item.createdAt === now ? 'Orçamento criado' : 'Orçamento atualizado', item.number);
    closeModal();
    render();
  }

  function remove(id) {
    const item = byId(id);
    if (!item || item.status !== 'Rascunho') return;
    if (!confirm(`Excluir o rascunho ${item.number}?`)) return;
    db.budgets = items().filter((entry) => entry.id !== id);
    saveBudget('Rascunho de orçamento excluído', item.number);
    render();
  }

  function model() { window.open(new URL('public-assets/orcamentos/modelo-orcamento-neutro.pdf', location.href).href, '_blank', 'noopener'); }

  function library() {
    if (!window.__coBudgetPdfJs) {
      const moduleUrl = new URL('public-assets/vendor/pdfjs/pdf.min.mjs', location.href).href;
      const workerUrl = new URL('public-assets/vendor/pdfjs/pdf.worker.min.mjs', location.href).href;
      window.__coBudgetPdfJs = import(moduleUrl).then((pdfjs) => { pdfjs.GlobalWorkerOptions.workerSrc = workerUrl; return pdfjs; });
    }
    return window.__coBudgetPdfJs;
  }

  function pageText(content) {
    const lines = []; let line = []; let y = null;
    for (const part of content.items || []) { const text = String(part.str || '').trim(); if (!text) continue; const nextY = Math.round(Number(part.transform?.[5] || 0)); if (y !== null && Math.abs(nextY - y) > 2 && line.length) { lines.push(line.join(' ')); line = []; } line.push(text); y = nextY; }
    if (line.length) lines.push(line.join(' ')); return lines.join('\n');
  }

  function section(text, start, end) { const begin = text.search(start); if (begin < 0) return ''; const rest = text.slice(begin); const firstBreak = rest.indexOf('\n'); const body = firstBreak >= 0 ? rest.slice(firstBreak + 1) : rest; const finish = end ? body.search(end) : -1; return (finish >= 0 ? body.slice(0, finish) : body).replace(/\n{3,}/g, '\n\n').trim(); }

  async function readPdf(file, progress) {
    const pdfjs = await library(); const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; const pages = [];
    for (let number = 1; number <= document.numPages; number += 1) { if (progress) progress.textContent = `Lendo página ${number} de ${document.numPages}…`; pages.push(pageText((await (await document.getPage(number)).getTextContent()))); }
    return { pages: document.numPages, text: pages.join('\n\n') };
  }

  async function fingerprint(file) { const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer()); return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join(''); }

  function importPdf() {
    q('#dialog').innerHTML = `<h2>Importar PDF pronto</h2><p class="sub">A leitura é feita neste aparelho. O sistema sugere os campos para sua revisão; PDF escaneado como foto precisará de OCR numa próxima etapa.</p><form class="form" id="coBudgetImport"><div class="field wide"><div class="co-budget-import"><b>PDF da proposta</b><small>Escolha um PDF de até 15 MB.</small><input name="pdf" type="file" accept="application/pdf,.pdf" required style="margin-top:12px"><div class="co-budget-progress" aria-live="polite"></div></div></div><footer><button class="btn alt" type="button" onclick="closeModal()">Cancelar</button><button class="btn" type="submit">Ler PDF e preencher</button></footer></form>`;
    const form = q('#coBudgetImport');
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); const file = form.elements.pdf.files?.[0]; const progress = q('.co-budget-progress');
      if (!file) return; if (file.size > 15 * 1024 * 1024) { progress.textContent = 'Escolha um PDF de até 15 MB.'; return; }
      try {
        progress.textContent = 'Abrindo o PDF…'; const result = await readPdf(file, progress); const text = result.text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n');
        if (text.replace(/\s/g, '').length < 40) throw new Error('Não encontrei texto selecionável. Este PDF parece escaneado como imagem.');
        const values = Array.from(text.matchAll(/R\$\s*([\d.]+,\d{2})/gi)).map((match) => Number(match[1].replace(/\./g, '').replace(',', '.')) || 0);
        const days = Number(text.match(/v[aá]lid[oa][^\d]{0,35}(\d{1,3})\s*dias/i)?.[1] || 0);
        pendingPdf = { file, meta: { name: file.name, size: file.size, pages: result.pages, sha256: await fingerprint(file), recognizedAt: new Date().toISOString() }, parsed: { value: values.length ? Math.max(...values) : 0, validUntil: days ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) : '', description: section(text, /\b1\.\s*OBJETO\b/i, /\b2\.\s*VALOR/i), included: section(text, /\b3\.\s*SERVIÇOS INCLUÍDOS\b/i, /\b4\.\s*MATERIAL/i), excluded: section(text, /\b7\.\s*SERVIÇOS NÃO INCLUÍDOS\b/i, /\b8\.\s*FORMA DE PAGAMENTO/i), paymentTerms: section(text, /\b8\.\s*FORMA DE PAGAMENTO\b/i, /\b9\.\s*NOTA FISCAL/i), responsibilities: section(text, /\b10\.\s*RESPONSABILIDADE/i, /\b11\.\s*CONDIÇÕES GERAIS/i) } };
        closeModal(); open(); const target = q('#coBudgetForm'); const parsed = pendingPdf.parsed;
        for (const [key, value] of Object.entries(parsed)) if (value && target.elements[key]) target.elements[key].value = String(value);
        target.insertAdjacentHTML('afterbegin', `<div class="co-budget-pdf wide">✓ PDF reconhecido: <b>${escape(file.name)}</b> · ${result.pages} página(s). Revise os campos antes de salvar.</div>`);
      } catch (error) { progress.textContent = error?.message || 'Não foi possível ler este PDF.'; }
    });
    q('#modal').classList.add('show');
  }

  function database() { return new Promise((resolve, reject) => { const request = indexedDB.open('controle-obra-orcamentos-pdf', 1); request.onupgradeneeded = () => request.result.createObjectStore('files', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
  async function storePdf(id, file, meta) { const dbFile = await database(); await new Promise((resolve, reject) => { const tx = dbFile.transaction('files', 'readwrite'); tx.objectStore('files').put({ id, file, ...meta }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); dbFile.close(); return { name: meta.name, size: meta.size, pages: meta.pages, sha256: meta.sha256, savedAt: new Date().toISOString() }; }
  async function openPdf(id) { try { const dbFile = await database(); const record = await new Promise((resolve, reject) => { const request = dbFile.transaction('files', 'readonly').objectStore('files').get(id); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); dbFile.close(); if (!record?.file) throw new Error('O PDF não está neste aparelho. Importe-o novamente, se necessário.'); const url = URL.createObjectURL(record.file); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (error) { alert(error?.message || 'Não foi possível abrir o PDF.'); } }

  function install() {
    if (typeof isOfficePublic === 'function' && isOfficePublic()) return;
    if (typeof isProductPage === 'function' && isProductPage()) return;
    // A página comercial não possui a estrutura do aplicativo. Aguarda a área
    // administrativa existir antes de tocar no menu, evitando erro na abertura.
    // A versão atual pode montar o seletor de obra depois do menu. A aba de
    // orçamentos não depende dele, então aguardamos apenas a estrutura comum
    // do aplicativo para não impedir sua instalação.
    if (!q('#nav') || !q('#view')) { setTimeout(install, 100); return; }
    if (!Array.isArray(navs) || navs.some((entry) => entry[0] === 'budgets')) return;
    const clientIndex = navs.findIndex((entry) => entry[0] === 'clients');
    navs.splice(clientIndex >= 0 ? clientIndex + 1 : navs.length, 0, ['budgets', '📄 Orçamentos']);
    const originalRender = render;
    render = function renderWithBudgets() { if (page === 'budgets') { const view = q('#view'); if (view) view.innerHTML = pageHtml(); return; } return originalRender(); };
    const originalRenderTop = renderTop;
    renderTop = function renderTopWithBudgets() { originalRenderTop(); if (page === 'budgets') { const header = q('#headerPage'); if (header) header.textContent = 'Orçamentos'; } };
    window.COBudget = { open, saveForm, remove, model, importPdf, openPdf };
    renderTop(); render();
  }

  install();
})();
