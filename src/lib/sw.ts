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
  // Dev chunk names do not change with their content, so the cache-first
  // /_next/static rule would keep serving old code. Drop any worker in dev.
  if (process.env.NODE_ENV !== 'production') {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(regs.map((r) => r.unregister()));
    return null;
  }
  try {
    return await navigator.serviceWorker.register('sw.js');
  } catch {
    // Safari private mode and some other contexts refuse. The app still
    // works, just without the offline cache.
    return null;
  }
}
