// ============================================================
// noda - Service worker
//
// Copied from fina/public/sw.js, trimmed for static export (output: 'export'):
// no push, only an app-shell cache for speed and offline start.
//
// BASE comes from where sw.js is served, so a basePath works too
// (next.config.ts reads BASE_PATH).
// ============================================================

const CACHE_VERSION = 'noda-v1';

// Folder of sw.js: '/sw.js' -> '', '/foo/sw.js' -> '/foo'.
const BASE = new URL('./', self.location.href).pathname.replace(/\/$/, '');
const HOME = `${BASE}/`;

// --- Cache -------------------------------------------------
//
// /_next/static/*  cache-first forever. File names hash their content, so a
//                  new build means new names - never stale.
// HTML             network-first. Cache-first here would one day show last
//                  week's build with no clue why.
// API / Firestore  not touched. Data is never served from an old copy.

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_VERSION));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(`${BASE}/_next/static/`);
}

function isNeverCached(url) {
  return (
    url.origin !== self.location.origin ||
    url.pathname.startsWith(`${BASE}/api/`) ||
    url.pathname.startsWith(`${BASE}/__/`)
  );
}

function isIcon(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(`${BASE}/icons/`);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (isNeverCached(url)) return;

  if (isStatic(url) || isIcon(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match(HOME))),
    );
  }
});
