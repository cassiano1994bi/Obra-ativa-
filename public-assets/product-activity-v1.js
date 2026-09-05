(() => {
  'use strict';
  const KEY = 'oa-optional-measurement-v1:';
  const MODULES = new Set(['home', 'works', 'planning', 'team', 'attendance', 'payments', 'financial', 'vehicles', 'reports', 'assistant', 'permissions', 'reminders', 'budgets']);
  let identity = '', session = '', lastInput = Date.now(), lastSample = Date.now(), seconds = 0;
  let lastSend = 0, retryAt = 0, linkRetryAt = 0, configured = false, enabled = false, busy = false, linked = false, publicSent = false;
  const currentUser = () => window.CloudSync?.session?.user?.id || 'visitor';
  const config = () => typeof CLOUD_CONFIG !== 'undefined' ? CLOUD_CONFIG : null;
  const choice = () => { try { return localStorage.getItem(KEY + currentUser()); } catch { return null; } };
  const token = () => window.CloudSync?.session?.access_token;
  const moduleName = () => { const value = typeof page !== 'undefined' ? page : 'home'; return MODULES.has(value) ? value : 'home'; };
  async function rpc(name, args, keepalive = false) {
    const cfg = config(), access = token();
    if (!cfg || !access) throw new Error('unavailable');
    const response = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, { method: 'POST', keepalive, signal: AbortSignal.timeout(5000),
      headers: { apikey: cfg.anonKey, authorization: `Bearer ${access}`, 'content-type': 'application/json' }, body: JSON.stringify(args) });
    if (!response.ok) throw new Error('unavailable');
    return response.json();
  }
  async function campaign(kind) {
    const response = await fetch('/.netlify/functions/product-campaign-visit', { method: 'POST', credentials: 'same-origin', keepalive: true, signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/json', ...(kind === 'link' && token() ? { authorization: `Bearer ${token()}` } : {}) },
      body: JSON.stringify({ kind, consent: choice() === 'allow', campaign: new URLSearchParams(location.search).get('utm_campaign') || '' }) });
    return response.ok;
  }
  function prompt(force = false) {
    if (document.getElementById('oaMeasurementChoice') || (!force && choice())) return;
    const host = document.querySelector('#cloudGate .cloud-auth-card, #cloudGate .obraativa-reception-access')
      || document.querySelector('.oa-public-footer .oa-public-shell') || document.querySelector('.permission-hub-content')
      || document.querySelector('#view');
    if (!host) return;
    const panel = document.createElement('aside');
    panel.id = 'oaMeasurementChoice'; panel.className = 'oa-measurement-choice';
    panel.setAttribute('aria-label', 'Medição opcional de uso');
    panel.innerHTML = '<b>Você escolhe sobre a medição de uso</b><p>Podemos medir sua origem de campanha, presença recente, dias, tempo ativo estimado e áreas utilizadas para melhorar o ObraAtiva? Somente o proprietário do produto acessa esses indicadores. Não coletamos senhas, telas nem conteúdo de obras ou conversas. Você pode mudar a escolha em Privacidade de uso. Recusar não limita o aplicativo.</p><div><button type="button" data-measurement="allow">Permitir medição</button><button type="button" data-measurement="deny">Agora não</button></div>';
    host.appendChild(panel);
    panel.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => setChoice(button.dataset.measurement)));
  }
  async function setChoice(value) {
    if (!['allow', 'deny'].includes(value)) return;
    try { localStorage.setItem(KEY + currentUser(), value); } catch { /* sem armazenamento, não inicia coleta */ }
    configured = false; enabled = false; retryAt = 0; seconds = 0; linked = false; linkRetryAt = 0; publicSent = false;
    session = window.crypto?.randomUUID?.() || ''; lastSend = 0;
    document.getElementById('oaMeasurementChoice')?.remove();
    if (value === 'deny') campaign('forget').catch(() => {});
    await tick();
  }
  function addPrivacyLink() {
    const host = document.querySelector('#cloudGate .cloud-auth-card, #cloudGate .obraativa-reception-access')
      || document.querySelector('.oa-public-footer') || document.querySelector('#nav');
    if (!host || host.querySelector('[data-usage-privacy]')) return;
    const link = document.createElement('button'); link.type = 'button'; link.dataset.usagePrivacy = '1';
    link.className = 'oa-usage-privacy'; link.textContent = 'Privacidade de uso'; link.addEventListener('click', () => prompt(true));
    const logout = host.querySelector('[data-account-signout], .obraativa-sidebar-signout');
    host.insertBefore(link, logout || null);
  }
  async function tick() {
    const now = Date.now(), user = currentUser();
    if (identity !== user) {
      identity = user; session = window.crypto?.randomUUID?.() || ''; configured = false; enabled = false;
      linked = false; linkRetryAt = 0; seconds = 0; retryAt = 0; lastSend = 0; lastSample = now;
      document.getElementById('oaMeasurementChoice')?.remove();
    }
    addPrivacyLink(); prompt();
    const active = document.visibilityState === 'visible' && document.hasFocus() && now - lastInput < 60000;
    if (choice() === 'allow' && active && configured && enabled && window.CloudSync?.ready) seconds = Math.min(60, seconds + Math.min(5, Math.max(0, (now - lastSample) / 1000)));
    lastSample = now;
    if (busy || now < retryAt || !choice()) return;
    busy = true;
    try {
      if (user === 'visitor') {
        if (choice() === 'allow' && !publicSent) { publicSent = await campaign('visit'); if (!publicSent) retryAt = now + 300000; }
        return;
      }
      if (!configured) {
        const response = await rpc('product_insight_preference', { p_allowed: choice() === 'allow' });
        enabled = response.enabled === true; configured = true;
        if (!enabled) { retryAt = now + 300000; configured = false; }
      }
      if (choice() !== 'allow' || !enabled) return;
      if (!linked && now >= linkRetryAt) { linked = await campaign('link'); if (!linked) linkRetryAt = now + 300000; }
      if (active && window.CloudSync?.ready && session && now - lastSend >= 60000) {
        const sentSeconds = Math.floor(seconds); seconds = 0; lastSend = now;
        await rpc('product_insight_tick', { p_session: session, p_module: moduleName(), p_seconds: sentSeconds, p_end: false });
      }
    } catch { retryAt = now + 300000; configured = false; seconds = 0; }
    finally { busy = false; }
  }
  function end() {
    if (choice() !== 'allow' || !enabled || !session) return;
    const args = { p_session: session, p_module: moduleName(), p_seconds: Math.floor(seconds), p_end: true };
    session = ''; seconds = 0; enabled = false; configured = false; identity = '';
    // Captura o token antes de sair; nunca bloqueia nem altera o fluxo de autenticação.
    rpc('product_insight_tick', args, true).catch(() => {});
  }
  window.ObraAtivaUsage = { openPrivacy: () => prompt(true), end };
  for (const event of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(event, () => { lastInput = Date.now(); }, { passive: true, capture: event === 'scroll' });
  document.addEventListener('visibilitychange', () => { lastSample = Date.now(); if (document.visibilityState === 'visible') tick(); });
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (choice() === 'allow' && link && !link.closest('.oa-creator-credit') && /^(https:\/\/)(wa\.me|api\.whatsapp\.com)\//.test(link.href) && document.querySelector('.oa-public-footer')) campaign('whatsapp').catch(() => {});
  }, { passive: true });
  setInterval(tick, 5000);
  tick();
})();
