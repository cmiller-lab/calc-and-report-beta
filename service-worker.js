'use strict';
const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = 'sw-chemistry-beta:'+SCOPE.pathname+':';
const CACHE = CACHE_PREFIX+'v15.12-probes-2';
const ASSETS = [
  './','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png',
  './lab-sheets.html','./lab-upload.html','./lab-config.js','./lab-api.js','./calibration.html',
  './probes.html','./probe-core.js','./probe-store.js','./probe-tracker.js','./probe-tracker.css'
];
const STATIC_PATHS = new Set(ASSETS.map(path => new URL(path,SCOPE).pathname));

self.addEventListener('message',event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('install',event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate',event => {
  // Preserve production, unrelated PWAs, and unscoped legacy caches whose ownership is unknown.
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch',event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname) || !STATIC_PATHS.has(url.pathname)) return;
  const canonical = new URL(url.pathname,SCOPE.origin).href;
  const cacheKey = url.pathname === SCOPE.pathname ? new URL('index.html',SCOPE).href : canonical;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request,{cache:'no-store'});
        if (!response.ok) throw new Error('Navigation unavailable');
        await cache.put(cacheKey,response.clone());
        return response;
      } catch {
        // Query variants (embedded calibration, versioned startup) use their own page fallback.
        return await cache.match(cacheKey) || new Response('This page is not available offline yet. Open the app online once.',{status:503,headers:{'Content-Type':'text/plain'}});
      }
    })());
    return;
  }
  // Keep one coherent precached asset version; remote operational data is never cached here.
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(canonical);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(canonical,response.clone());
    return response;
  }));
});
