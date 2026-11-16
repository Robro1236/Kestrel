// Network first: try the internet, fall back to the saved copy. New deploys show up whenever there is a connection;
// offline, a reload still opens the app. Same-origin GETs only: API data is saved by the app itself.
// scripts/sw-precache.mjs fills these two in after `expo export`, so every deploy installs a fresh worker.
const VERSION = 'dev';
const PRECACHE = [];
const CACHE = `kestrel-${VERSION}`;

// Every screen is its own chunk, so all of them are saved up front; a screen never opened online still opens offline.
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', ...PRECACHE])));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
        }
        return res;
      })
      // Every route is the same single page, so an offline navigation to any path gets the saved index.
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/') : Response.error()))),
  );
});
