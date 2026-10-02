// ============================================================
// noda - Dang ky service worker
//
// Copy tu fina/src/lib/sw.ts. File nay KHONG import gi ca, co y.
//
// Dung duong dan tuong doi de chay dung ca khi deploy duoi basePath
// (next.config.ts doc tu env BASE_PATH): dang ky 'sw.js' tu trang hien tai
// thi trinh duyet tu phan giai ve {basePath}/sw.js voi scope {basePath}/.
// ============================================================

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('sw.js');
  } catch {
    // Safari private mode va mot vai ngu canh khac tu choi. App van chay,
    // chi la khong co cache offline.
    return null;
  }
}
