/** `checking` = the free cache lookup is running; `idle` = no analysis yet (offer the button). */
export type ShadowingPatternStatus = 'idle' | 'checking' | 'loading' | 'ready' | 'error';

/**
 * Turn a caught error into the specific message the panel should show.
 * Order matters - check offline/network first (it can present as almost any Functions
 * SDK error code depending on the browser), then the server-side timeout code, then
 * fall back to whatever message we got.
 */
export function resolveShadowingErrorMessage(e: unknown): string {
  const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';
  const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  // The Functions SDK reports a dropped/failed network request as
  // 'functions/unavailable' (or occasionally 'functions/internal' with no
  // real server-side cause) - treat those the same as "client is offline".
  const isNetworkError = code === 'functions/unavailable' || isBrowserOffline;

  if (isNetworkError) {
    return 'You are offline - analysis needs a connection.';
  }
  if (code === 'functions/deadline-exceeded') {
    return 'Analysis timed out, try again.';
  }
  const message = e instanceof Error ? e.message : '';
  // An older function can return the raw ffmpeg error ("killed with signal SIGSEGV") -
  // translate it here even though the current function already wraps it.
  if (/ffmpeg|sigsegv|signal|killed|ffprobe/i.test(message)) {
    return 'Could not read this audio file, try another file.';
  }
  return e instanceof Error ? e.message : 'Could not analyze this sentence.';
}
