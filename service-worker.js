/* Simple but robust Service Worker for LezGo Padel */
/* Version - bump to force refresh when you change files */
const CACHE_NAME = 'lezgo-cache-v1';
const RUNTIME_CACHE = 'lezgo-runtime-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/', 
  '/index.html',
  '/manifest.json',
  OFFLINE_URL,
  '/lezgo-logo.svg',
  '/ICON-192x192.png',
  '/ICON-512x512.png',
  '/apple-touch-icon.png'
  // Tilføj yderligere filer her hvis nødvendigt
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, {cache: 'reload'})));
      // activate straks
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // ryd gamle caches (behold kun de vi vil have)
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== RUNTIME_CACHE) return caches.delete(key);
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) navigation requests -> network-first, fallback til cache, så offline.html
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResp = await fetch(req);
          // opdater runtime cache med den nyeste navigation hvis 200
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, networkResp.clone());
          return networkResp;
        } catch (err) {
          // prøv cache
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('/index.html') || await cache.match(OFFLINE_URL);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // 2) For statiske assets (images, icons, svg) -> cache-first
  if (req.destination === 'image' || /\.(png|jpg|jpeg|gif|svg)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(resp => {
          return caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(req, resp.clone());
            return resp;
          });
        }).catch(()=> caches.match(OFFLINE_URL));
      })
    );
    return;
  }

  // 3) For CSS/JS/JSON -> network-first but fallback to cache
  if (/\.(js|css|json)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req).then(resp => {
        // opdater cache
        const copy = resp.clone();
        caches.open(RUNTIME_CACHE).then(cache => cache.put(req, copy));
        return resp;
      }).catch(() => caches.match(req).then(c => c || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // 4) default: prøv cache, så network
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).catch(()=> caches.match(OFFLINE_URL)))
  );
});
