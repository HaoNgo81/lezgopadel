// service-worker.js (opdateret med Share Target håndtering)
const CACHE_NAME = 'lezgo-v1';
const ASSETS = [
  './',
  './index.html',
  './ICON-192x192.png',
  './ICON-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Helper: send message til klienter
async function broadcastMessage(message) {
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of allClients) {
    try { client.postMessage(message); } catch(e){ console.warn('postMessage failed', e); }
  }
}

self.addEventListener('fetch', event => {
  // Håndter share-target POST (multipart/form-data)
  if (event.request.method === 'POST') {
    const ct = event.request.headers.get('content-type') || '';
    if (ct.startsWith('multipart/form-data')) {
      event.respondWith((async () => {
        try {
          // Læs formData fra request
          const formData = await event.request.formData();
          // Byg payload
          const payload = { title: '', text: '', url: '', files: [] };

          if (formData.has('title')) payload.title = formData.get('title') || '';
          if (formData.has('text')) payload.text = formData.get('text') || '';
          if (formData.has('url')) payload.url = formData.get('url') || '';

          // files: kan være File/Blob eller enkelt element
          if (formData.has('files')) {
            const files = formData.getAll('files');
            for (const file of files) {
              if (file instanceof File) {
                // Vi kan ikke poste File-objekter via postMessage direkte i alle tilfælde.
                // Men vi kan læse som dataURL (base64) for at sende til klienten.
                try {
                  const arrayBuffer = await file.arrayBuffer();
                  // konverter til base64
                  const uint8 = new Uint8Array(arrayBuffer);
                  let binary = '';
                  for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i]);
                  const base64 = btoa(binary);
                  payload.files.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: `data:${file.type};base64,${base64}`
                  });
                } catch (e) {
                  console.warn('file read failed', e);
                }
              }
            }
          }

          // Broadcast payload til alle åbne klienter
          await broadcastMessage({ type: 'share-target', payload });

          // Redirect så appen åbner index med share flag (303 recommended)
          return Response.redirect('./?shared=1', 303);
        } catch (err) {
          console.error('Error handling share target POST', err);
          // fallback: redirect til root
          return Response.redirect('./', 303);
        }
      })());
      return; // fetch handler done
    }
  }

  // Navigation requests: online-first to keep cache updated
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

  // cache-first for other assets
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
