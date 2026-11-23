const CACHE='filterdose-field-v2.0.0';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;e.respondWith(caches.match(req).then(r=>r||fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{})}return response})).catch(()=>caches.match('./index.html')))});
