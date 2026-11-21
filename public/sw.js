/* Offline app shell for Poker Action Tracker.
 * Install caches the built index.html plus every asset it references, so the
 * app works with no network after the first visit (iOS home screen, Android,
 * desktop). Navigations fall back to the cached shell, which keeps deep links
 * such as /bots working offline. */
const VERSION = 'v1';
const CACHE = `poker-action-tracker-${VERSION}`;
const SHELL = '/index.html';

async function precache() {
  const cache = await caches.open(CACHE);
  let html = '';
  try {
    const res = await fetch(SHELL, { cache: 'reload' });
    if (res.ok) {
      html = await res.clone().text();
      await cache.put(SHELL, res);
    }
  } catch (_) {
    /* first install while offline: nothing to precache yet */
  }
  const urls = new Set(['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png']);
  for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) urls.add(m[1]);
  await Promise.all(
    [...urls].map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('poker-action-tracker-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) await cache.put(SHELL, res.clone());
    return res;
  } catch (_) {
    return (await cache.match(SHELL)) || (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: false });
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) await cache.put(request, res.clone());
    return res;
  } catch (_) {
    return hit || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(url.origin === self.location.origin ? cacheFirst(request) : staleWhileRevalidate(request));
});
