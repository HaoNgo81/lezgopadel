// service-worker.js - basic cache-first strategy with offline fallback to index.html
const CACHE_NAME = 'lezgo-cache-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './ICON-192x192.png',
  './ICON-512x512.png',
  './lezgo-logo.svg'
  // add other static assets you want cached
];

// Install - cache essential assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate - cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => {
        if (k !== CACHE_NAME) return caches.delete(k);
      })
    ))
  );
  self.clients.claim();
});

// Fetch - try cache first, then network, fallback to offline page (index.html)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // navigation handling: return cached index.html for navigation requests when offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        // update cache with latest index.html
        caches.open(CACHE_NAME).then(cache => cache.put('./', response.clone()));
        return response;
      }).catch(() => {
        return caches.match('./').then(cached => cached || Promise.reject('no-cache'));
      })
    );
    return;
  }

  // For other requests: cache-first, then network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // cache same-origin GET responses
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // if request is for an image, you could return a placeholder - for now reject
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
