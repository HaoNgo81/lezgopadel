// service-worker.js
const CACHE_NAME = 'lezgo-padle-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './ICON-192x192.png',
  // tilføj flere assets efter behov (logo, css, js, evt lokale billeder)
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  // navigation tries network first then cache fallback
  if (req.mode === 'navigate') {
    ev.respondWith(
      fetch(req).then(res => {
        const cloned = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, cloned));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  // other requests: cache-first
  ev.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      return caches.open(CACHE_NAME).then(cache => {
        cache.put(req, res.clone());
        return res;
      });
    })).catch(() => caches.match('./index.html'))
  );
});
