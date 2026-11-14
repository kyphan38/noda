/** Stage 6: the SDK's `httpOptions.timeout` (GEMINI_TIMEOUT_MS) times out in two ways.
 * It aborts the local fetch (an AbortError, or a message mentioning timeout/aborted),
 * and it also sends the same budget as `X-Server-Timeout`, so Gemini itself can answer
 * first with a 504 DEADLINE_EXCEEDED whose raw JSON would otherwise reach the user. */
export function isGeminiTimeoutError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = e.name?.toLowerCase() ?? "";
  const message = e.message?.toLowerCase() ?? "";
  const status = (e as { status?: unknown }).status;
  return (
    name.includes("abort") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted") ||
    message.includes("deadline_exceeded") ||
    message.includes("deadline expired") ||
    status === 504
  );
}
