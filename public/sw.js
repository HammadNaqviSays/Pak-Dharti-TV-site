// Pak Dharti TV service worker: the app opens fast and still works without internet.
//  - pages: network first (always the latest news); the last pages read are kept for offline reading
//  - site files (scripts, fonts, logo, flags): served from the cache, refreshed in the background
//  - Mission Control (/admin), APIs and other websites are never cached
const VERSION = "pd-v1";
const PAGES = `${VERSION}-pages`, ASSETS = `${VERSION}-assets`;
const OFFLINE = "/offline.html";
const MAX_PAGES = 40;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(ASSETS).then((c) => c.addAll([OFFLINE, "/brand/icon-192.png", "/brand/logo.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/")) return;

  // pages: network first, fall back to the saved copy, then to the offline page
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(req, copy)).then(() => trim(PAGES, MAX_PAGES));
        }
        return res;
      } catch {
        return (await caches.match(req)) || (await caches.match(OFFLINE));
      }
    })());
    return;
  }

  // site files: cache first, refresh in the background
  if (/^\/(_next\/static|fonts|brand|flags|images)\//.test(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(ASSETS);
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
  }
});
