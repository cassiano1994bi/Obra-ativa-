(() => {
  'use strict';

  const STORAGE_PREFIX = 'obraativa.home-preferences.v1';
  const USAGE_STORAGE_PREFIX = 'obraativa.home-usage.v1';
  const AUTO_MIN_USES = 12;
  const AUTO_REFRESH_MS = 24 * 60 * 60 * 1000;
  const SIZE_VALUES = new Set(['compact', 'comfortable', 'spacious']);
  const COLUMN_VALUES = new Set(['auto', '1', '2', '3', '4', '5']);
  // Os cinco atalhos da Home podem participar da escolha automática. A
  // configuração inicial continua exibindo somente os quatro definidos pelo
  // proprietário; o quinto pode aparecer após histórico suficiente ou escolha manual.
  const EDITABLE_SHORTCUT_LIMIT = 5;
  const DEFAULT_KEYS = ['works', 'planning', 'attendance', 'payments', 'financial'];
  const EDITABLE_SHORTCUT_KEYS = new Set(DEFAULT_KEYS);
  const LABELS = {
    works: { label: 'Obras', description: 'Acompanhe seus projetos' },
    planning: { label: 'Escala diária', description: 'Organize a equipe' },
    attendance: { label: 'Presença', description: 'Confirme quem trabalhou' },
    payments: { label: 'Pagamentos', description: 'Consulte o ciclo' },
    financial: { label: 'Financeiro', description: 'Veja entradas e custos' }
  };

  let editorRoot = null;
  let draft = null;
  let committed = null;
  let refreshQueued = false;
  let lastHomeSignature = '';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function appHome() {
    return document.querySelector('#app:not(.public-app) #view .home-operational');
  }

  function shortcutKey(button) {
    const handler = button?.getAttribute('onclick') || '';
    const match = handler.match(/go\(['"]([^'"]+)['"]\)/);
    return match ? match[1] : String(button?.dataset?.shortcutKey || '');
  }

  function shortcutItems(home) {
    return $$('.home-shortcuts>.home-shortcut', home).map((button) => {
      const key = shortcutKey(button);
      const title = button.querySelector('b')?.textContent?.trim() || LABELS[key]?.label || key;
      const description = button.querySelector('small')?.textContent?.trim() || LABELS[key]?.description || '';
      if (key) button.dataset.obraativaShortcutKey = key;
      return { key, label: title, description, button };
    }).filter((item) => item.key);
  }

  function editableShortcutItems(items) {
    return items.filter((item) => EDITABLE_SHORTCUT_KEYS.has(item.key)).slice(0, EDITABLE_SHORTCUT_LIMIT);
  }

  function identityPart(value, fallback) {
    const text = String(value || '').trim();
    return encodeURIComponent(text || fallback).slice(0, 160);
  }

  function preferenceKey() {
    let userId = '';
    let companyId = '';
    try {
      userId = window.CloudSync?.session?.user?.id || '';
      companyId = window.CompanyWorkspace?.current?.id || '';
    } catch (error) {
      userId = '';
      companyId = '';
    }
    return `${STORAGE_PREFIX}:${identityPart(userId, 'anonymous')}:${identityPart(companyId, 'local')}`;
  }

  function usageKey() {
    let userId = '';
    let companyId = '';
    try {
      userId = window.CloudSync?.session?.user?.id || '';
      companyId = window.CompanyWorkspace?.current?.id || '';
    } catch (error) {
      userId = '';
      companyId = '';
    }
    return `${USAGE_STORAGE_PREFIX}:${identityPart(userId, 'anonymous')}:${identityPart(companyId, 'local')}`;
  }

  function readUsage() {
    try {
      const raw = JSON.parse(localStorage.getItem(usageKey()) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (error) {
      return {};
    }
  }

  function rememberUsage(key) {
    if (!EDITABLE_SHORTCUT_KEYS.has(key)) return;
    const usage = readUsage();
    const current = usage[key] && typeof usage[key] === 'object' ? usage[key] : {};
    usage[key] = {
      count: Math.min(1000, Math.max(0, Number(current.count) || 0) + 1),
      last: Date.now()
    };
    try { localStorage.setItem(usageKey(), JSON.stringify(usage)); } catch (error) { /* analytics visual opcional */ }
  }

  function usageTotal(usage) {
    return Object.values(usage).reduce((total, value) => total + Math.max(0, Number(value?.count) || 0), 0);
  }

  function usageScore(key, usage, now = Date.now()) {
    const value = usage[key] || {};
    const count = Math.max(0, Number(value.count) || 0);
    const last = Number(value.last) || 0;
    const ageDays = last ? Math.max(0, (now - last) / 86400000) : 999;
    const recency = ageDays < 30 ? (30 - ageDays) / 30 : 0;
    return count + recency * 4;
  }

  function automaticOrder(items, fallbackOrder) {
    const usage = readUsage();
    if (usageTotal(usage) < AUTO_MIN_USES) return [...fallbackOrder];
    const now = Date.now();
    return [...items].sort((a, b) => {
      const difference = usageScore(b.key, usage, now) - usageScore(a.key, usage, now);
      return difference || fallbackOrder.indexOf(a.key) - fallbackOrder.indexOf(b.key);
    }).map((item) => item.key);
  }

  function defaultPreferences(items) {
    const keys = editableShortcutItems(items).map((item) => item.key);
    const order = [...DEFAULT_KEYS.filter((key) => keys.includes(key)), ...keys.filter((key) => !DEFAULT_KEYS.includes(key))];
    return {
      order,
      visible: order.slice(0, Math.min(4, order.length)),
      size: 'comfortable',
      count: Math.min(4, order.length || 1),
      columns: 'auto',
      manual: false,
      autoUpdatedAt: 0
    };
  }

  function readPreferences(items) {
    const editableItems = editableShortcutItems(items);
    const fallback = defaultPreferences(editableItems);
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(preferenceKey()) || 'null'); } catch (error) { raw = null; }
    if (!raw || typeof raw !== 'object') {
      const autoOrder = automaticOrder(editableItems, fallback.order);
      if (autoOrder.join('|') === fallback.order.join('|')) return fallback;
      const automatic = { ...fallback, order: autoOrder, visible: [...autoOrder], autoUpdatedAt: Date.now() };
      writePreferences(automatic);
      return automatic;
    }
    const keys = new Set(editableItems.map((item) => item.key));
    const order = Array.isArray(raw.order)
      ? [...new Set(raw.order.filter((key) => typeof key === 'string' && keys.has(key))), ...fallback.order.filter((key) => !raw.order.includes(key))]
      : fallback.order;
    const countNumber = Number(raw.count);
    const manual = raw.manual !== false;
    let resolvedOrder = order;
    let autoUpdatedAt = Number(raw.autoUpdatedAt) || 0;
    if (!manual && usageTotal(readUsage()) >= AUTO_MIN_USES && (!autoUpdatedAt || Date.now() - autoUpdatedAt >= AUTO_REFRESH_MS)) {
      resolvedOrder = automaticOrder(editableItems, fallback.order);
      autoUpdatedAt = Date.now();
    }
    const resolvedVisible = Array.isArray(raw.visible)
      ? resolvedOrder.filter((key) => raw.visible.includes(key))
      : [...resolvedOrder];
    const safeResolvedVisible = resolvedVisible.length ? resolvedVisible : [resolvedOrder[0]].filter(Boolean);
    const resolvedCount = Number.isInteger(countNumber) ? Math.max(1, Math.min(resolvedOrder.length || 1, countNumber)) : fallback.count;
    const preferences = {
      order: resolvedOrder,
      visible: safeResolvedVisible,
      size: SIZE_VALUES.has(raw.size) ? raw.size : fallback.size,
      count: resolvedCount,
      columns: COLUMN_VALUES.has(String(raw.columns)) ? String(raw.columns) : fallback.columns,
      manual,
      autoUpdatedAt
    };
    if (!manual && autoUpdatedAt !== (Number(raw.autoUpdatedAt) || 0)) writePreferences(preferences);
    return preferences;
  }

  function writePreferences(preferences) {
    try { localStorage.setItem(preferenceKey(), JSON.stringify(preferences)); } catch (error) { /* preferência visual opcional */ }
  }

  function clonePreferences(preferences) {
    return { order: [...preferences.order], visible: [...preferences.visible], size: preferences.size, count: preferences.count, columns: preferences.columns, manual: preferences.manual !== false, autoUpdatedAt: Number(preferences.autoUpdatedAt) || 0 };
  }

  function installEditorButton(home) {
    const operationalHead = home.querySelector('.home-operational-head');
    const sectionHead = home.querySelector('.home-section-head');
    const head = operationalHead || sectionHead;
    if (!head || head.querySelector('.obraativa-shortcut-editor-button')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'obraativa-shortcut-editor-button';
    button.title = 'Editar a página inicial';
    button.setAttribute('aria-label', 'Editar a página inicial');
    button.innerHTML = '<span aria-hidden="true">✎</span><span>Editar início</span>';
    button.addEventListener('click', openEditor);
    if (operationalHead) {
      let actions = operationalHead.querySelector('.obraativa-home-head-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'obraativa-home-head-actions';
        const payChip = operationalHead.querySelector('.home-pay-chip');
        if (payChip) operationalHead.insertBefore(actions, payChip);
        else operationalHead.appendChild(actions);
      }
      actions.appendChild(button);
    } else {
      head.appendChild(button);
    }
  }

  function applyPreferences(home, preferences) {
    const container = home.querySelector('.home-shortcuts');
    if (!container) return;
    const items = shortcutItems(home);
    const editableItems = editableShortcutItems(items);
    const editableKeys = new Set(editableItems.map((item) => item.key));
    const byKey = new Map(editableItems.map((item) => [item.key, item.button]));
    const itemByKey = new Map(editableItems.map((item) => [item.key, item]));
    preferences.order.forEach((key) => {
      const button = byKey.get(key);
      if (button) container.appendChild(button);
    });
    container.classList.remove('obraativa-shortcuts-size-compact', 'obraativa-shortcuts-size-comfortable', 'obraativa-shortcuts-size-spacious');
    container.classList.remove('obraativa-shortcuts-columns-auto', 'obraativa-shortcuts-columns-1', 'obraativa-shortcuts-columns-2', 'obraativa-shortcuts-columns-3', 'obraativa-shortcuts-columns-4', 'obraativa-shortcuts-columns-5');
    container.classList.add(`obraativa-shortcuts-size-${preferences.size}`, `obraativa-shortcuts-columns-${preferences.columns}`);
    const visible = new Set(preferences.visible);
    let shown = 0;
    const visibilityOrder = [
      ...preferences.order.map((key) => itemByKey.get(key)).filter(Boolean),
      ...items.filter((item) => !preferences.order.includes(item.key))
    ];
    visibilityOrder.forEach((item) => {
      const shouldShow = editableKeys.has(item.key) && visible.has(item.key) && shown < preferences.count;
      item.button.hidden = !shouldShow;
      item.button.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
      if (shouldShow) shown += 1;
    });
    const section = home.querySelector('.obraativa-quick-section');
    if (section) section.dataset.shortcutsSummary = `${shown}/${editableItems.length}`;
  }

  function listRow(item, index, total, preferences) {
    const checked = preferences.visible.includes(item.key);
    const meta = LABELS[item.key] || item;
    const row = document.createElement('div');
    row.className = `obraativa-shortcut-editor-row ${checked ? 'is-visible' : 'is-hidden'}`;
    row.dataset.key = item.key;
    row.innerHTML = `<span class="obraativa-shortcut-editor-grip" aria-hidden="true">⋮⋮</span><span class="obraativa-shortcut-editor-position" aria-label="Posição ${index + 1}">${index + 1}</span><label class="obraativa-shortcut-toggle"><span class="obraativa-shortcut-copy"><span><b>${escapeHtml(meta.label || item.label)}</b><em>${checked ? 'Visível' : 'Oculto'}</em></span><small>${escapeHtml(meta.description || item.description)}</small></span><span class="obraativa-shortcut-switch"><input type="checkbox" data-shortcut-visible="${escapeHtml(item.key)}" aria-label="${checked ? 'Ocultar' : 'Mostrar'} atalho ${escapeHtml(meta.label || item.label)}" ${checked ? 'checked' : ''}><i aria-hidden="true"></i></span></label><span class="obraativa-shortcut-editor-order"><button type="button" data-move="up" aria-label="Mover ${escapeHtml(meta.label || item.label)} para cima" title="Mover para cima" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="down" aria-label="Mover ${escapeHtml(meta.label || item.label)} para baixo" title="Mover para baixo" ${index === total - 1 ? 'disabled' : ''}>↓</button></span>`;
    return row;
  }

  function preferencesSignature(preferences) {
    if (!preferences) return '';
    return JSON.stringify({ order: preferences.order, visible: preferences.visible, size: preferences.size, count: preferences.count, columns: preferences.columns, manual: preferences.manual !== false });
  }

  function previewItems(items, preferences) {
    const byKey = new Map(items.map((item) => [item.key, item]));
    return preferences.order
      .filter((key) => preferences.visible.includes(key))
      .slice(0, preferences.count)
      .map((key) => byKey.get(key))
      .filter(Boolean);
  }

  function previewCard(item) {
    const card = item.button.cloneNode(true);
    card.classList.add('obraativa-shortcut-editor-preview-card');
    card.removeAttribute('onclick');
    card.removeAttribute('hidden');
    card.setAttribute('aria-hidden', 'false');
    card.setAttribute('tabindex', '-1');
    card.disabled = true;
    card.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    return card;
  }

  function renderPreview(items) {
    if (!editorRoot || !draft) return;
    const preview = $('[data-editor-preview]', editorRoot);
    if (!preview) return;
    const visibleItems = previewItems(items, draft);
    const desiredColumns = draft.columns === 'auto' ? Math.min(4, Math.max(1, visibleItems.length)) : Math.min(Number(draft.columns) || 1, Math.max(1, visibleItems.length));
    preview.className = `obraativa-shortcut-editor-preview-grid is-${draft.size}`;
    preview.style.setProperty('--editor-preview-columns', String(desiredColumns));
    preview.replaceChildren(...visibleItems.map(previewCard));
    const empty = $('[data-editor-preview-empty]', editorRoot);
    if (empty) empty.hidden = visibleItems.length > 0;
    const badge = $('[data-editor-preview-count]', editorRoot);
    if (badge) badge.textContent = `${visibleItems.length} ${visibleItems.length === 1 ? 'atalho visível' : 'atalhos visíveis'}`;
  }

  function renderSaveState() {
    if (!editorRoot || !draft) return;
    const changed = preferencesSignature(draft) !== preferencesSignature(committed);
    const status = $('[data-editor-status]', editorRoot);
    if (status) {
      status.className = `obraativa-shortcut-editor-status ${changed ? 'is-dirty' : 'is-saved'}`;
      status.textContent = changed ? 'Alterações prontas para salvar' : 'Nenhuma alteração pendente';
    }
    const apply = $('[data-editor-apply]', editorRoot);
    if (apply) apply.disabled = !changed;
  }

  function renderEditor() {
    if (!editorRoot || !draft) return;
    const home = appHome();
    const items = home ? editableShortcutItems(shortcutItems(home)) : [];
    draft.count = Math.max(1, Math.min(draft.visible.length || 1, Number(draft.count) || 1));
    const byKey = new Map(items.map((item) => [item.key, item]));
    const orderedItems = draft.order.map((key) => byKey.get(key)).filter(Boolean);
    const list = $('.obraativa-shortcut-editor-list', editorRoot);
    if (list) {
      list.replaceChildren(...orderedItems.map((item, index) => listRow(item, index, orderedItems.length, draft)));
    }
    const count = $('[data-editor-count]', editorRoot);
    if (count) {
      count.innerHTML = Array.from({ length: Math.max(1, draft.visible.length) }, (_, index) => `<option value="${index + 1}" ${draft.count === index + 1 ? 'selected' : ''}>${index + 1} ${index ? 'atalhos' : 'atalho'}</option>`).join('');
    }
    const size = $('[data-editor-size]', editorRoot);
    if (size) size.value = draft.size;
    const columns = $('[data-editor-columns]', editorRoot);
    if (columns) columns.value = draft.columns;
    const summary = $('.obraativa-shortcut-editor-summary', editorRoot);
    if (summary) summary.textContent = `${Math.min(draft.count, draft.visible.length)} serão exibidos · ${draft.visible.length} selecionados · ${draft.manual ? 'ordem manual' : 'ordem automática'}`;
    renderPreview(items);
    renderSaveState();
  }

  function ensureEditorRoot() {
    if (editorRoot?.isConnected) return editorRoot;
    editorRoot = document.createElement('div');
    editorRoot.className = 'obraativa-shortcut-editor-backdrop';
    editorRoot.hidden = true;
    editorRoot.innerHTML = `<section class="obraativa-shortcut-editor" role="dialog" aria-modal="true" aria-labelledby="obraativaShortcutEditorTitle">
      <header class="obraativa-shortcut-editor-head">
        <div><small>EDITOR DA PÁGINA INICIAL</small><h2 id="obraativaShortcutEditorTitle">Personalizar acesso rápido</h2><p>Monte a página visualmente. Nada muda para os outros usuários até você salvar.</p></div>
        <div class="obraativa-shortcut-editor-head-actions"><span class="obraativa-shortcut-editor-status is-saved" data-editor-status>Nenhuma alteração pendente</span><button type="button" class="obraativa-shortcut-editor-close" data-editor-close aria-label="Fechar edição">×</button></div>
      </header>
      <div class="obraativa-shortcut-editor-workspace">
        <aside class="obraativa-shortcut-editor-panel">
          <section class="obraativa-shortcut-editor-panel-section"><div class="obraativa-shortcut-editor-step"><span>1</span><div><h3>Escolha e organize</h3><p class="obraativa-shortcut-editor-summary"></p></div></div><p class="obraativa-shortcut-editor-help">Ligue ou desligue os atalhos e use as setas para mudar a ordem.</p><div class="obraativa-shortcut-editor-list"></div></section>
          <section class="obraativa-shortcut-editor-panel-section"><div class="obraativa-shortcut-editor-step"><span>2</span><div><h3>Ajuste o visual</h3><p>Defina a proporção dos cartões.</p></div></div><div class="obraativa-shortcut-editor-options"><label><span>Tamanho</span><select data-editor-size><option value="compact">Compacto</option><option value="comfortable">Confortável</option><option value="spacious">Amplo</option></select></label><label><span>Quantidade na tela</span><select data-editor-count></select></label><label><span>Cartões por linha</span><select data-editor-columns><option value="auto">Automático</option><option value="1">1 por linha</option><option value="2">2 por linha</option><option value="3">3 por linha</option><option value="4">4 por linha</option><option value="5">5 por linha</option></select></label></div></section>
          <section class="obraativa-shortcut-editor-tools" aria-label="Opções rápidas"><button type="button" data-editor-auto><span aria-hidden="true">✦</span><span><b>Organizar automaticamente</b><small>Prioriza os atalhos mais usados.</small></span></button><button type="button" data-editor-reset><span aria-hidden="true">↺</span><span><b>Restaurar padrão</b><small>Volta à configuração inicial.</small></span></button></section>
        </aside>
        <section class="obraativa-shortcut-editor-preview-pane" aria-label="Prévia da página inicial">
          <header><div><small>PRÉVIA AO VIVO</small><h3>Como ficará na página inicial</h3></div><span data-editor-preview-count>0 atalhos visíveis</span></header>
          <div class="obraativa-shortcut-editor-canvas"><div class="obraativa-shortcut-editor-canvas-head"><div><small>PÁGINA INICIAL</small><b>Acesso rápido</b></div><span aria-hidden="true">✎</span></div><div class="obraativa-shortcut-editor-preview-grid" data-editor-preview></div><div class="obraativa-shortcut-editor-empty" data-editor-preview-empty hidden>Selecione pelo menos um atalho para visualizar.</div></div>
          <p class="obraativa-shortcut-editor-preview-note"><span aria-hidden="true">●</span> Esta é somente uma prévia. Use “Salvar página inicial” para confirmar.</p>
        </section>
      </div>
      <footer class="obraativa-shortcut-editor-foot"><button type="button" class="btn alt" data-editor-close>Descartar alterações</button><button type="button" class="btn" data-editor-apply disabled>Salvar página inicial</button></footer>
    </section>`;
    document.body.appendChild(editorRoot);
    editorRoot.addEventListener('click', handleEditorClick);
    editorRoot.addEventListener('change', handleEditorChange);
    editorRoot.addEventListener('click', (event) => {
      if (event.target === editorRoot) closeEditor();
    });
    return editorRoot;
  }

  function openEditor() {
    const home = appHome();
    if (!home) return;
    const items = shortcutItems(home);
    committed = readPreferences(items);
    draft = clonePreferences(committed);
    ensureEditorRoot();
    renderEditor();
    editorRoot.hidden = false;
    document.body.classList.add('obraativa-editor-open');
    window.setTimeout(() => $('.obraativa-shortcut-editor-list input', editorRoot)?.focus(), 0);
  }

  function closeEditor(revert = true) {
    if (!editorRoot) return;
    if (revert && committed) {
      const home = appHome();
      if (home) applyPreferences(home, committed);
    }
    editorRoot.hidden = true;
    document.body.classList.remove('obraativa-editor-open');
    draft = null;
    committed = null;
    window.dispatchEvent(new Event('obraativa-home-editor-closed'));
  }

  function moveDraft(key, direction) {
    if (!draft) return;
    const index = draft.order.indexOf(key);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= draft.order.length) return;
    [draft.order[index], draft.order[target]] = [draft.order[target], draft.order[index]];
    draft.manual = true;
    renderEditor();
  }

  function handleEditorClick(event) {
    const move = event.target.closest('[data-move]');
    if (move) {
      const row = move.closest('[data-key]');
      if (row) moveDraft(row.dataset.key, move.dataset.move);
      return;
    }
    if (event.target.closest('[data-editor-close]')) { closeEditor(); return; }
    if (event.target.closest('[data-editor-reset]')) {
      const home = appHome();
      draft = defaultPreferences(home ? editableShortcutItems(shortcutItems(home)) : []);
      draft.manual = true;
      renderEditor();
      return;
    }
    if (event.target.closest('[data-editor-auto]')) {
      const home = appHome();
      const items = home ? editableShortcutItems(shortcutItems(home)) : [];
      const defaults = defaultPreferences(items);
      const order = automaticOrder(items, defaults.order);
      draft = { ...defaults, order, visible: [...order], manual: false, autoUpdatedAt: Date.now() };
      renderEditor();
      return;
    }
    if (event.target.closest('[data-editor-apply]')) {
      if (!draft) return;
      writePreferences(draft);
      const home = appHome();
      if (home) applyPreferences(home, draft);
      const appliedDetail = { count: draft.count, columns: draft.columns, size: draft.size };
      const appliedSignature = home ? homeSignature(home, draft) : '';
      closeEditor(false);
      lastHomeSignature = appliedSignature;
      window.dispatchEvent(new CustomEvent('obraativa-home-shortcuts-updated', { detail: appliedDetail }));
      scheduleRefresh();
    }
  }

  function handleEditorChange(event) {
    if (!draft) return;
    const checkbox = event.target.closest('[data-shortcut-visible]');
    if (checkbox) {
      const key = checkbox.dataset.shortcutVisible;
      const previousVisibleCount = draft.visible.length;
      if (!checkbox.checked && draft.visible.length <= 1) {
        checkbox.checked = true;
        const status = $('[data-editor-status]', editorRoot);
        if (status) { status.className = 'obraativa-shortcut-editor-status is-warning'; status.textContent = 'Mantenha pelo menos um atalho visível'; }
        return;
      }
      draft.visible = checkbox.checked ? [...new Set([...draft.visible, key])] : draft.visible.filter((item) => item !== key);
      if (checkbox.checked && draft.count >= previousVisibleCount) draft.count = draft.visible.length;
      if (!checkbox.checked) draft.count = Math.min(draft.count, draft.visible.length);
      draft.manual = true;
      renderEditor();
      return;
    }
    const size = event.target.closest('[data-editor-size]');
    if (size) draft.size = SIZE_VALUES.has(size.value) ? size.value : 'comfortable';
    const count = event.target.closest('[data-editor-count]');
    if (count) draft.count = Math.max(1, Number(count.value) || 1);
    const columns = event.target.closest('[data-editor-columns]');
    if (columns) draft.columns = COLUMN_VALUES.has(columns.value) ? columns.value : 'auto';
    if (size || count || columns) renderEditor();
  }

  function homeSignature(home, preferences) {
    const items = shortcutItems(home);
    return `${items.map((item) => `${item.key}:${item.button.hidden ? 0 : 1}`).join('|')}::${JSON.stringify(preferences)}`;
  }

  function refresh() {
    const home = appHome();
    if (!home) { lastHomeSignature = ''; return; }
    installEditorButton(home);
    const items = shortcutItems(home);
    if (!items.length) return;
    const preferences = readPreferences(items);
    const signatureBefore = homeSignature(home, preferences);
    if (signatureBefore === lastHomeSignature) return;
    applyPreferences(home, preferences);
    lastHomeSignature = homeSignature(home, preferences);
  }

  function scheduleRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    const frame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
    frame(() => {
      refreshQueued = false;
      refresh();
    });
  }

  function install() {
    const app = document.getElementById('app');
    if (!app) { window.setTimeout(install, 100); return; }
    new MutationObserver(scheduleRefresh).observe(app, { childList: true, subtree: true });
    if (!document.__obraativaShortcutUsageBound) {
      document.__obraativaShortcutUsageBound = true;
      document.addEventListener('click', (event) => {
        const button = event.target.closest?.('.home-shortcut, #nav button');
        if (!button) return;
        rememberUsage(shortcutKey(button));
      });
    }
    window.addEventListener('storage', (event) => {
      if (event.key === preferenceKey()) { lastHomeSignature = ''; scheduleRefresh(); }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && editorRoot && !editorRoot.hidden) closeEditor();
    });
    scheduleRefresh();
  }

  window.ObraAtivaHomeShortcutEditor = Object.freeze({ refresh: scheduleRefresh, open: openEditor });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
