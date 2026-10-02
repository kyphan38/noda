// ============================================================
// noda - Service worker
//
// Copy tu fina/public/sw.js, rut gon cho static export (output: 'export'):
// khong co push, chi cache vo app cho nhanh va mo duoc offline.
//
// BASE lay tu vi tri file sw.js de chay dung ca khi deploy duoi basePath
// (next.config.ts doc tu env BASE_PATH).
// ============================================================

const CACHE_VERSION = 'noda-v1';

// Thu muc chua sw.js: '/sw.js' -> '', '/foo/sw.js' -> '/foo'.
const BASE = new URL('./', self.location.href).pathname.replace(/\/$/, '');
const HOME = `${BASE}/`;

// --- Cache -------------------------------------------------
//
// /_next/static/*  cache-first vinh vien. Ten file co hash noi dung, nen
//                  ban build moi la ten file moi - khong bao gio cu.
// HTML             network-first. Cache-first o day la cach chac chan nhat
//                  de mot hom nao do nguoi dung nhin vao build tuan truoc
//                  ma khong hieu vi sao.
// API / Firestore  KHONG dung vao. Du lieu khong bao gio duoc phuc vu tu
//                  ban cu.

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
