// Offline play: every file the game loads is kept in a cache. Online, the network always
// comes first (so updates arrive as before); offline, the cached copy is used instead.
const CACHE = 'tenka';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const base = ['./', 'index.html', 'manifest.webmanifest', 'lib/three.module.min.js', 'icons/icon-192.png', 'icons/apple-touch-icon.png'];
    let files = [];
    try { files = (await (await fetch('version.json', { cache: 'no-store' })).json()).files || []; } catch (_) { /* offline install */ }
    await Promise.all(base.concat(files).map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => null)));
  })());
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.url, copy)).catch(() => null); }
      return res;
    } catch (err) {
      const hit = await caches.match(req.url, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const page = await caches.match(new URL('index.html', self.registration.scope).href); if (page) return page; }
      throw err;
    }
  })());
});
