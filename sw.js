const CACHE_NAME = 'cc-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network-first for HTML (always get fresh), cache-first for assets
  if (e.request.url.includes('firebase') || e.request.url.includes('googleapis')) {
    return; // Don't cache Firebase requests
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
