/* service-worker.js */
/* Simple SW with share-target handling for /lezgopadel/share-target */
const CACHE_NAME = 'lezgo-cache-v1';
const OFFLINE_URL = '/lezgopadel/';

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache minimal shell
    await cache.addAll([
      OFFLINE_URL,
      '/lezgopadel/index.html',
      '/lezgopadel/manifest.json'
      // icons will be fetched when needed
    ]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    await clients.claim();
  })());
});

/* fetch handler: simple cache-first for app shell */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // share-target POST handler
  if (event.request.method === 'POST' && url.pathname === '/lezgopadel/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const shareData = {
          title: formData.get('title') || '',
          text: formData.get('text') || '',
          url: formData.get('url') || ''
        };
        // notify all clients
        const clientList = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for (const client of clientList) {
          client.postMessage({ type: 'share-target', ...shareData });
        }
        // redirect to app start so client can read the message
        return Response.redirect('/lezgopadel/?shared=1', 303);
      } catch (e) {
        return new Response('Share failed', { status: 500 });
      }
    })());
    return;
  }

  // default fetch -> try cache then network
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const networkResponse = await fetch(event.request);
      // optionally cache GET HTML/CSS/JS/images
      if (event.request.method === 'GET' && networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
        // clone and store
        const copy = networkResponse.clone();
        cache.put(event.request, copy).catch(()=>{/* ignore */});
      }
      return networkResponse;
    } catch (err) {
      // offline fallback
      const fallback = await cache.match('/lezgopadel/index.html');
      return fallback || new Response('Offline', { status: 503 });
    }
  })());
});
