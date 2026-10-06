// ============================================================
// noda - Service worker registration
//
// Copied from fina/src/lib/sw.ts. This file imports nothing, on purpose.
//
// A relative path works under a basePath too (next.config.ts reads BASE_PATH):
// 'sw.js' resolves to {basePath}/sw.js with scope {basePath}/.
// ============================================================

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('sw.js');
  } catch {
    // Safari private mode and some other contexts refuse. The app still
    // works, just without the offline cache.
    return null;
  }
}
