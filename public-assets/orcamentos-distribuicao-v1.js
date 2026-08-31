/* Controle de Obra — distribuição isolada de orçamento por itens.
   A ferramenta trabalha somente em memória. Nenhum dado é persistido até o
   proprietário optar por preencher e salvar o formulário de orçamento atual. */
(() => {
  const assetBase = new URL('.', document.currentScript?.src || location.href);
  const state = {
    items: [],
    target: 0,
    source: null,
    warnings: [],
    workforce: { encarregado: 1, carpinteiros: 0, armadores: 0, pedreiros: 0, ajudantes: 0, outros: 0 },
  };

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) => typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const currency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const quantity = (value) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
  const makeId = () => `dist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let text = String(value ?? '').trim().replace(/R\$/gi, '').replace(/\s/g, '');
    if (!text || text === '-') return 0;
    const negative = /^\(.*\)$/.test(text) || text.startsWith('-');
    text = text.replace(/[()\-]/g, '');
    const comma = text.lastIndexOf(',');
    const dot = text.lastIndexOf('.');
    if (comma > dot) text = text.replace(/\./g, '').replace(',', '.');
    else if (dot > comma && comma >= 0) text = text.replace(/,/g, '');
    else if (comma >= 0) text = text.replace(',', '.');
    else if ((text.match(/\./g) || []).length > 1) text = text.replace(/\./g, '');
    text = text.replace(/[^0-9.]/g, '');
    const number = Number(text || 0);
    return Number.isFinite(number) ? (negative ? -number : number) : 0;
  }

  function cents(value) { return Math.round(Number(value || 0) * 100); }
  function includedItems() { return state.items.filter((item) => item.included !== false); }
  function allocatedTotal() { return includedItems().reduce((sum, item) => sum + cents(item.allocated), 0) / 100; }
  function baseTotal() { return includedItems().reduce((sum, item) => sum + Number(item.base || 0), 0); }
  function missingBase() { return includedItems().filter((item) => !(Number(item.base) > 0)); }

  function installStyle() {
    if (q('#coBudgetDistributionStyle')) return;
    document.head.insertAdjacentHTML('beforeend', `<style id="coBudgetDistributionStyle">
      #dialog:has(.co-dist-root){width:min(1180px,100%);max-width:1180px;overflow:auto;display:block}
      .co-dist-root{color:#15364a}.co-dist-title{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}.co-dist-title h2{margin:0 0 6px!important;color:#173b68}.co-dist-title p{margin:0;color:#647b97;line-height:1.5}.co-dist-badge{white-space:nowrap;padding:7px 10px;border-radius:999px;background:#e8f4ed;color:#176b45;font-size:11px;font-weight:850}.co-dist-panel{border:1px solid #dce7f1;border-radius:15px;background:#fbfdff;padding:15px;margin-top:14px}.co-dist-panel h3{margin:0 0 11px;font-size:16px;color:#173b68}.co-dist-import-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:13px}.co-dist-drop{border:1px dashed #9ebcda;border-radius:12px;background:#f4f9ff;padding:14px}.co-dist-drop input{margin-top:10px;width:100%}.co-dist-help{color:#607895;font-size:12px;line-height:1.5;margin-top:7px}.co-dist-source{padding:10px 12px;border-radius:10px;background:#eaf7ed;color:#28623a;font-size:12px;margin-top:10px}.co-dist-warning{padding:10px 12px;border-radius:10px;background:#fff5dc;color:#7a560d;font-size:12px;margin-top:10px;line-height:1.45}.co-dist-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}.co-dist-card{border:1px solid #dce7f1;border-radius:12px;background:#fff;padding:12px}.co-dist-card span{display:block;font-size:10px;font-weight:850;letter-spacing:.05em;text-transform:uppercase;color:#71829a}.co-dist-card strong{display:block;font-size:19px;color:#173b68;margin-top:6px}.co-dist-card.good{border-color:#9bd4a7;background:#f4fbf5}.co-dist-card.good strong{color:#227246}.co-dist-card.bad{border-color:#efba85;background:#fff8ef}.co-dist-card.bad strong{color:#a35b11}.co-dist-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.co-dist-toolbar .field{min-width:220px;flex:1}.co-dist-table-wrap{overflow:auto;border:1px solid #dce7f1;border-radius:12px;background:#fff;max-height:48vh}.co-dist-table{width:100%;border-collapse:collapse;min-width:1040px}.co-dist-table th,.co-dist-table td{padding:9px 10px;border-bottom:1px solid #e5edf5;vertical-align:top}.co-dist-table th{position:sticky;top:0;background:#f2f7fc;z-index:1;color:#5a708a;font-size:10px;text-transform:uppercase;letter-spacing:.04em;text-align:left}.co-dist-table td.num,.co-dist-table th.num{text-align:right}.co-dist-table input[type=number]{width:120px;padding:7px;border:1px solid #ccd9e7;border-radius:7px;text-align:right}.co-dist-table input[type=checkbox]{width:18px;height:18px}.co-dist-group{display:block;color:#71829a;font-size:10px;font-weight:800;text-transform:uppercase;margin-bottom:3px}.co-dist-service{font-weight:700;color:#173b68;line-height:1.35}.co-dist-lock{font-size:11px;color:#416481;background:#edf4fd;border-radius:999px;padding:4px 7px;white-space:nowrap}.co-dist-lock.active{background:#fff1d8;color:#845709}.co-dist-workforce{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.co-dist-workforce input{text-align:center}.co-dist-actions{display:flex;justify-content:space-between;gap:9px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid #e1eaf3}.co-dist-actions>div{display:flex;gap:8px;flex-wrap:wrap}.co-dist-empty{text-align:center;padding:24px;color:#6a8098}.co-dist-progress{min-height:18px;color:#235d9e;font-size:12px;font-weight:750;margin-top:8px}
      @media(max-width:760px){#dialog:has(.co-dist-root){padding:14px 12px}.co-dist-title{display:block}.co-dist-badge{display:inline-block;margin-top:9px}.co-dist-import-grid{grid-template-columns:1fr}.co-dist-summary{grid-template-columns:repeat(2,1fr)}.co-dist-workforce{grid-template-columns:repeat(2,1fr)}.co-dist-toolbar .field{min-width:100%}.co-dist-actions,.co-dist-actions>div{display:grid;width:100%}.co-dist-actions .btn{width:100%}.co-dist-table-wrap{max-height:42vh}}
    </style>`);
  }

  function loadScript(src, ready) {
    if (ready()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = qa('script').find((script) => script.src === new URL(src, location.href).href);
      const script = existing || document.createElement('script');
      const done = () => ready() ? resolve() : reject(new Error('O leitor de planilhas não foi carregado.'));
      script.addEventListener('load', done, { once: true });
      script.addEventListener('error', () => reject(new Error('Não foi possível carregar o leitor de planilhas.')), { once: true });
      if (!existing) { script.src = src; script.defer = true; document.head.append(script); }
      else if (ready()) resolve();
    });
  }

  function loadSheetJs() {
    return loadScript(new URL('vendor/sheetjs/xlsx.full.min.js', assetBase).href, () => Boolean(window.XLSX?.read));
  }

  function pdfLibrary() {
    if (!window.__coDistributionPdfJs) {
      const moduleUrl = new URL('vendor/pdfjs/pdf.min.mjs', assetBase).href;
      const workerUrl = new URL('vendor/pdfjs/pdf.worker.min.mjs', assetBase).href;
      window.__coDistributionPdfJs = import(moduleUrl).then((pdfjs) => { pdfjs.GlobalWorkerOptions.workerSrc = workerUrl; return pdfjs; });
    }
    return window.__coDistributionPdfJs;
  }

  function pageText(content) {
    const lines = []; let line = []; let lastY = null;
    for (const part of content.items || []) {
      const text = String(part.str || '').trim(); if (!text) continue;
      const y = Math.round(Number(part.transform?.[5] || 0));
      if (lastY !== null && Math.abs(y - lastY) > 2 && line.length) { lines.push(line.join(' ')); line = []; }
      line.push(text); lastY = y;
    }
    if (line.length) lines.push(line.join(' '));
    return lines.join('\n');
  }

  function headerIndex(row, terms) {
    const cells = row.map(normalize);
    return cells.findIndex((cell) => terms.some((term) => cell.includes(term)));
  }

  function parseSheetRows(rows, sheetName) {
    let headerRow = -1; let indexes = null;
    for (let rowIndex = 0; rowIndex < Math.min(rows.length, 50); rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const description = headerIndex(row, ['descricao dos servicos', 'service description', 'descricao', 'servico']);
      const item = headerIndex(row, ['item']);
      const qty = headerIndex(row, ['quant']);
      const unit = headerIndex(row, ['tipo de unidade', 'unidade', 'unit']);
      const unitPrice = headerIndex(row, ['p. unit', 'preco unit', 'valor unit']);
      const total = headerIndex(row, ['p. total', 'preco total', 'valor total', 'total']);
      if (description >= 0 && qty >= 0 && (unitPrice >= 0 || total >= 0)) {
        headerRow = rowIndex; indexes = { item, description, qty, unit, unitPrice, total }; break;
      }
    }
    if (!indexes) return { items: [], sheetName, warnings: ['Não encontrei as colunas de descrição, quantidade e valores.'] };

    const parsed = []; const warnings = []; let group = 'Serviços da obra';
    for (let rowIndex = headerRow + 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] || [];
      const description = String(row[indexes.description] ?? '').replace(/\s+/g, ' ').trim();
      if (!description) continue;
      const qty = parseNumber(row[indexes.qty]);
      const unit = String(row[indexes.unit] ?? '').trim();
      let unitPrice = indexes.unitPrice >= 0 ? parseNumber(row[indexes.unitPrice]) : 0;
      if (!(unitPrice > 0) && indexes.unitPrice >= 0 && indexes.unitPrice + 1 < row.length && indexes.unitPrice + 1 !== indexes.total) unitPrice = parseNumber(row[indexes.unitPrice + 1]);
      const total = indexes.total >= 0 ? parseNumber(row[indexes.total]) : 0;
      const code = indexes.item >= 0 ? String(row[indexes.item] ?? '').trim() : '';
      const looksLikeTotal = /sub.?total|total geral|desconto|frete|impostos|prazo de pagamento|observacoes/i.test(normalize(description));
      const hasPriceData = qty > 0 || unitPrice > 0 || total > 0;
      if (!hasPriceData) {
        if (!looksLikeTotal && description.length > 2) group = description;
        continue;
      }
      if (looksLikeTotal) continue;
      const base = total > 0 ? total : qty > 0 && unitPrice > 0 ? qty * unitPrice : 0;
      parsed.push({ id: makeId(), code, group, description, qty, unit, unitPrice, base, allocated: 0, locked: false, included: true, sourceRow: rowIndex + 1 });
    }
    if (parsed.some((item) => !(item.base > 0))) warnings.push('Há itens sem valor-base. Preencha-os antes de distribuir o total.');
    return { items: parsed, sheetName, warnings };
  }

  async function parseWorkbook(file) {
    await loadSheetJs();
    const workbook = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const candidates = workbook.SheetNames.map((sheetName) => {
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
      return parseSheetRows(rows, sheetName);
    }).sort((a, b) => b.items.length - a.items.length);
    const best = candidates[0] || { items: [], sheetName: '', warnings: [] };
    if (!best.items.length) throw new Error('Não encontrei uma tabela de serviços com quantidade e valores nesta planilha.');
    return best;
  }

  function parseTextScope(text) {
    const unitPattern = '(m²|m2|m³|m3|kg|vb|mês|mes|cj|un|und|m)';
    const rows = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const parsed = []; let group = 'Serviços da obra';
    rows.forEach((line, index) => {
      const pipe = line.split('|').map((part) => part.trim());
      if (pipe.length >= 2) {
        const description = pipe[0]; const qty = parseNumber(pipe[1]); const unit = pipe[2] || 'VB'; const unitPrice = parseNumber(pipe[3]); const total = parseNumber(pipe[4]);
        const base = total > 0 ? total : qty > 0 && unitPrice > 0 ? qty * unitPrice : 0;
        parsed.push({ id: makeId(), code: String(index + 1), group, description, qty: qty || 1, unit, unitPrice, base, allocated: 0, locked: false, included: true });
        return;
      }
      const expression = new RegExp(`^(?:\\d+[.)-]?\\s*)?(.+?)\\s+([\\d.,]+)\\s+${unitPattern}(?:\\s+(?:R\\$)?\\s*([\\d.,]+))?(?:\\s+(?:R\\$)?\\s*([\\d.,]+))?$`, 'i');
      const match = line.match(expression);
      if (match) {
        const qty = parseNumber(match[2]); const unitPrice = parseNumber(match[4]); const total = parseNumber(match[5]);
        parsed.push({ id: makeId(), code: String(index + 1), group, description: match[1], qty, unit: match[3], unitPrice, base: total > 0 ? total : qty * unitPrice, allocated: 0, locked: false, included: true });
      } else if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s–—/-]{3,}$/.test(line)) group = line;
      else parsed.push({ id: makeId(), code: String(index + 1), group, description: line, qty: 1, unit: 'VB', unitPrice: 0, base: 0, allocated: 0, locked: false, included: true });
    });
    return parsed;
  }

  async function parsePdf(file, progress) {
    const pdfjs = await pdfLibrary();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      progress.textContent = `Lendo página ${number} de ${pdf.numPages}…`;
      pages.push(pageText(await (await pdf.getPage(number)).getTextContent()));
    }
    const items = parseTextScope(pages.join('\n'));
    const useful = items.filter((item) => item.description && (item.base > 0 || item.qty > 0));
    if (!useful.length) throw new Error('Não encontrei itens de serviço no PDF. Se ele for escaneado, cole o escopo manualmente.');
    return { items: useful, sheetName: `${pdf.numPages} página(s)`, warnings: useful.some((item) => !(item.base > 0)) ? ['Revise os itens do PDF e informe os valores-base que não foram reconhecidos.'] : [] };
  }

  function open() {
    installStyle();
    state.items = []; state.target = 0; state.source = null; state.warnings = [];
    state.workforce = { encarregado: 1, carpinteiros: 0, armadores: 0, pedreiros: 0, ajudantes: 0, outros: 0 };
    q('#dialog').innerHTML = `<div class="co-dist-root"><div class="co-dist-title"><div><h2>Distribuir orçamento por itens</h2><p>Importe o escopo do cliente e distribua o valor fechado sem deixar itens ou centavos de fora.</p></div><span class="co-dist-badge">Alto padrão · Jundiaí/SP</span></div><section class="co-dist-panel"><h3>1. Escopo e valor fechado</h3><div class="co-dist-import-grid"><div class="co-dist-drop"><b>Planilha ou PDF do cliente</b><div class="co-dist-help">Aceita XLSX, XLS, CSV e PDF com texto. A leitura acontece neste aparelho.</div><input id="coDistFile" type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onchange="COBudgetDistribution.importFile(this)"><div class="co-dist-progress" id="coDistProgress" aria-live="polite"></div></div><div><div class="field"><label>Valor total fechado da obra</label><input id="coDistTarget" type="number" min="0.01" step="0.01" placeholder="Ex.: 800000" oninput="COBudgetDistribution.setTarget(this.value)"></div><div class="co-dist-help">O total informado será dividido proporcionalmente pelo peso dos itens importados.</div></div></div><div class="field" style="margin-top:12px"><label>Ou cole o escopo manualmente <small>(um item por linha)</small></label><textarea id="coDistPaste" placeholder="Serviço | quantidade | unidade | preço unitário | total"></textarea></div><button class="btn alt sm" type="button" style="margin-top:8px" onclick="COBudgetDistribution.usePastedScope()">Usar texto colado</button><div id="coDistSource"></div></section><div id="coDistWorkspace">${emptyWorkspace()}</div><div class="co-dist-actions"><button class="btn alt" type="button" onclick="COBudgetDistribution.close()">Fechar sem salvar</button><div><button class="btn alt" type="button" onclick="COBudgetDistribution.copyReport()">Copiar relatório</button><button class="btn alt" type="button" onclick="COBudgetDistribution.printReport()">Gerar PDF</button><button class="btn" type="button" onclick="COBudgetDistribution.prepareBudget()">Preencher novo orçamento</button></div></div></div>`;
    q('#modal').classList.add('show');
  }

  function close() { q('#modal')?.classList.remove('show'); }
  function emptyWorkspace() { return '<section class="co-dist-panel co-dist-empty"><b>Nenhum item carregado.</b><br>Importe uma planilha, um PDF ou cole o escopo para começar.</section>'; }

  function setTarget(value) { state.target = Math.max(0, parseNumber(value)); updateSummaryOnly(); }

  async function importFile(input) {
    const file = input?.files?.[0]; const progress = q('#coDistProgress');
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { progress.textContent = 'Escolha um arquivo de até 20 MB.'; return; }
    try {
      progress.textContent = 'Lendo o arquivo sem salvar dados…';
      const extension = file.name.split('.').pop().toLowerCase();
      const result = extension === 'pdf' ? await parsePdf(file, progress) : await parseWorkbook(file);
      state.items = result.items; state.warnings = result.warnings || [];
      state.source = { name: file.name, detail: result.sheetName || '' };
      progress.textContent = `${state.items.length} item(ns) reconhecido(s).`;
      renderWorkspace(); renderSource();
    } catch (error) { progress.textContent = error?.message || 'Não foi possível ler o arquivo.'; }
  }

  function usePastedScope() {
    const text = q('#coDistPaste')?.value || '';
    if (!text.trim()) return alert('Cole ao menos um item do escopo.');
    state.items = parseTextScope(text); state.warnings = state.items.some((item) => !(item.base > 0)) ? ['Informe o valor-base dos itens antes de distribuir.'] : [];
    state.source = { name: 'Escopo colado manualmente', detail: '' };
    renderWorkspace(); renderSource();
  }

  function renderSource() {
    const target = q('#coDistSource'); if (!target) return;
    const source = state.source ? `<div class="co-dist-source"><b>Fonte:</b> ${esc(state.source.name)}${state.source.detail ? ` · ${esc(state.source.detail)}` : ''}. Os valores-base importados têm prioridade; nenhum preço é inventado.</div>` : '';
    const warnings = state.warnings.length ? `<div class="co-dist-warning"><b>Revisão necessária:</b> ${state.warnings.map(esc).join(' ')}</div>` : '';
    target.innerHTML = source + warnings;
  }

  function summaryHtml() {
    const allocated = allocatedTotal(); const gap = Number(state.target || 0) - allocated; const exact = state.target > 0 && Math.abs(gap) < 0.005;
    return `<section class="co-dist-summary"><article class="co-dist-card"><span>Itens do escopo</span><strong>${includedItems().length}</strong></article><article class="co-dist-card"><span>Total fechado</span><strong>${currency(state.target)}</strong></article><article class="co-dist-card ${exact ? 'good' : 'bad'}"><span>${exact ? 'Conferência' : 'Diferença a distribuir'}</span><strong>${exact ? 'Fechou exato' : currency(gap)}</strong></article></section>`;
  }

  function workforceHtml() {
    const labels = { encarregado: 'Encarregado', carpinteiros: 'Carpinteiros', armadores: 'Armadores', pedreiros: 'Pedreiros', ajudantes: 'Ajudantes', outros: 'Outros' };
    return Object.entries(labels).map(([key, label]) => `<div class="field"><label>${label}</label><input type="number" min="0" step="1" value="${Number(state.workforce[key] || 0)}" onchange="COBudgetDistribution.setWorkforce('${key}',this.value)"></div>`).join('');
  }

  function itemRowsHtml() {
    return state.items.map((item, index) => {
      const percent = state.target > 0 ? Number(item.allocated || 0) / state.target * 100 : 0;
      return `<tr><td><input type="checkbox" ${item.included !== false ? 'checked' : ''} onchange="COBudgetDistribution.toggleItem(${index},this.checked)" aria-label="Incluir ${esc(item.description)}"></td><td><span class="co-dist-group">${esc(item.group || 'Serviços')}</span><span class="co-dist-service">${esc(item.code ? `${item.code} · ` : '')}${esc(item.description)}</span></td><td class="num">${quantity(item.qty)}</td><td>${esc(item.unit || '—')}</td><td class="num"><input type="number" min="0" step="0.01" value="${Number(item.base || 0).toFixed(2)}" onchange="COBudgetDistribution.updateBase(${index},this.value)" aria-label="Valor-base de ${esc(item.description)}"></td><td class="num"><input type="number" min="0" step="0.01" value="${Number(item.allocated || 0).toFixed(2)}" onchange="COBudgetDistribution.updateAllocated(${index},this.value)" aria-label="Valor distribuído de ${esc(item.description)}"></td><td class="num">${percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</td><td><button class="co-dist-lock ${item.locked ? 'active' : ''}" type="button" onclick="COBudgetDistribution.toggleLock(${index})">${item.locked ? '🔒 Fixado' : 'Livre'}</button></td></tr>`;
    }).join('');
  }

  function renderWorkspace() {
    const target = q('#coDistWorkspace'); if (!target) return;
    if (!state.items.length) { target.innerHTML = emptyWorkspace(); return; }
    target.innerHTML = `${summaryHtml()}<section class="co-dist-panel"><div class="co-dist-toolbar"><div class="field"><label>Regra de distribuição</label><input value="Proporcional ao valor-base de cada item" disabled></div><button class="btn" type="button" onclick="COBudgetDistribution.distributeAll()">Distribuir o total</button><button class="btn alt" type="button" onclick="COBudgetDistribution.redistribute()">Distribuir diferença</button></div><div class="co-dist-help">“Distribuir o total” recalcula todos os itens. “Distribuir diferença” respeita os valores marcados como fixados.</div></section><section class="co-dist-panel"><h3>2. Valores por item</h3><div class="co-dist-table-wrap"><table class="co-dist-table"><thead><tr><th>Usar</th><th>Serviço</th><th class="num">Quant.</th><th>Unid.</th><th class="num">Valor-base</th><th class="num">Distribuído</th><th class="num">% do total</th><th>Controle</th></tr></thead><tbody>${itemRowsHtml()}</tbody></table></div></section><section class="co-dist-panel"><h3>3. Equipe prevista para apresentar ao cliente</h3><div class="co-dist-workforce">${workforceHtml()}</div><div class="co-dist-help">Este quadro é informativo e editável. Ele não altera a aba Equipe nem cria funcionários.</div></section>`;
  }

  function updateSummaryOnly() {
    const current = q('.co-dist-summary');
    if (current) current.outerHTML = summaryHtml();
  }

  function allocate(preserveLocks) {
    if (!(state.target > 0)) return alert('Informe o valor total fechado da obra.');
    const selected = includedItems();
    if (!selected.length) return alert('Nenhum item está selecionado.');
    const missing = missingBase();
    if (missing.length) return alert(`Preencha o valor-base de ${missing.length} item(ns) antes de distribuir.`);
    if (!preserveLocks) selected.forEach((item) => { item.locked = false; item.allocated = 0; });
    const locked = selected.filter((item) => preserveLocks && item.locked);
    const unlocked = selected.filter((item) => !preserveLocks || !item.locked);
    const targetCents = cents(state.target); const lockedCents = locked.reduce((sum, item) => sum + cents(item.allocated), 0); const remainder = targetCents - lockedCents;
    if (remainder < 0) return alert('Os valores fixados ultrapassam o total da obra. Reduza algum valor fixado.');
    if (!unlocked.length) {
      if (remainder !== 0) return alert('Todos os itens estão fixados, mas a soma ainda não fecha o total. Libere ao menos um item.');
      renderWorkspace(); return;
    }
    const weight = unlocked.reduce((sum, item) => sum + Number(item.base || 0), 0);
    if (!(weight > 0)) return alert('Os itens livres precisam ter valor-base maior que zero.');
    const shares = unlocked.map((item) => {
      const exact = remainder * Number(item.base || 0) / weight;
      return { item, value: Math.floor(exact), fraction: exact - Math.floor(exact) };
    });
    let spare = remainder - shares.reduce((sum, share) => sum + share.value, 0);
    shares.sort((a, b) => b.fraction - a.fraction || String(a.item.description).localeCompare(String(b.item.description), 'pt-BR'));
    for (let index = 0; index < spare; index += 1) shares[index % shares.length].value += 1;
    shares.forEach((share) => { share.item.allocated = share.value / 100; });
    state.items.filter((item) => item.included === false).forEach((item) => { item.allocated = 0; item.locked = false; });
    renderWorkspace();
  }

  function distributeAll() { allocate(false); }
  function redistribute() { allocate(true); }
  function updateBase(index, value) { const item = state.items[index]; if (!item) return; item.base = Math.max(0, parseNumber(value)); item.unitPrice = item.qty > 0 ? item.base / item.qty : item.base; updateSummaryOnly(); }
  function updateAllocated(index, value) { const item = state.items[index]; if (!item) return; item.allocated = Math.max(0, parseNumber(value)); item.locked = true; allocate(true); }
  function toggleLock(index) { const item = state.items[index]; if (!item) return; item.locked = !item.locked; renderWorkspace(); }
  function toggleItem(index, checked) { const item = state.items[index]; if (!item) return; item.included = Boolean(checked); item.allocated = 0; item.locked = false; updateSummaryOnly(); }
  function setWorkforce(key, value) { if (!(key in state.workforce)) return; state.workforce[key] = Math.max(0, Math.round(parseNumber(value))); }

  function exactOrWarn() {
    if (!state.items.length) { alert('Importe o escopo primeiro.'); return false; }
    if (!(state.target > 0)) { alert('Informe o valor total da obra.'); return false; }
    const gap = state.target - allocatedTotal();
    if (Math.abs(gap) >= 0.005) { alert(`Ainda existe uma diferença de ${currency(gap)}. Distribua o total antes de continuar.`); return false; }
    return true;
  }

  function workforceLines() {
    const labels = { encarregado: 'Encarregado', carpinteiros: 'Carpinteiros', armadores: 'Armadores', pedreiros: 'Pedreiros', ajudantes: 'Ajudantes', outros: 'Outros profissionais' };
    const lines = Object.entries(labels).filter(([key]) => state.workforce[key] > 0).map(([key, label]) => `${label}: ${state.workforce[key]}`);
    const total = Object.values(state.workforce).reduce((sum, value) => sum + Number(value || 0), 0);
    return [`Total previsto: ${total} profissional(is)`, ...lines];
  }

  function reportText() {
    const lines = ['DISTRIBUIÇÃO DO ORÇAMENTO POR ITENS', 'Referência: casas de alto padrão em Jundiaí/SP', `Fonte do escopo: ${state.source?.name || 'Inserção manual'}`, `Valor total fechado: ${currency(state.target)}`, '', 'SERVIÇOS INCLUÍDOS'];
    let lastGroup = '';
    includedItems().forEach((item) => {
      if (item.group && item.group !== lastGroup) { lines.push('', item.group.toUpperCase()); lastGroup = item.group; }
      const detail = `${quantity(item.qty)} ${item.unit || 'VB'}`;
      const percent = state.target > 0 ? item.allocated / state.target * 100 : 0;
      lines.push(`${item.code ? `${item.code} - ` : ''}${item.description} | ${detail} | ${currency(item.allocated)} | ${percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
    });
    lines.push('', `TOTAL: ${currency(allocatedTotal())}`, '', 'EQUIPE PREVISTA', ...workforceLines(), '', 'Valores sujeitos à revisão e aprovação antes do envio ao cliente.');
    return lines.join('\n');
  }

  async function copyReport() {
    if (!exactOrWarn()) return;
    try { await navigator.clipboard.writeText(reportText()); alert('Relatório copiado.'); }
    catch { const area = document.createElement('textarea'); area.value = reportText(); document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); alert('Relatório copiado.'); }
  }

  function reportHtml() {
    const rows = includedItems().map((item) => `<tr><td>${esc(item.code)}</td><td><small>${esc(item.group)}</small><br><b>${esc(item.description)}</b></td><td>${esc(quantity(item.qty))} ${esc(item.unit || '')}</td><td>${esc(currency(item.allocated))}</td><td>${esc((item.allocated / state.target * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}%</td></tr>`).join('');
    const team = workforceLines().map((line) => `<li>${esc(line)}</li>`).join('');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Distribuição do orçamento</title><style>@page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#173b68}header{border-bottom:4px solid #d49a25;padding-bottom:12px;margin-bottom:18px}h1{margin:0;font-size:24px}p{color:#5e7188}strong.total{display:block;background:#173b68;color:#fff;font-size:24px;text-align:center;padding:15px;margin:15px 0;border-radius:10px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #dbe5ef;text-align:left;vertical-align:top}th{background:#eef4fa;font-size:10px;text-transform:uppercase}td:nth-child(4),td:nth-child(5){text-align:right;white-space:nowrap}small{color:#71829a}section{margin-top:20px}li{margin:4px 0}</style></head><body><header><small>CONTROLE DE OBRA · PROPOSTA PARA REVISÃO</small><h1>Distribuição do orçamento por itens</h1><p>Casas de alto padrão · Jundiaí/SP · Fonte: ${esc(state.source?.name || 'Inserção manual')}</p></header><strong class="total">${esc(currency(state.target))}</strong><table><thead><tr><th>Item</th><th>Serviço</th><th>Quantidade</th><th>Valor</th><th>%</th></tr></thead><tbody>${rows}</tbody></table><section><h2>Equipe prevista</h2><ul>${team}</ul></section></body></html>`;
  }

  function printReport() {
    if (!exactOrWarn()) return;
    const popup = window.open('', '_blank');
    if (!popup) return alert('Permita a abertura da janela para gerar o PDF.');
    popup.opener = null; popup.document.open(); popup.document.write(reportHtml()); popup.document.close();
    setTimeout(() => { popup.focus(); popup.print(); }, 250);
  }

  function prepareBudget() {
    if (!exactOrWarn()) return;
    if (!window.COBudget?.open) return alert('A área de Orçamentos ainda não terminou de carregar.');
    const included = reportText().split('\n').filter((line) => line && !['DISTRIBUIÇÃO DO ORÇAMENTO POR ITENS', 'SERVIÇOS INCLUÍDOS', 'EQUIPE PREVISTA'].includes(line) && !line.startsWith('Referência:') && !line.startsWith('Fonte do escopo:') && !line.startsWith('Valor total fechado:') && !line.startsWith('TOTAL:') && !line.startsWith('Valores sujeitos')).join('\n');
    close(); window.COBudget.open();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const form = q('#coBudgetForm'); if (!form) return;
      if (form.elements.value) form.elements.value.value = String(state.target.toFixed(2));
      if (form.elements.description) form.elements.description.value = 'Execução dos serviços discriminados no escopo e na distribuição de valores revisada nesta proposta.';
      if (form.elements.included) form.elements.included.value = included;
      form.insertAdjacentHTML('afterbegin', '<div class="co-budget-pdf wide">✓ Distribuição preenchida apenas neste formulário. Revise tudo e clique em “Salvar orçamento” somente se estiver correto.</div>');
    }));
  }

  function enhancePage() {
    if (typeof page === 'undefined' || page !== 'budgets') return;
    const actions = q('.co-budget-actions');
    if (actions && !q('[data-budget-distribution]', actions)) actions.insertAdjacentHTML('afterbegin', '<button class="btn alt" data-budget-distribution type="button" onclick="COBudgetDistribution.open()">Distribuir por itens</button>');
  }

  function install() {
    if (!window.COBudget || !q('#view')) { setTimeout(install, 150); return; }
    installStyle();
    window.COBudgetDistribution = { open, close, importFile, usePastedScope, setTarget, distributeAll, redistribute, updateBase, updateAllocated, toggleLock, toggleItem, setWorkforce, copyReport, printReport, prepareBudget };
    const observer = new MutationObserver(() => requestAnimationFrame(enhancePage));
    observer.observe(q('#view'), { childList: true, subtree: true });
    enhancePage();
  }

  install();
})();
