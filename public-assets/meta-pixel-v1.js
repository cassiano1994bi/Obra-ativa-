(() => {
  'use strict';

  const PIXEL_ID = '1474857467999986';
  const PIXEL_SCRIPT_URL = 'https://connect.facebook.net/en_US/fbevents.js';
  const CONSENT_KEY = 'oa-optional-measurement-v1:device-allowed';
  const SENT_EVENT_PREFIX = 'oa-meta-pixel-v1:sent:';
  const ALLOWED_EVENTS = new Set(['PageView', 'CompleteRegistration', 'StartTrial']);
  const TEST_MODE = new URLSearchParams(location.search).get('meta_pixel_test') === '1';
  const dynamicApp = document.currentScript?.hasAttribute('data-meta-dynamic') === true;
  const sentInMemory = new Set();
  const testEvents = [];
  let initialized = false;
  let consentGranted = false;
  let lastPageKey = '';

  function hasConsent() {
    try { return localStorage.getItem(CONSENT_KEY) === 'allow'; }
    catch { return false; }
  }

  function shortHash(value) {
    let hash = 2166136261;
    for (const character of String(value || '')) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function eventStorageKey(eventName, deduplicationKey) {
    return `${SENT_EVENT_PREFIX}${eventName}:${shortHash(deduplicationKey)}`;
  }

  function wasSent(eventName, deduplicationKey) {
    const key = eventStorageKey(eventName, deduplicationKey);
    if (sentInMemory.has(key)) return true;
    try { return localStorage.getItem(key) === '1'; }
    catch { return false; }
  }

  function rememberSent(eventName, deduplicationKey) {
    const key = eventStorageKey(eventName, deduplicationKey);
    sentInMemory.add(key);
    try { localStorage.setItem(key, '1'); }
    catch { /* a memória ainda evita repetição durante a página atual */ }
  }

  function recordTestEvent(eventName, parameters, deduplicationKey) {
    if (!TEST_MODE) return;
    const entry = Object.freeze({ eventName, parameters: { ...parameters }, deduplicationKey, sentAt: new Date().toISOString() });
    testEvents.push(entry);
    console.info('[ObraAtiva Meta Pixel]', entry);
  }

  function ensurePixel() {
    if (!hasConsent()) return false;
    if (typeof window.fbq !== 'function') {
      const fbq = window.fbq = function(...args) {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
      };
      if (!window._fbq) window._fbq = fbq;
      fbq.push = fbq;
      fbq.loaded = true;
      fbq.version = '2.0';
      fbq.queue = [];
      const script = document.createElement('script');
      script.async = true;
      script.src = PIXEL_SCRIPT_URL;
      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript?.parentNode) firstScript.parentNode.insertBefore(script, firstScript);
      else document.head?.appendChild(script);
    }
    if (!initialized) {
      window.fbq('init', PIXEL_ID);
      initialized = true;
    }
    if (!consentGranted) {
      window.fbq('consent', 'grant');
      consentGranted = true;
    }
    return true;
  }

  function safeIdentifier(value, fallback) {
    const normalized = String(value || '').trim().toLowerCase();
    return /^[a-z][a-z0-9-]{0,49}$/.test(normalized) ? normalized : fallback;
  }

  function currentPageName() {
    const params = new URLSearchParams(location.search);
    const path = location.pathname === '/' ? 'inicio' : location.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/i, '') || 'inicio';
    if (path !== 'inicio') return path;
    if (params.get('produto') === '1') return 'site-publico';
    if (params.has('obra')) return 'obra-publica';
    if (params.has('documento')) return `documento-${safeIdentifier(params.get('documento'), 'publico')}`;
    if (params.has('app')) {
      const appPage = typeof page !== 'undefined' ? safeIdentifier(page, 'inicio') : 'inicio';
      const appTab = appPage === 'worktracker' && typeof activeWorkTrackerTab !== 'undefined'
        ? `-${safeIdentifier(activeWorkTrackerTab, 'resumo')}`
        : appPage === 'site-management' && typeof siteManagementTab !== 'undefined'
          ? `-${safeIdentifier(siteManagementTab, 'visao-geral')}`
          : '';
      const authenticated = Boolean(window.CloudSync?.session?.user?.id
        && !document.body?.classList?.contains?.('auth-mode'));
      return authenticated ? `aplicativo-${appPage}${appTab}` : 'acesso-ao-aplicativo';
    }
    return 'site-publico';
  }

  function containsSensitiveCallback() {
    const address = `${location.search || ''}&${location.hash || ''}`;
    return /(?:^|[?&#])(access_token|refresh_token|invite|preapproval_id|token|code)=/i.test(address)
      || /(?:^|[?&#])billing=return\?preapproval_id=/i.test(address);
  }

  function track(eventName, parameters = {}, deduplicationKey = '') {
    if (!ALLOWED_EVENTS.has(eventName) || !ensurePixel()) return false;
    const isConversion = eventName !== 'PageView';
    const uniqueKey = String(deduplicationKey || eventName);
    if (isConversion && wasSent(eventName, uniqueKey)) return false;
    window.fbq('track', eventName, parameters);
    if (isConversion) rememberSent(eventName, uniqueKey);
    recordTestEvent(eventName, parameters, uniqueKey);
    return true;
  }

  function pageView() {
    // Meta: PageView é disparado uma vez para cada página ou módulo lógico exibido.
    // Retornos com tokens são omitidos para não enviar credenciais na URL ao provedor.
    if (!hasConsent() || containsSensitiveCallback()) return false;
    const pageName = currentPageName();
    const pageKey = `${location.pathname}|${pageName}`;
    if (pageKey === lastPageKey) return false;
    if (!track('PageView', { page_name: pageName }, pageKey)) return false;
    lastPageKey = pageKey;
    return true;
  }

  function revoke() {
    if (typeof window.fbq === 'function') window.fbq('consent', 'revoke');
    consentGranted = false;
    lastPageKey = '';
  }

  window.ObraAtivaMetaPixel = Object.freeze({
    pixelId: PIXEL_ID,
    testMode: TEST_MODE,
    track,
    pageView,
    revoke,
    status: () => Object.freeze({ pixelId: PIXEL_ID, consent: hasConsent(), initialized, testMode: TEST_MODE }),
    testEvents: () => Object.freeze([...testEvents])
  });

  document.addEventListener('click', () => window.requestAnimationFrame(pageView), { passive: true });
  window.addEventListener('popstate', pageView, { passive: true });
  window.addEventListener('hashchange', pageView, { passive: true });
  if (!dynamicApp) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pageView, { once: true });
    else pageView();
  }
})();
