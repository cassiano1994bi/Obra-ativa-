'use strict';

const CACHE_PREFIX = 'controle-de-obra-';
const CACHE_VERSION = 'v45';
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${CACHE_VERSION}`;
const APP_SHELL = '/index.html';

/* O núcleo precisa estar completo para a nova versão assumir o controle. */
const CORE_ASSETS = [
  APP_SHELL,
  '/manifest.webmanifest',
  '/public-assets/obraativa-app-icon-v2-192.png',
  '/public-assets/obraativa-app-icon-v2-512.png',
  '/public-assets/obraativa-app-icon-v2-1024.png',
  '/public-assets/obraativa-visual-v1.css',
  '/public-assets/obraativa-home-premium-v2.css',
  '/public-assets/obraativa-home-v1.js',
  '/public-assets/pwa-register-v1.js'
];

/* Recursos complementares são armazenados individualmente: a indisponibilidade
   temporária de um deles não impede a instalação segura do restante do PWA. */
const OPTIONAL_ASSETS = [
  '/public-assets/action-feedback-v1.js',
  '/public-assets/obraativa-ui-icons-v2.png',
  '/public-assets/obraativa-ui-works-v2.png',
  '/public-assets/obraativa-ui-attendance-v2.png',
  '/public-assets/obraativa-ui-financial-v2.png',
  '/public-assets/home-shortcut-editor-v1.css',
  '/public-assets/home-shortcut-editor-v1.js',
  '/public-assets/obraativa-mobile-brand-v1.css',
  '/public-assets/obraativa-mobile-brand-v1.js',
  '/public-assets/app-brand-lock-v1.css',
  '/public-assets/work-phase-density-v1.css',
  '/public-assets/work-control-core-v1.js',
  '/public-assets/work-control-sync-v1.js',
  '/public-assets/work-control-v1.js',
  '/public-assets/work-control-v1.css',
  '/public-assets/app-brand-lock-v1.js',
  '/public-assets/obraativa-auth-brand-v1.css',
  '/public-assets/obraativa-auth-brand-v1.js',
  '/public-assets/obraativa-reception-v1.css',
  '/public-assets/obraativa-reception-v1.js',
  '/public-assets/obraativa-reception-config-v1.js',
  '/public-assets/obraativa-social-auth-v1.js',
  '/public-assets/obraativa-reception-site-v1.webp',
  '/public-assets/obraativa-product-site-v2.css',
  '/public-assets/obraativa-product-site-v2.js',
  '/public-assets/aplicativo-studio-logo-v1.svg',
  '/public-assets/obraativa-launch-screen-v1.png',
  '/public-assets/account-session-controls-v1.css',
  '/public-assets/account-session-controls-v1.js',
  '/public-assets/admin-navigation-v1.js',
  '/public-assets/owner-center-v1.js',
  '/public-assets/owner-center-v1.css',
  '/public-assets/product-activity-v1.js',
  '/public-assets/assistant-avatar-v1.png',
  '/public-assets/assistant-actions-core-v1.js',
  '/public-assets/assistant-capability-registry-v1.js',
  '/public-assets/assistant-command-bus-v1.js',
  '/public-assets/assistant-command-registry-v1.js',
  '/public-assets/assistant-digital-employee-v1.js',
  '/public-assets/assistant-obras-phase1-v1.js',
  '/public-assets/assistant-obras-phase2-v1.js',
  '/public-assets/assistant-obras-phase3-v1.js',
  '/public-assets/assistant-obras-phase4-v1.js',
  '/public-assets/assistant-obras-phase5-v1.js',
  '/public-assets/assistant-obras-phase6-v1.js',
  '/public-assets/assistant-quality-auditor-v1.js',
  '/public-assets/assistant-technical-expert-v1.js',
  '/public-assets/employee-performance-v1.js',
  '/public-assets/finance-legacy-view-v1.js',
  '/public-assets/home-weather-v1.js',
  '/public-assets/landscape-density-v1.js',
  '/public-assets/mobile-ui-v2.js',
  '/public-assets/mobile-control-standards-v1.js',
  '/public-assets/orcamentos-admin-v1.js',
  '/public-assets/orcamentos-distribuicao-v1.js',
  '/public-assets/orcamentos-links-v1.js',
  '/public-assets/responsive-ui-v3.js',
  '/public-assets/responsive-visual-phase1-v1.js',
  '/public-assets/responsive-visual-phase2-v1.js',
  '/public-assets/responsive-visual-phase3-v1.js',
  '/public-assets/sidebar-scroll-v1.js',
  '/public-assets/account-deletion-v1.js',
  '/public-assets/hero-casa-alto-padrao-v1.webp',
  '/public-assets/assistente-obra-boas-vindas.webp'
];

const STATIC_ASSETS = [...new Set([...CORE_ASSETS, ...OPTIONAL_ASSETS])];

function canStore(response) {
  return Boolean(response && response.ok && (response.type === 'basic' || response.type === 'default'));
}

async function putIfValid(cacheName, key, response) {
  if (!canStore(response)) return;
  const cache = await caches.open(cacheName);
  await cache.put(key, response.clone());
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(CORE_ASSETS);
    await Promise.allSettled(OPTIONAL_ASSETS.map((asset) => cache.add(asset)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([STATIC_CACHE, RUNTIME_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && !keep.has(key))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: 'OBRAATIVA_PWA_UPDATED', version: CACHE_VERSION });
  })());
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (canStore(response)) await putIfValid(STATIC_CACHE, APP_SHELL, response);
    if (response.ok) return response;
  } catch {
    // O shell armazenado abaixo mantém o aplicativo acessível sem conexão.
  }
  return (await caches.match(APP_SHELL)) || new Response(
    '<!doctype html><meta charset="utf-8"><title>ObraAtiva offline</title><p>Sem conexão. Tente novamente quando a internet voltar.</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function staleWhileRevalidate(request, url, event) {
  const key = url.pathname;
  const staticCache = await caches.open(STATIC_CACHE);
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const cached = (await staticCache.match(key)) || (await runtimeCache.match(key));
  const targetCache = STATIC_ASSETS.includes(key) ? STATIC_CACHE : RUNTIME_CACHE;
  const network = fetch(request).then(async (response) => {
    await putIfValid(targetCache, key, response);
    return response;
  });

  if (cached) {
    event.waitUntil(network.catch(() => undefined));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers?.has?.('range')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/.netlify/functions/') || url.pathname.startsWith('/downloads/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/public-assets/')) {
    event.respondWith(staleWhileRevalidate(request, url, event));
  }
});
