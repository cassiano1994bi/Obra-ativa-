(() => {
  'use strict';

  const ICON_PATHS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/>',
    works: '<path d="M4 21V8l8-4v17"/><path d="M12 10h8v11"/><path d="M7 11h2m-2 4h2m6-1h2m-2 4h2M2 21h20"/>',
    planning: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16m-12 4h3m2 0h3m-8 3h3"/>',
    attendance: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4m8-4v4M4 9h16m-11 5 2 2 4-4"/>',
    payments: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5c-.8-.7-1.9-1-3.2-1-1.7 0-3 .8-3 2s1.1 1.8 3.2 2.2 3.2 1 3.2 2.4-1.3 2.4-3.3 2.4c-1.4 0-2.7-.4-3.7-1.2M12 5v14"/>',
    financial: '<path d="M5 20V10m7 10V4m7 16v-7"/><path d="M3 20h18"/>',
    clients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87m-2-12a4 4 0 0 1 0 7.75"/>',
    team: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2M5 7H3m18 0h-2"/>',
    budgets: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6m-6 4h6"/>',
    reports: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 17v-3m3 3V9m3 8v-5"/>',
    vehicles: '<path d="M5 17h14l-1.5-5h-11z"/><path d="M3 17v2h2m14 0h2v-2M7 12l1-4h8l1 4"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
    textpdf: '<path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 11h6m-6 4h6"/>',
    assistant: '<rect x="4" y="7" width="16" height="12" rx="4"/><path d="M9 12h.01M15 12h.01M9 16h6M12 7V4m-2 0h4M2 12h2m16 0h2"/>',
    permissions: '<path d="M12 3 5 6v5c0 4.5 2.8 8.2 7 10 4.2-1.8 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    admin: '<path d="M12 3 5 6v5c0 4.5 2.8 8.2 7 10 4.2-1.8 7-5.5 7-10V6z"/><circle cx="12" cy="10" r="2"/><path d="M8.5 16c.8-1.6 2-2.4 3.5-2.4s2.7.8 3.5 2.4"/>'
  };

  const NAV_LABELS = {
    home: 'Início', works: 'Obras', planning: 'Escala diária', attendance: 'Presença',
    payments: 'Pagamentos', financial: 'Financeiro', clients: 'Clientes', team: 'Equipe',
    budgets: 'Orçamentos', estimates: 'Orçamentos', vehicles: 'Veículos', reports: 'Relatórios',
    textpdf: 'Escrever e gerar PDF', assistant: 'Assistente IA', permissions: 'Administrador',
    admin: 'Administrador', routine: 'Lembretes importantes', 'site-management': 'Meu site'
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const UI_ICON_KEYS = new Set(['home', 'works', 'planning', 'attendance', 'payments', 'financial', 'clients', 'team', 'budgets', 'reports', 'vehicles', 'textpdf', 'assistant', 'permissions', 'admin', 'routine', 'site']);
  const iconArt = (key) => `<i class="obraativa-icon-art obraativa-icon-${escapeHtml(iconKey(key))}" aria-hidden="true"></i>`;
  const localMoney = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const safeCall = (callback, fallback) => { try { return callback(); } catch (error) { return fallback; } };

  function canOpen(module) {
    if (window.__OBRAATIVA_PREVIEW_DATA__) return true;
    return safeCall(() => typeof window.AccessControl?.canOpen === 'function' ? window.AccessControl.canOpen(module) === true : true, true);
  }

  function dashboardAccess() {
    return {
      works: canOpen('works'),
      attendance: canOpen('attendance'),
      payments: canOpen('payments'),
      financial: canOpen('financial')
    };
  }

  function appData() {
    if (window.__OBRAATIVA_PREVIEW_DATA__) return window.__OBRAATIVA_PREVIEW_DATA__;
    return safeCall(() => db, { settings: {}, works: [], employees: [], attendance: [], audit: [] });
  }

  function activeWorkRows(data) {
    return (Array.isArray(data.works) ? data.works : []).filter((work) => !work.archived && work.status !== 'Finalizada');
  }

  function workProgress(work) {
    const phase = safeCall(() => typeof workCurrentPhase === 'function' ? workCurrentPhase(work.id) : null, null);
    const raw = phase?.percent ?? work.progress ?? work.percent ?? (work.status === 'Finalizada' ? 100 : 0);
    const percent = Math.max(0, Math.min(100, Number(raw) || 0));
    return { percent, label: phase?.name || work.phase || work.status || 'Em acompanhamento' };
  }

  function dashboardData() {
    const data = appData();
    if (window.__OBRAATIVA_PREVIEW_DATA__) return data;
    const access = dashboardAccess();
    const works = access.works ? activeWorkRows(data) : [];
    const date = safeCall(() => typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));
    const todayPeople = new Set((access.attendance && Array.isArray(data.attendance) ? data.attendance : [])
      .filter((item) => item.date === date && ['Trabalhou', 'Meio período'].includes(item.status))
      .map((item) => item.employeeId));
    const cycleRows = access.payments ? safeCall(() => typeof payroll === 'function' && typeof nextFriday === 'function' ? payroll(nextFriday()) : [], []) : [];
    const pending = cycleRows.reduce((sum, row) => sum + Math.max(Number(row.balance || 0), 0), 0);
    const financeRows = access.financial ? safeCall(() => typeof workCashRows === 'function' ? workCashRows() : [], []) : [];
    const received = financeRows.reduce((sum, row) => sum + Number(row.received || 0), 0);
    const labor = financeRows.reduce((sum, row) => sum + Number(row.labor || 0), 0);
    const expected = financeRows.reduce((sum, row) => sum + Number(row.expected || 0), 0);
    const balance = financeRows.reduce((sum, row) => sum + Number(row.cash || 0), 0);
    const financeHasData = financeRows.some((row) => [row.received, row.labor, row.expected, row.cash]
      .some((value) => Number(value || 0) !== 0));
    return { works, worksCount: works.length, teamToday: todayPeople.size, pending, received, labor, expected, balance, financeHasData, access };
  }

  function metricsMarkup(model) {
    const cards = [];
    if (model.access?.works !== false) cards.push(`<article class="obraativa-metric green"><span class="obraativa-metric-icon">${iconArt('works')}</span><div><small>Obras em andamento</small><strong>${model.worksCount}</strong></div></article>`);
    if (model.access?.attendance !== false) cards.push(`<article class="obraativa-metric"><span class="obraativa-metric-icon">${iconArt('team')}</span><div><small>Equipe hoje</small><strong>${model.teamToday}</strong></div></article>`);
    if (model.access?.payments !== false) cards.push(`<article class="obraativa-metric"><span class="obraativa-metric-icon">${iconArt('payments')}</span><div><small>Pagamentos pendentes</small><strong>${localMoney(model.pending)}</strong></div></article>`);
    if (model.access?.financial !== false) cards.push(`<article class="obraativa-metric green ${model.balance < 0 ? 'negative' : ''}"><span class="obraativa-metric-icon">${iconArt('financial')}</span><div><small>Saldo das obras</small><strong>${localMoney(model.balance)}</strong></div></article>`);
    return cards.length ? `<section class="obraativa-metrics" data-count="${cards.length}" aria-label="Resumo da operação">${cards.join('')}</section>` : '';
  }

  function worksMarkup(model) {
    const rows = model.works.slice(0, 2).map((work) => {
      const progress = workProgress(work);
      return `<article class="obraativa-work-row"><span class="obraativa-work-icon">${iconArt('works')}</span><div class="obraativa-work-copy"><b>${escapeHtml(work.name || 'Obra sem nome')}</b><small>${escapeHtml(progress.label)}</small><div class="obraativa-work-progress"><div class="obraativa-progress" aria-label="${progress.percent}% concluído"><i style="width:${progress.percent}%"></i></div><span class="obraativa-work-percent">${progress.percent}%</span></div><button class="obraativa-work-open" type="button" onclick="go('works')">Ver obra</button></div><span class="obraativa-work-chevron" aria-hidden="true">›</span></article>`;
    }).join('');
    return rows || '<p class="obraativa-empty">Nenhuma obra ativa cadastrada.</p>';
  }

  function barMarkup(label, value, maximum, green = false) {
    const width = maximum > 0 ? Math.max(2, Math.min(100, Math.abs(value) / maximum * 100)) : 0;
    return `<div class="obraativa-bar-row ${green ? 'green' : ''}"><span>${escapeHtml(label)}</span><div class="obraativa-bar-track"><i style="--obraativa-bar:${width}%;width:${width}%"></i></div><b>${localMoney(value)}</b></div>`;
  }

  function financePanelMarkup(model) {
    if (!model.financeHasData) {
      return '<p class="obraativa-empty obraativa-finance-empty">Ainda não há dados financeiros suficientes para gerar este gráfico.</p>';
    }
    const maximum = Math.max(Math.abs(model.received), Math.abs(model.labor), Math.abs(model.expected), 1);
    return `<div class="obraativa-finance-body"><div class="obraativa-finance-total"><article><small>SALDO ATUAL</small><b>${localMoney(model.balance)}</b></article><article><small>PREVISTO A RECEBER</small><b>${localMoney(model.expected)}</b></article></div><div class="obraativa-bars">${barMarkup('Entradas', model.received, maximum)}${barMarkup('Mão de obra', model.labor, maximum, true)}${barMarkup('Previsto', model.expected, maximum)}</div></div>`;
  }

  function overviewMarkup(model) {
    const panels = [];
    if (model.access?.works !== false) panels.push(`<article class="obraativa-panel obraativa-works-panel"><header class="obraativa-panel-head"><h2>Obras em andamento</h2><button class="obraativa-panel-link" type="button" onclick="go('works')">Ver todas</button></header><div class="obraativa-work-list">${worksMarkup(model)}</div></article>`);
    if (model.access?.financial !== false) panels.push(`<article class="obraativa-panel obraativa-finance-panel"><header class="obraativa-panel-head"><h2>Resumo financeiro</h2><button class="obraativa-panel-link" type="button" onclick="go('financial')">Abrir financeiro</button></header>${financePanelMarkup(model)}</article>`);
    return panels.length ? `<section class="obraativa-overview-grid" data-count="${panels.length}" aria-label="Obras e resumo financeiro">${panels.join('')}</section>` : '';
  }

  function decorateHome() {
    const home = document.querySelector('#app:not(.public-app) #view .home-operational');
    if (!home) return;
    home.classList.add('obraativa-home');
    const data = appData();
    const head = home.querySelector('.home-operational-head');
    if (head) {
      const eyebrow = head.querySelector(':scope>div>small');
      const heading = head.querySelector(':scope>div>h1');
      const copy = head.querySelector(':scope>div>p');
      const responsible = String(data.settings?.responsible || '').trim();
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
      if (eyebrow) eyebrow.textContent = 'VISÃO GERAL';
      if (heading) heading.textContent = `${greeting}${responsible ? `, ${responsible}` : ''} 👋`;
      if (copy) copy.textContent = 'Aqui está o resumo da sua gestão hoje.';
    }
    const shortcuts = home.querySelector('.home-shortcuts');
    const quickSection = shortcuts?.closest('section');
    quickSection?.classList.add('obraativa-quick-section');
    decorateShortcuts(home);
    home.querySelectorAll('.home-insight-panel').forEach((panel) => {
      const title = panel.querySelector('h2');
      const label = title?.textContent || '';
      if (/últimas movimentações|atividades recentes/i.test(label)) {
        panel.classList.add('obraativa-activity-panel');
        if (title) title.textContent = 'Atividades recentes';
      }
      if (/precisam de atenção/i.test(label)) panel.classList.add('obraativa-attention-panel');
    });
    const model = dashboardData();
    const signature = JSON.stringify({
      works: model.works.map((work) => [work.id, work.name, work.status, work.progress, work.percent]),
      worksCount: model.worksCount, teamToday: model.teamToday, pending: model.pending,
      received: model.received, labor: model.labor, expected: model.expected, balance: model.balance, financeHasData: model.financeHasData,
      access: model.access
    });
    // Keep the quick-access block physically next to the header. The explicit
    // DOM order is intentional so it remains the first content block even if
    // a device or an older stylesheet ignores the grid-row rules.
    const quickAnchor = head?.nextElementSibling || home.firstElementChild;
    if (quickSection && quickAnchor && quickSection !== quickAnchor) {
      home.insertBefore(quickSection, quickAnchor);
    }
    let metrics = home.querySelector(':scope>.obraativa-metrics');
    const metricMarkup = metricsMarkup(model);
    if (metricMarkup) {
      if (!metrics) {
        const metricAnchor = quickSection || head;
        if (metricAnchor) metricAnchor.insertAdjacentHTML('afterend', metricMarkup);
        else home.insertAdjacentHTML('afterbegin', metricMarkup);
        metrics = home.querySelector(':scope>.obraativa-metrics');
      } else if (metrics.dataset.signature !== signature) {
        metrics.outerHTML = metricMarkup;
        metrics = home.querySelector(':scope>.obraativa-metrics');
      }
      if (metrics) metrics.dataset.signature = signature;
    } else {
      metrics?.remove();
    }
    let overview = home.querySelector(':scope>.obraativa-overview-grid');
    if (!overview) {
      home.insertAdjacentHTML('beforeend', overviewMarkup(model));
      overview = home.querySelector(':scope>.obraativa-overview-grid');
    } else if (overview.dataset.signature !== signature) {
      overview.outerHTML = overviewMarkup(model);
      overview = home.querySelector(':scope>.obraativa-overview-grid');
    }
    if (overview) overview.dataset.signature = signature;
  }

  function navKey(button) {
    const handler = button.getAttribute('onclick') || '';
    const match = handler.match(/go\(['"]([^'"]+)['"]\)/);
    if (match) return match[1];
    const text = button.textContent.toLowerCase();
    if (text.includes('orçamento')) return 'budgets';
    if (text.includes('assistente')) return 'assistant';
    if (text.includes('administr')) return 'admin';
    if (text.includes('permiss')) return 'permissions';
    return '';
  }

  function iconKey(key) {
    if (key === 'estimates' || key === 'budgets') return 'budgets';
    if (key === 'site-management') return 'site';
    return UI_ICON_KEYS.has(key) ? key : 'reports';
  }

  function decorateNavigation() {
    document.querySelectorAll('#app:not(.public-app) #nav button:not(.nav-more)').forEach((button) => {
      if (button.dataset.obraativaDecorated === '1') return;
      const key = navKey(button);
      if (!key) return;
      const label = NAV_LABELS[key] || button.textContent.replace(/^[^\p{L}\p{N}]+/u, '').trim();
      button.dataset.obraativaDecorated = '1';
      button.dataset.obraativaNav = key;
      button.setAttribute('aria-label', label);
      button.innerHTML = `<span class="obraativa-nav-icon">${iconArt(key)}</span><span>${escapeHtml(label)}</span>`;
    });
  }

  function decorateShortcuts(scope = document) {
    scope.querySelectorAll('.home-shortcut').forEach((button) => {
      const key = navKey(button);
      const target = button.querySelector('.home-shortcut-icon');
      if (!key || !target || target.dataset.obraativaDecorated === '1') return;
      target.dataset.obraativaDecorated = '1';
      target.classList.add('obraativa-shortcut-svg');
      target.innerHTML = iconArt(key);
    });
  }

  function decorateBrand() {
    const brand = document.querySelector('#app:not(.public-app) .side .brand');
    if (!brand) return;
    let mark = brand.querySelector('.obraativa-brand-mark');
    if (!mark) {
      mark = document.createElement('span');
      mark.className = 'obraativa-brand-mark';
      mark.setAttribute('aria-hidden', 'true');
      brand.prepend(mark);
    }
    const data = appData();
    const hasCompanyLogo = Boolean(data.settings?.companyLogo);
    brand.classList.toggle('obraativa-default-logo', !hasCompanyLogo);
    const text = brand.querySelector('.brand-text');
    if (text) text.innerHTML = '<small>GESTÃO INTELIGENTE DE OBRAS</small><span>Obra<b>Ativa</b></span>';
    const defaultImage = brand.querySelector('.brand-logo');
    if (defaultImage && !hasCompanyLogo) defaultImage.alt = 'ObraAtiva';
  }

  function showSplash(duration = 760) {
    let splash = document.getElementById('obraAtivaSplash');
    if (!splash) {
      splash = document.createElement('div');
      splash.id = 'obraAtivaSplash';
      splash.setAttribute('role', 'status');
      splash.setAttribute('aria-label', 'Abrindo ObraAtiva');
      splash.innerHTML = '<div class="obraativa-splash-card"><span class="obraativa-splash-mark" aria-hidden="true"></span><div class="obraativa-splash-name">Obra<b>Ativa</b></div><div class="obraativa-splash-subtitle">GESTÃO INTELIGENTE DE OBRAS</div><div class="obraativa-splash-slogan">Sua obra sob <b>controle.</b></div><div class="obraativa-splash-progress" aria-hidden="true"><i></i></div></div>';
      document.body.prepend(splash);
    }
    splash.hidden = false;
    splash.classList.remove('obraativa-splash-leave');
    const close = () => {
      if (!splash?.isConnected) return;
      splash.classList.add('obraativa-splash-leave');
      window.setTimeout(() => { splash.remove(); }, 360);
    };
    window.setTimeout(close, Math.max(350, Number(duration) || 1250));
    window.setTimeout(() => { splash?.remove(); }, 3200);
    return close;
  }

  let refreshQueued = false;
  function refresh() {
    decorateBrand();
    decorateNavigation();
    decorateHome();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      refresh();
    });
  }

  function install() {
    const app = document.getElementById('app');
    if (!app) { window.setTimeout(install, 80); return; }
    new MutationObserver(queueRefresh).observe(app, { childList: true, subtree: true });
    if (typeof window.applyCompanyLogo === 'function' && !window.applyCompanyLogo.__obraativaWrapped) {
      const before = window.applyCompanyLogo;
      const wrapped = function (...args) {
        const result = before.apply(this, args);
        queueRefresh();
        return result;
      };
      wrapped.__obraativaWrapped = true;
      window.applyCompanyLogo = wrapped;
    }
    queueRefresh();
  }

  window.ObraAtivaVisualV1 = { refresh: queueRefresh, showSplash };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
