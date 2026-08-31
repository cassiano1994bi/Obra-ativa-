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
  const updateText = (element, value) => {
    if (element && element.textContent !== value) element.textContent = value;
  };
  const updateHtml = (element, value) => {
    if (element && element.innerHTML !== value) element.innerHTML = value;
  };

  function canOpen(module) {
    if (window.__OBRAATIVA_PREVIEW_DATA__) return true;
    return safeCall(() => typeof window.AccessControl?.canOpen === 'function' ? window.AccessControl.canOpen(module) === true : true, true);
  }

  function dashboardAccess() {
    return {
      works: canOpen('works'),
      planning: canOpen('planning'),
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

  function currentDateKey() {
    return safeCall(() => typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));
  }

  function currentDateLabel() {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    }).format(new Date()).replace(/^./, (letter) => letter.toUpperCase());
  }

  function employeeIsActive(employee) {
    return employee && employee.active !== false && employee.archived !== true && employee.status !== 'Inativo';
  }

  function scheduleTodayRows(data, date, works) {
    const employees = Array.isArray(data.employees) ? data.employees : [];
    const employeeById = new Map(employees.filter(employeeIsActive).map((employee) => [employee.id, employee]));
    const workById = new Map(works.map((work) => [work.id, work]));
    const groups = new Map();
    (Array.isArray(data.distributions) ? data.distributions : [])
      .filter((item) => item.date === date && employeeById.has(item.employeeId))
      .forEach((item) => {
        const work = workById.get(item.workId);
        if (!work) return;
        if (!groups.has(work.id)) groups.set(work.id, { work, people: [] });
        const employee = employeeById.get(item.employeeId);
        if (!groups.get(work.id).people.some((person) => person.id === employee.id)) groups.get(work.id).people.push(employee);
      });
    return [...groups.values()].sort((a, b) => String(a.work.name || '').localeCompare(String(b.work.name || ''), 'pt-BR'));
  }

  function scheduleResponsible(group) {
    const registered = String(group.work?.responsible || '').trim();
    if (registered) return registered;
    const lead = group.people.find((person) => /mestre|encarregado|supervisor|respons[aá]vel/i.test(String(person.role || person.function || '')));
    return lead?.name || 'Responsável não informado';
  }

  function workProgress(work) {
    const phase = safeCall(() => typeof workCurrentPhase === 'function' ? workCurrentPhase(work.id) : null, null);
    const raw = phase?.percent ?? work.progress ?? work.percent ?? (work.status === 'Finalizada' ? 100 : 0);
    const percent = Math.max(0, Math.min(100, Number(raw) || 0));
    return { percent, label: phase?.name || work.phase || work.status || 'Em acompanhamento' };
  }

  function dashboardData() {
    const data = appData();
    const preview = Boolean(window.__OBRAATIVA_PREVIEW_DATA__);
    const access = dashboardAccess();
    const works = access.works ? activeWorkRows(data) : [];
    const date = currentDateKey();
    const todayPeople = new Set((access.attendance && Array.isArray(data.attendance) ? data.attendance : [])
      .filter((item) => item.date === date && ['Trabalhou', 'Meio período'].includes(item.status))
      .map((item) => item.employeeId));
    const schedule = access.planning ? scheduleTodayRows(data, date, works) : [];
    const scheduledPeople = new Set(schedule.flatMap((group) => group.people.map((person) => person.id)));
    const cycleRows = access.payments && !preview ? safeCall(() => typeof payroll === 'function' && typeof nextFriday === 'function' ? payroll(nextFriday()) : [], []) : [];
    const pending = preview ? Number(data.pending || 0) : cycleRows.reduce((sum, row) => sum + Math.max(Number(row.balance || 0), 0), 0);
    const financeRows = access.financial && !preview ? safeCall(() => typeof workCashRows === 'function' ? workCashRows() : [], []) : [];
    const received = preview ? Number(data.received || 0) : financeRows.reduce((sum, row) => sum + Number(row.received || 0), 0);
    const labor = preview ? Number(data.labor || 0) : financeRows.reduce((sum, row) => sum + Number(row.labor || 0), 0);
    const expected = preview ? Number(data.expected || 0) : financeRows.reduce((sum, row) => sum + Number(row.expected || 0), 0);
    const balance = preview ? Number(data.balance || 0) : financeRows.reduce((sum, row) => sum + Number(row.cash || 0), 0);
    const financeHasData = preview ? [received, labor, expected, balance].some((value) => value !== 0) : financeRows.some((row) => [row.received, row.labor, row.expected, row.cash]
      .some((value) => Number(value || 0) !== 0));
    return {
      works, worksCount: works.length, teamToday: preview ? Number(data.teamToday || 0) : todayPeople.size, schedule,
      scheduledToday: preview ? Number(data.scheduledToday || scheduledPeople.size) : scheduledPeople.size,
      pending, received, labor, expected, balance, financeHasData, access, date, dateLabel: currentDateLabel()
    };
  }

  function metricsMarkup(model) {
    const cards = [];
    if (model.access?.attendance !== false) cards.push(`<article class="obraativa-metric"><span class="obraativa-metric-icon">${iconArt('team')}</span><div><small>Equipe hoje</small><strong>${model.teamToday}</strong><span>presenças confirmadas</span></div></article>`);
    if (model.access?.financial !== false) cards.push(`<article class="obraativa-metric green ${model.balance < 0 ? 'negative' : ''}"><span class="obraativa-metric-icon">${iconArt('financial')}</span><div><small>Financeiro</small><strong>${localMoney(model.balance)}</strong><span>saldo das obras</span></div></article>`);
    return cards.length ? `<section class="obraativa-metrics" data-count="${cards.length}" aria-label="Resumo da operação">${cards.join('')}</section>` : '';
  }

  function scheduleMarkup(model) {
    if (model.access?.planning === false) return '';
    const rows = model.schedule.map((group) => {
      const people = group.people.map((person) => person.name).filter(Boolean).join(' · ');
      return `<article class="obraativa-schedule-row"><span class="obraativa-schedule-icon">${iconArt('planning')}</span><div class="obraativa-schedule-copy"><b>${escapeHtml(group.work.name || 'Obra sem nome')}</b><small>${escapeHtml(people || 'Equipe ainda não informada')}</small></div><div class="obraativa-schedule-meta"><strong>${group.people.length}</strong><span>${group.people.length === 1 ? 'profissional' : 'profissionais'}</span></div><div class="obraativa-schedule-lead"><small>RESPONSÁVEL</small><b>${escapeHtml(scheduleResponsible(group))}</b></div></article>`;
    }).join('');
    const content = rows || `<div class="obraativa-empty obraativa-schedule-empty"><span>${iconArt('planning')}</span><div><b>Nenhuma escala registrada para hoje.</b><small>Organize a equipe na Escala diária para acompanhar a distribuição por obra aqui.</small></div></div>`;
    return `<section class="obraativa-panel obraativa-schedule-panel"><header class="obraativa-panel-head"><div><span class="obraativa-section-kicker">ROTINA DO CANTEIRO</span><h2>Escala de Hoje</h2><p>${escapeHtml(model.dateLabel)}</p></div><button class="obraativa-panel-link" type="button" onclick="go('planning')">Abrir escala completa</button></header><div class="obraativa-schedule-list">${content}</div></section>`;
  }

  function worksMarkup(model) {
    const rows = model.works.map((work) => {
      const progress = workProgress(work);
      const scheduled = model.schedule.find((group) => group.work.id === work.id)?.people.length || 0;
      const responsible = String(work.responsible || '').trim();
      return `<article class="obraativa-work-row"><span class="obraativa-work-icon">${iconArt('works')}</span><div class="obraativa-work-copy"><b>${escapeHtml(work.name || 'Obra sem nome')}</b><small>${escapeHtml(progress.label)}${responsible ? ` · ${escapeHtml(responsible)}` : ''}</small><div class="obraativa-work-tags"><span>${scheduled} ${scheduled === 1 ? 'escalado hoje' : 'escalados hoje'}</span><span>${progress.percent}% concluída</span></div><div class="obraativa-work-progress"><div class="obraativa-progress" aria-label="${progress.percent}% concluído"><i style="width:${progress.percent}%"></i></div><span class="obraativa-work-percent">${progress.percent}%</span></div><button class="obraativa-work-open" type="button" onclick="go('works')">Ver detalhes</button></div><span class="obraativa-work-chevron" aria-hidden="true">›</span></article>`;
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
    if (model.access?.works !== false) panels.push(`<article class="obraativa-panel obraativa-works-panel"><header class="obraativa-panel-head"><div><span class="obraativa-section-kicker">ACOMPANHAMENTO</span><h2>Obras em andamento</h2><p>Situação, equipe e progresso em uma única visão.</p></div><button class="obraativa-panel-link" type="button" onclick="go('works')">Ver todas</button></header><div class="obraativa-work-list">${worksMarkup(model)}</div></article>`);
    if (model.access?.financial !== false) panels.push(`<article class="obraativa-panel obraativa-finance-panel"><header class="obraativa-panel-head"><div><span class="obraativa-section-kicker">CONTROLE FINANCEIRO</span><h2>Resumo financeiro</h2><p>Leitura rápida sem transformar a Home em planilha.</p></div><button class="obraativa-panel-link" type="button" onclick="go('financial')">Abrir financeiro</button></header>${financePanelMarkup(model)}</article>`);
    return panels.length ? `<section class="obraativa-overview-grid" data-count="${panels.length}" aria-label="Obras e resumo financeiro">${panels.join('')}</section>` : '';
  }

  function homeBrandMarkup(data) {
    const logo = String(data.settings?.companyLogo || 'public-assets/obraativa-app-icon-v2-192.png');
    return `<div class="obraativa-home-brandline"><img src="${escapeHtml(logo)}" alt="ObraAtiva"><span><b>ObraAtiva</b><small>GESTÃO INTELIGENTE DE OBRAS</small></span></div>`;
  }

  function decorateHome() {
    const home = document.querySelector('#app:not(.public-app) #view .home-operational');
    if (!home) return;
    home.classList.add('obraativa-home', 'obraativa-home-premium');
    const data = appData();
    const head = home.querySelector('.home-operational-head');
    if (head) {
      const copyArea = head.querySelector(':scope>div');
      if (copyArea && !copyArea.querySelector('.obraativa-home-brandline')) copyArea.insertAdjacentHTML('afterbegin', homeBrandMarkup(data));
      const eyebrow = head.querySelector(':scope>div>small');
      const heading = head.querySelector(':scope>div>h1');
      const copy = head.querySelector(':scope>div>p');
      const responsible = String(data.settings?.responsible || '').trim();
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
      eyebrow?.remove();
      updateHtml(heading, `<span class="obraativa-home-greeting">${escapeHtml(greeting)}</span>${responsible ? `<span class="obraativa-home-user-name">, ${escapeHtml(responsible)}</span>` : ''} <span aria-hidden="true">👋</span>`);
      updateText(copy, 'Aqui está o resumo da sua gestão hoje.');
      let date = copyArea?.querySelector('.obraativa-home-date');
      if (!date && copyArea) {
        copyArea.insertAdjacentHTML('beforeend', `<time class="obraativa-home-date" datetime="${currentDateKey()}">${escapeHtml(currentDateLabel())}</time>`);
        date = copyArea.querySelector('.obraativa-home-date');
      }
      updateText(date, currentDateLabel());
    }
    const shortcuts = home.querySelector('.home-shortcuts');
    const quickSection = shortcuts?.closest('section');
    quickSection?.classList.add('obraativa-quick-section');
    shortcuts?.querySelectorAll('.home-shortcut').forEach((button) => {
      if (navKey(button) === 'financial') button.remove();
    });
    decorateShortcuts(home);
    home.querySelectorAll('.home-insight-panel').forEach((panel) => {
      const title = panel.querySelector('h2');
      const label = title?.textContent || '';
      if (/últimas movimentações|atividades recentes/i.test(label)) {
        panel.classList.add('obraativa-activity-panel');
        updateText(title, 'Atividades recentes');
      }
      if (/precisam de atenção/i.test(label)) panel.classList.add('obraativa-attention-panel');
    });
    const model = dashboardData();
    const signature = JSON.stringify({
      works: model.works.map((work) => [work.id, work.name, work.status, work.progress, work.percent]),
      schedule: model.schedule.map((group) => [group.work.id, group.people.map((person) => person.id), scheduleResponsible(group)]),
      worksCount: model.worksCount, teamToday: model.teamToday, scheduledToday: model.scheduledToday, pending: model.pending,
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
    let schedule = home.querySelector(':scope>.obraativa-schedule-panel');
    const scheduleContent = scheduleMarkup(model);
    if (scheduleContent) {
      if (!schedule) {
        const scheduleAnchor = metrics || quickSection || head;
        if (scheduleAnchor) scheduleAnchor.insertAdjacentHTML('afterend', scheduleContent);
        else home.insertAdjacentHTML('beforeend', scheduleContent);
        schedule = home.querySelector(':scope>.obraativa-schedule-panel');
      } else if (schedule.dataset.signature !== signature) {
        schedule.outerHTML = scheduleContent;
        schedule = home.querySelector(':scope>.obraativa-schedule-panel');
      }
      if (schedule) schedule.dataset.signature = signature;
    } else {
      schedule?.remove();
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
    const insights = home.querySelector(':scope>.home-insights');
    const weather = home.querySelector(':scope>.home-weather-card');
    const assistant = home.querySelector(':scope>.assistant-home-shortcut');
    const desiredOrder = [head, quickSection, metrics, weather, schedule, overview, insights, assistant].filter(Boolean);
    const currentOrder = [...home.children].filter((section) => desiredOrder.includes(section));
    if (currentOrder.length !== desiredOrder.length || currentOrder.some((section, index) => section !== desiredOrder[index])) {
      desiredOrder.forEach((section) => home.appendChild(section));
    }
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
    updateHtml(text, '<small>GESTÃO INTELIGENTE DE OBRAS</small><span>Obra<b>Ativa</b></span>');
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
