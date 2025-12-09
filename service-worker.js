// service-worker.js - simpel og sikker caching (scope = repo mappe når registreret som './service-worker.js')
const CACHE_NAME = 'lezgo-v1';
const ASSETS = [
  './',
  './index.html',
  './ICON-192x192.png',
  './ICON-512x512.png'
  // Tilføj flere assets her hvis nødvendigt (css, js, offline.html osv.)
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // online-first for navigation (gør at brugeren får opdateret startside hvis online)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return res;
      }).catch(() => caches.match('./'))
    );
    return;
  }

  // cache-first for øvrige assets
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
