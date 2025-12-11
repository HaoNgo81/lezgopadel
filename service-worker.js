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
  self.clients.claim();// versioned cache names
const CACHE_VERSION = 'v2';
const PRECACHE = `lezgo-precache-${CACHE_VERSION}`;
const RUNTIME = `lezgo-runtime-${CACHE_VERSION}`;

const OFFLINE_URL = '/lezgopade/offline.html';

// Files to precache (app shell)
// Add any additional local assets you want cached on installation.
const PRECACHE_URLS = [
  '/lezgopade/',                // index (preferably)
  '/lezgopade/index.html',
  '/lezgopade/lezgo-logo.svg',
  '/lezgopade/ICON-192x192.png',
  '/lezgopade/ICON-512x512.png',
  '/lezgopade/apple-touch-icon.png',
  '/lezgopade/manifest.json',
  '/lezgopade/offline.html',
  // fonts or CSS/JS if local:
  // '/lezgopade/styles.css',
  // '/lezgopade/app.js'
];

// Install - precache app shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(PRECACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS.map(u => new Request(u, {cache: 'reload'})));
    })
  );
});

// Activate - cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => (k !== PRECACHE && k !== RUNTIME))
            .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Utility: is navigation request?
function isNavigationRequest(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'));
}

// Fetch handler
self.addEventListener('fetch', event => {
  const req = event.request;

  // Always try to serve precached assets first for static files
  if (req.method !== 'GET') return;

  // Serve app shell / static resources from cache-first
  const url = new URL(req.url);

  // If request is for same-origin static asset (png, svg, css, js, json, html) -> cache-first
  if (url.origin === self.location.origin && /\.(?:png|jpg|jpeg|svg|gif|css|js|json|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        return caches.open(RUNTIME).then(cache => {
          cache.put(req, res.clone());
          return res;
        });
      }).catch(() => {
        // fallback to offline page for HTML requests; otherwise nothing
        if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
      }))
    );
    return;
  }

  // Navigation requests (pages): network-first, fallback to cache/offline
  if (isNavigationRequest(req)) {
    event.respondWith(
      fetch(req).then(resp => {
        // put a copy in runtime cache
        const copy = resp.clone();
        caches.open(RUNTIME).then(cache => cache.put(req, copy));
        return resp;
      }).catch(() => {
        // network failed -> try cache -> fallback to offline.html
        return caches.match(req).then(cacheResp => cacheResp || caches.match(OFFLINE_URL));
      })
    );
    return;
  }

  // For other requests (e.g. cross-origin images like youtube thumbnails), try cache then network
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // optionally cache cross-origin images (beware CORS)
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(RUNTIME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // final fallback for images - could return a placeholder data-uri or offline image
        if (req.destination === 'image') {
          return new Response('', {status: 404, statusText: 'offline'});
        }
      });
    })
  );
});

// Message listener to allow skipWaiting from the page
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

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
