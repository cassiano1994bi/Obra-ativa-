'use strict';

const CACHE_PREFIX = 'controle-de-obra-static-';
const STATIC_CACHE = `${CACHE_PREFIX}v13`;
const APP_SHELL = '/index.html';
const STATIC_ASSETS = [
  APP_SHELL,
  '/manifest.webmanifest',
  '/public-assets/obraativa-app-icon-v2-192.png',
  '/public-assets/obraativa-app-icon-v2-512.png',
  '/public-assets/obraativa-app-icon-v2-1024.png',
  '/public-assets/obraativa-ui-icons-v2.png',
  '/public-assets/obraativa-ui-works-v2.png',
  '/public-assets/obraativa-ui-attendance-v2.png',
  '/public-assets/obraativa-ui-financial-v2.png',
  '/public-assets/obraativa-visual-v1.css',
  '/public-assets/obraativa-home-v1.js',
  '/public-assets/home-shortcut-editor-v1.css',
  '/public-assets/home-shortcut-editor-v1.js',
  '/public-assets/obraativa-mobile-brand-v1.css',
  '/public-assets/obraativa-mobile-brand-v1.js',
  '/public-assets/obraativa-auth-brand-v1.css',
  '/public-assets/obraativa-auth-brand-v1.js',
  '/public-assets/obraativa-launch-screen-v1.png',
  '/public-assets/account-session-controls-v1.css',
  '/public-assets/account-session-controls-v1.js',
  '/public-assets/assistant-digital-employee-v1.js',
  '/public-assets/finance-legacy-view-v1.js',
  '/public-assets/orcamentos-admin-v1.js',
  '/public-assets/orcamentos-links-v1.js',
  '/public-assets/orcamentos-distribuicao-v1.js',
  '/public-assets/mobile-ui-v2.js',
  '/public-assets/responsive-ui-v3.js',
  '/public-assets/account-deletion-v1.js',
  '/public-assets/pwa-register-v1.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return STATIC_ASSETS.includes(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/.netlify/functions/')) return;

  if (request.mode === 'navigate' && (url.pathname === '/' || url.pathname === APP_SHELL)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(STATIC_CACHE).then((cache) => cache.put(APP_SHELL, response.clone()));
          return response;
        })
        .catch(() => caches.match(APP_SHELL))
    );
    return;
  }

  if (!isStaticAsset(url)) return;
  event.respondWith(
    caches.match(url.pathname).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(STATIC_CACHE).then((cache) => cache.put(url.pathname, response.clone()));
      return response;
    }))
  );
});
