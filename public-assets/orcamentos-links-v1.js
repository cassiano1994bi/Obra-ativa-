/* Controle de Obra — links protegidos e resposta de orçamento.
   Complementa a aba existente sem mexer nos dados operacionais. */
(() => {
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = (value) => typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  const list = () => Array.isArray(db?.budgets) ? db.budgets : [];
  const find = (id) => list().find((item) => item.id === id);
  const statusText = (status) => ({
    'Link enviado': 'Link enviado', Visualizado: 'Visualizado pelo cliente', Aprovado: '✓ Aprovado pelo cliente',
    'Alterações solicitadas': 'Alterações solicitadas', Recusado: 'Não aprovado', Expirado: 'Link expirado', Cancelado: 'Link cancelado',
  }[status] || status || 'Rascunho');
  const statusClass = (status) => String(status || '').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const dateTime = (value) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  let loadingStatuses = false;

  function requireSession() {
    if (!window.CloudSync?.ready || !CloudSync.session?.access_token) throw new Error('Entre na sua conta antes de gerar um link.');
  }

  function publicSnapshot(item) {
    const settings = db.settings || {};
    return {
      companyName: String(settings.company || settings.commercialName || 'Sua construtora').trim(),
      companyPhone: String(settings.phone || settings.whatsapp || '').trim(),
      title: 'Orçamento de execução de obra', number: String(item.number || ''), version: Number(item.version || 1),
      description: String(item.description || ''), included: String(item.included || ''), excluded: String(item.excluded || ''),
      responsibilities: String(item.responsibilities || ''), paymentTerms: String(item.paymentTerms || ''),
      value: Number(item.value || 0), validUntil: String(item.validUntil || ''),
    };
  }

  function proposalUrl(token) {
    const url = new URL('proposta.html', location.href);
    url.searchParams.set('t', token);
    return url.toString();
  }

  async function copy(text, message = 'Link copiado. Agora você pode enviar pelo WhatsApp.') {
    try { await navigator.clipboard.writeText(text); alert(message); }
    catch {
      const input = document.createElement('textarea'); input.value = text; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); document.execCommand('copy'); input.remove(); alert(message);
    }
  }

  function persist(action, detail) {
    if (typeof save === 'function') save(action, detail);
    else if (window.CloudSync?.flush) CloudSync.flush(true).catch(() => {});
  }

  function enhanceCard(card, item) {
    if (!card || !item || card.querySelector('.co-budget-link-actions')) return;
    const footer = q('footer', card);
    if (!footer) return;
    const link = item.publicApproval?.url || '';
    const online = ['Link enviado', 'Visualizado', 'Aprovado', 'Alterações solicitadas', 'Recusado', 'Expirado', 'Cancelado'].includes(item.status);
    const response = item.publicApproval?.response;
    const details = response?.signerName ? `<small class="co-budget-link-detail">${escape(response.signerName)}${response.respondedAt ? ` · ${escape(dateTime(response.respondedAt))}` : ''}</small>` : '';
    footer.insertAdjacentHTML('beforeend', `<span class="co-budget-link-actions">${online ? `<span class="co-budget-link-status ${statusClass(item.status)}">${escape(statusText(item.status))}</span>` : ''}${details}<button class="btn sm ${link ? 'alt' : ''}" onclick="COBudgetLinks.issue('${item.id}')">${link ? 'Gerar novo link' : 'Gerar e copiar link'}</button>${link ? `<button class="btn alt sm" onclick="COBudgetLinks.copy('${item.id}')">Copiar link</button>` : ''}</span>`);
  }

  function enhancePage() {
    if (typeof page === 'undefined' || page !== 'budgets') return;
    const note = q('.co-budget-note');
    if (note && !note.dataset.linksEnabled) {
      note.dataset.linksEnabled = '1';
      note.classList.add('is-enabled');
      note.innerHTML = '<span>✓</span><span><b>Links de orçamento estão disponíveis.</b> Gere um link único para o cliente abrir, responder e atualizar o status automaticamente neste painel.</span>';
    }
    const ordered = [...list()].sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    qa('.co-budget-card').forEach((card, index) => enhanceCard(card, ordered[index]));
    if (!q('#coBudgetLinksStyle')) document.head.insertAdjacentHTML('beforeend', `<style id="coBudgetLinksStyle">
      .co-budget-note.is-enabled{background:#eaf7ed;border-color:#9bd4a7;color:#28623a}.co-budget-link-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.co-budget-link-status{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;background:#edf4fd;color:#235d9e;font-size:11px;font-weight:850}.co-budget-link-status.aprovado{background:#e8f7ea;color:#227246}.co-budget-link-status.alteracoes-solicitadas{background:#fff3de;color:#8c5d09}.co-budget-link-status.recusado,.co-budget-link-status.expirado{background:#fff0f1;color:#a23b4a}.co-budget-link-detail{width:100%;color:#657c97;font-size:11px}@media(max-width:680px){.co-budget-link-actions{width:100%}.co-budget-link-actions .btn{flex:1}}
    </style>`);
  }

  async function updateStatuses(silent = true) {
    if (loadingStatuses || !window.CloudSync?.ready || !CloudSync.session?.access_token || !list().length) return;
    loadingStatuses = true;
    try {
      const rows = await CloudSync.request('/rest/v1/rpc/budget_public_owner_statuses', {
        method: 'POST', body: JSON.stringify({ p_local_budget_ids: list().map((item) => item.id) }),
      }, CloudSync.session.access_token);
      let changed = false;
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const item = find(row.local_budget_id); if (!item) return;
        const response = row.signer_name ? { signerName: row.signer_name, decision: row.decision, notes: row.notes || '', respondedAt: row.responded_at } : null;
        const before = JSON.stringify({ status: item.status, response: item.publicApproval?.response || null, viewedAt: item.publicApproval?.viewedAt || null });
        item.status = row.status || item.status;
        item.publicApproval = { ...(item.publicApproval || {}), version: row.version_number, viewedAt: row.viewed_at, respondedAt: row.responded_at, response };
        changed ||= before !== JSON.stringify({ status: item.status, response: item.publicApproval.response || null, viewedAt: item.publicApproval.viewedAt || null });
      });
      if (changed) { persist('Status de orçamento atualizado pelo cliente', 'Resposta recebida por link protegido.'); if (!silent) render(); else enhancePage(); }
    } catch (error) {
      if (!silent) alert(error?.message || 'Não foi possível consultar os links agora.');
    } finally { loadingStatuses = false; }
  }

  async function issue(id) {
    const item = find(id); if (!item) return;
    try {
      requireSession();
      if (!item.validUntil) throw new Error('Informe a validade antes de gerar o link.');
      if (new Date(`${item.validUntil}T23:59:59`) < new Date()) throw new Error('A validade terminou. Atualize a data antes de gerar o link.');
      const hadLink = Boolean(item.publicApproval?.url);
      if (hadLink && !confirm('Gerar uma nova versão? O link anterior deixará de funcionar. As respostas já recebidas continuam no histórico.')) return;
      const original = item.status; item.status = 'Preparando link…'; render();
      const response = await CloudSync.request('/rest/v1/rpc/budget_public_issue_link', {
        method: 'POST', body: JSON.stringify({ p_local_budget_id: item.id, p_snapshot: publicSnapshot(item), p_valid_until: item.validUntil }),
      }, CloudSync.session.access_token);
      const created = Array.isArray(response) ? response[0] : response;
      if (!created?.raw_token) throw new Error('O link não foi criado.');
      item.status = created.status || 'Link enviado';
      item.publicApproval = { url: proposalUrl(created.raw_token), version: created.version_number, expiresAt: created.expires_at, response: null };
      persist(hadLink ? 'Nova versão de orçamento enviada' : 'Link de orçamento criado', item.number || 'Orçamento');
      render();
      await copy(item.publicApproval.url, 'Link criado e copiado. Envie-o para o cliente pelo WhatsApp.');
    } catch (error) {
      if (item && item.status === 'Preparando link…') item.status = item.publicApproval?.status || 'Pronto para envio';
      render(); alert(error?.message || 'Não foi possível gerar o link.');
    }
  }

  function copyLink(id) { const item = find(id); if (item?.publicApproval?.url) copy(item.publicApproval.url); }

  function patchEditor() {
    const originalOpen = window.COBudget?.open;
    if (!originalOpen || originalOpen.__linksPatched) return;
    function patchedOpen(id = '') {
      originalOpen(id);
      const item = id ? find(id) : null;
      const select = q('#coBudgetForm select[name="status"]');
      ['Link enviado', 'Visualizado', 'Aprovado', 'Alterações solicitadas', 'Recusado', 'Expirado', 'Cancelado'].forEach((status) => {
        if (select && !qa('option', select).some((option) => option.value === status)) select.insertAdjacentHTML('beforeend', `<option value="${escape(status)}">${escape(status)}</option>`);
      });
      if (item?.publicApproval?.url) {
        q('#coBudgetForm')?.insertAdjacentHTML('afterend', `<div class="co-budget-pdf" style="margin:0 0 14px">Este orçamento possui um link público. Se você alterar o conteúdo, gere uma nova versão antes de enviar novamente.</div>`);
      }
    }
    patchedOpen.__linksPatched = true;
    window.COBudget.open = patchedOpen;
  }

  function install() {
    if (!window.COBudget || !window.CloudSync || typeof render === 'undefined') { setTimeout(install, 150); return; }
    patchEditor();
    if (!window.__coBudgetLinksRenderPatched) {
      const baseRender = render;
      render = function renderWithBudgetLinks() { const result = baseRender(); requestAnimationFrame(() => { enhancePage(); if (page === 'budgets') updateStatuses(true); }); return result; };
      window.__coBudgetLinksRenderPatched = true;
    }
    window.COBudgetLinks = { issue, copy: copyLink, refresh: () => updateStatuses(false) };
    setInterval(() => { if (typeof page !== 'undefined' && page === 'budgets') updateStatuses(true); }, 45000);
    enhancePage();
  }
  install();
})();
