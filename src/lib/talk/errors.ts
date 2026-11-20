// noda - Talk: turn a failed call into something a person can act on. Pure.

type CallError = { code?: unknown; message?: unknown };

/**
 * The request never got a real answer: dropped connection, a laptop waking up,
 * a timeout. The Functions SDK reports that as "functions/internal" with the bare
 * message "internal" (no server text), or as unavailable / deadline-exceeded.
 */
export function isConnectionError(e: unknown): boolean {
  const { code, message } = (e ?? {}) as CallError;
  const msg = typeof message === 'string' ? message.trim().toLowerCase() : '';
  if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') return true;
  return code === 'functions/internal' && (msg === '' || msg.startsWith('internal'));
}

export function friendlyError(e: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (isConnectionError(e)) return 'Connection problem: your answer did not reach the server.';
  const msg = (e as CallError | null)?.message;
  return typeof msg === 'string' && msg.trim() ? msg : fallback;
}
