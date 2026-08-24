export type ShadowingPatternStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Turn a caught error into the specific Vietnamese message the panel should show.
 * Order matters — check offline/network first (it can present as almost any Functions
 * SDK error code depending on the browser), then the server-side timeout code, then
 * fall back to whatever message we got.
 */
export function resolveShadowingErrorMessage(e: unknown): string {
  const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  // The Functions SDK reports a dropped/failed network request as
  // 'functions/unavailable' (or occasionally 'functions/internal' with no
  // real server-side cause) — treat those the same as "client is offline".
  const isNetworkError = code === 'functions/unavailable' || isBrowserOffline;

  if (isNetworkError) {
    return 'Bạn đang offline — cần mạng để phân tích.';
  }
  if (code === 'functions/deadline-exceeded') {
    return 'Hết thời gian phân tích, thử lại.';
  }
  return e instanceof Error ? e.message : 'Không phân tích được câu này.';
}
