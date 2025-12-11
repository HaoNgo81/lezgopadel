// service-worker.js - LezGo Padel (clean, versioned)
const CACHE_VERSION = 'v2';
const PRECACHE = `lezgo-precache-${CACHE_VERSION}`;
const RUNTIME = `lezgo-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = '/lezgopade/offline.html'; // Sørg for at denne sti matcher manifest og filplacering

// Liste over statiske assets til precache (opdatér efter behov)
const PRECACHE_URLS = [
  '/lezgopade/',
  '/lezgopade/index.html',
  '/lezgopade/lezgo-logo.svg',
  '/lezgopade/ICON-192x192.png',
  '/lezgopade/ICON-512x512.png',
  '/lezgopade/apple-touch-icon.png',
  '/lezgopade/manifest.json',
  '/lezgopade/offline.html'
];

// INSTALL: præcache app-shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(PRECACHE).then(cache => {
      return cache.addAll(PRECACHE_URLS.map(u => new Request(u, {cache: 'reload'})));
    })
  );
});

// ACTIVATE: slet gamle caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => (k !== PRECACHE && k !== RUNTIME)).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Hjælpefunktion: er det en navigation request?
function isNavigationRequest(req) {
  return req.mode === 'navigate' ||
         (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'));
}

// FETCH: cache-first for statiske assets (png, css, js...), network-first for navigation
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Static asset cache-first
  if (url.origin === self.location.origin && /\.(?:png|jpg|jpeg|svg|gif|css|js|json|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        return caches.open(RUNTIME).then(cache => {
          cache.put(req, res.clone());
          return res;
        });
      })).catch(() => {
        // hvis fallback ønskes for images, returner evt en placeholder her
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Navigation requests: network-first then cache, så offline fallback
  if (isNavigationRequest(req)) {
    event.respondWith(
      fetch(req).then(resp => {
        // gem en kopi i runtime cache
        const copy = resp.clone();
        caches.open(RUNTIME).then(cache => cache.put(req, copy));
        return resp;
      }).catch(() => {
        // hvis netværk fejler, prøv at finde i cache, ellers offline.html
        return caches.match(req).then(cacheResp => cacheResp || caches.match(OFFLINE_URL));
      })
    );
    return;
  }

  // Andet: prøv cache først, ellers netværk
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // valgfrit: cache cross-origin images kun hvis CORS tillader (type 'basic')
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(RUNTIME).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // fallback for images eller return offline side for html
        if (req.headers.get('accept') && req.headers.get('accept').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
        // ellers return en tom response (eller en data-uri placeholder)
        return new Response('', {status: 404, statusText: 'offline'});
      });
    })
  );
});

// Lyt efter beskeder fra siden (fx for at aktivere ny SW straks)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
