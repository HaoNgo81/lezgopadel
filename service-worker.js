// service-worker.js
const CACHE_NAME = 'lezgo-padel-cache-v3';
const OFFLINE_URL = '/offline.html';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/lezgo-logo.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .catch(err => console.warn('SW: cache addAll failed', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
    ))
  );
  self.clients.claim();
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp && resp.status === 200 && request.method === 'GET') {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (err) {
    return caches.match(OFFLINE_URL);
  }
}

self.addEventListener('fetch', event => {
  // Navigation (pages) -> network-first with fallback
  if (event.request.mode === 'navigate' ||
      (event.request.method === 'GET' && event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          return caches.open(CACHE_NAME).then(cache => {
            if (resp && resp.status === 200) cache.put(event.request, resp.clone());
            return resp;
          });
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Other requests -> cache-first
  event.respondWith(cacheFirst(event.request));
});
