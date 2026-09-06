import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const swSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const registerSource = fs.readFileSync(path.join(root, 'public-assets', 'pwa-register-v1.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('all local CSS and JavaScript dependencies used by index are precached', () => {
  const references = [
    ...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi),
    ...html.matchAll(/<link[^>]+href=["']([^"']+)["']/gi)
  ].map(match => match[1].split('?')[0])
    .filter(reference => reference && !/^(?:https?:|data:|#)/i.test(reference))
    .map(reference => reference.startsWith('/') ? reference : `/${reference}`);

  for (const reference of new Set(references)) {
    assert.equal(fs.existsSync(path.join(root, reference.slice(1))), true, `dependência local ausente: ${reference}`);
    assert.ok(swSource.includes(`'${reference}'`), `dependência fora do precache: ${reference}`);
  }
});

test('cache is versioned, resilient and excludes private or unsafe requests', () => {
  const version = swSource.match(/CACHE_VERSION\s*=\s*'(v\d+)'/)?.[1];
  assert.match(version || '', /^v[1-9]\d*$/, 'o cache precisa ter uma versão numérica explícita');
  assert.match(swSource, /Promise\.allSettled\(OPTIONAL_ASSETS/);
  assert.match(swSource, /request\.method\s*!==\s*'GET'/);
  assert.match(swSource, /headers\?\.has\?\.\('range'\)/);
  assert.match(swSource, /url\.origin\s*!==\s*self\.location\.origin/);
  assert.match(swSource, /startsWith\('\/\.netlify\/functions\/'\)/);
  assert.match(swSource, /startsWith\('\/downloads\/'\)/);
  assert.match(swSource, /staleWhileRevalidate/);
  assert.match(swSource, /networkFirstNavigation/);
});

test('celular busca primeiro a versão atual dos controles de obra', () => {
  for (const asset of [
    '/public-assets/work-control-v1.js',
    '/public-assets/work-control-v1.css',
    '/public-assets/work-phase-density-v1.css',
    '/public-assets/responsive-ui-v3.js',
    '/public-assets/landscape-density-v1.js'
  ]) assert.match(swSource, new RegExp(`NETWORK_FIRST_ASSETS[\\s\\S]*?'${asset.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}'`), `${asset} precisa acompanhar a publicação atual`);
  assert.match(swSource, /NETWORK_FIRST_ASSETS\.has\(url\.pathname\)[\s\S]*?networkFirstVersionedAsset/);
});

test('service worker serves the application shell while offline and ignores APIs', async () => {
  const listeners = {};
  const stores = new Map();

  class MockCache {
    constructor() { this.entries = new Map(); }
    async add(asset) { this.entries.set(asset, new Response(`cached:${asset}`)); }
    async addAll(assets) { for (const asset of assets) await this.add(asset); }
    async match(key) { return this.entries.get(typeof key === 'string' ? key : new URL(key.url).pathname)?.clone(); }
    async put(key, response) { this.entries.set(typeof key === 'string' ? key : new URL(key.url).pathname, response); }
  }

  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new MockCache());
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
    async match(key) {
      for (const cache of stores.values()) {
        const response = await cache.match(key);
        if (response) return response;
      }
    }
  };

  const context = {
    URL, Response, Set, Promise, caches, AbortController, setTimeout, clearTimeout,
    fetch: async request => new Response(`network:${request.url || request}`),
    self: {
      location: { origin: 'https://obraativa.test' },
      addEventListener(type, handler) { listeners[type] = handler; },
      async skipWaiting() {},
      clients: { async claim() {}, async matchAll() { return []; } }
    }
  };
  vm.runInNewContext(swSource, context, { filename: 'service-worker.js' });

  let installWork;
  listeners.install({ waitUntil(work) { installWork = work; } });
  await installWork;
  assert.ok(await caches.match('/index.html'), 'shell não foi armazenado durante a instalação');
  const version = swSource.match(/CACHE_VERSION\s*=\s*'(v\d+)'/)?.[1];
  assert.ok(stores.has(`controle-de-obra-static-${version}`), 'instalação deve usar o cache da versão atual');
  await caches.open('controle-de-obra-static-obsoleto-teste');
  await caches.open('cache-externo-ficticio');
  let activateWork;
  listeners.activate({ waitUntil(work) { activateWork = work; } });
  await activateWork;
  assert.equal(stores.has('controle-de-obra-static-obsoleto-teste'), false, 'ativação remove somente versões antigas do aplicativo');
  assert.equal(stores.has('cache-externo-ficticio'), true, 'outros caches são preservados');
  assert.equal(stores.has(`controle-de-obra-static-${version}`), true, 'cache atual sobrevive à ativação');

  context.fetch = async () => { throw new Error('offline'); };
  let navigationResponse;
  listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://obraativa.test/?app=1', headers: { has: () => false } },
    respondWith(work) { navigationResponse = work; },
    waitUntil() {}
  });
  const offline = await navigationResponse;
  assert.match(await offline.text(), /cached:\/index\.html/);

  let apiIntercepted = false;
  listeners.fetch({
    request: { method: 'GET', mode: 'cors', url: 'https://obraativa.test/.netlify/functions/private', headers: { has: () => false } },
    respondWith() { apiIntercepted = true; },
    waitUntil() {}
  });
  assert.equal(apiIntercepted, false, 'funções privadas não podem passar pelo cache');

  // A oferta pública não pode priorizar os 14 dias/planos antigos armazenados.
  for (const extension of ['js', 'css']) {
    const asset = `/public-assets/obraativa-product-site-v2.${extension}`;
    const cache = await caches.open(`controle-de-obra-static-${version}`);
    await cache.put(asset, new Response('OFERTA FICTÍCIA ANTIGA: 14 dias'));
    context.fetch = async (_request, options) => {
      assert.equal(options.cache, 'no-cache', 'revalidar também o cache HTTP');
      return new Response('OFERTA FICTÍCIA ATUAL: 30 dias / R$ 69');
    };
    const requestAsset = async () => {
      let response;
      listeners.fetch({
        request: { method: 'GET', mode: 'cors', url: `https://obraativa.test${asset}?v=teste`, headers: { has: () => false } },
        respondWith(work) { response = work; }, waitUntil() {}
      });
      return (await response).text();
    };
    assert.equal(await requestAsset(), 'OFERTA FICTÍCIA ATUAL: 30 dias / R$ 69');
    context.fetch = async () => { throw new Error('OFFLINE FICTÍCIO'); };
    assert.equal(await requestAsset(), 'OFERTA FICTÍCIA ATUAL: 30 dias / R$ 69', 'offline mantém a última oferta válida');
    context.fetch = async () => new Response('erro', { status: 503 });
    assert.equal(await requestAsset(), 'OFERTA FICTÍCIA ATUAL: 30 dias / R$ 69', 'erro temporário não substitui o recurso válido');
  }
});

test('registration checks updates without forcing a disruptive page reload', () => {
  assert.match(html, /pwa-register-v1\.js\?v=20260831-pwa15/);
  assert.match(registerSource, /localhost/);
  assert.match(registerSource, /updateViaCache:\s*'none'/);
  assert.match(registerSource, /registration\.update\(\)/);
  assert.match(registerSource, /controllerchange/);
  assert.match(registerSource, /OBRAATIVA_PWA_UPDATED/);
  assert.doesNotMatch(registerSource, /location\.reload\s*\(/);
  assert.match(registerSource, /location\.pathname\.startsWith\('\/tests\/'\)/);
});

test('manifest icons and Netlify service-worker headers remain valid', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'ObraAtiva');
  assert.equal(manifest.scope, '/');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.type === 'image/png'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.type === 'image/png'));
  for (const icon of manifest.icons) assert.equal(fs.existsSync(path.join(root, icon.src.slice(1))), true, `ícone ausente: ${icon.src}`);

  const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  assert.match(netlify, /for\s*=\s*"\/service-worker\.js"[\s\S]*?Cache-Control\s*=\s*"no-cache, no-store, must-revalidate"/);
});
