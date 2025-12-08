// service-worker.js
const CACHE_NAME = 'lezgo-padel-cache-v3';
const OFFLINE_URL = '/offline.html';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/lezgo-logo.svg',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event=>{
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).catch(err=>console.warn('SW install err',err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME ? caches.delete(k) : null)))
  );
  self.clients.claim();
});

async function cacheFirst(req){
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if(cached) return cached;
  try{
    const resp = await fetch(req);
    if(resp && resp.status===200 && req.method==='GET') cache.put(req,resp.clone());
    return resp;
  }catch(err){
    return caches.match(OFFLINE_URL);
  }
}

self.addEventListener('fetch', event=>{
  if(event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))){
    event.respondWith(
      fetch(event.request).then(resp=>{
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c=>{ if(resp && resp.status===200) c.put(event.request, copy); });
        return resp;
      }).catch(()=>caches.match(event.request).then(c=>c || caches.match(OFFLINE_URL)))
    );
    return;
  }
  event.respondWith(cacheFirst(event.request));
});
