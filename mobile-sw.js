// Mobile Command Service Worker — network-first HTML, cache-first static assets.
// Bumping CACHE_NAME triggers an SW update; MobileCommand.html's update detector
// auto-reloads the page once the new SW takes control. End result: pushing new
// code reaches the phone on the next refresh — no clear-data-and-reinstall.
const CACHE_NAME = 'mobile-command-v9-20260510-emailauth';

// Pre-cache only assets that genuinely don't change often. HTML is intentionally
// excluded so it always tries network first (and falls back to cache offline).
const STATIC_ASSETS = [
  './mobile-manifest.json',
  './icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS).catch(err => {
        // Pre-cache failures shouldn't block install; assets fetch on demand.
        console.error('[mobile-sw] Pre-cache failed (non-fatal):', err);
      }))
  );
  // NOTE: do NOT call self.skipWaiting() unconditionally here — let the page
  // explicitly request it via postMessage so we can coordinate a clean reload.
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Page → SW message: take over now. Pairs with the page's updatefound handler.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Bypass Firebase / Google APIs / gstatic — never cache, always network.
  if (url.includes('firebaseio.com') ||
      url.includes('googleapis.com') ||
      url.includes('firebase') ||
      url.includes('gstatic')) {
    return;
  }

  // NETWORK-FIRST for navigation requests and HTML files.
  // This is the key change: the app's HTML is always pulled fresh on every load
  // (when online), so a code push reaches the phone on next refresh.
  const isNav = e.request.mode === 'navigate';
  const isHtml = url.endsWith('.html') || url.endsWith('/');
  if (isNav || isHtml) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(e.request)) // offline fallback
    );
    return;
  }

  // CACHE-FIRST for static assets (icons, manifest, etc.).
  // These rarely change; if cache has it, serve immediately. Otherwise fetch
  // and populate cache in the background.
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});
