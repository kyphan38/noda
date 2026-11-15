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

/** Out of Gemini credit or rate limited (HTTP 402 / 429). The raw JSON must not reach the user. */
export function isGeminiQuotaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  const status = (e as { status?: unknown })?.status;
  return status === 402 || status === 429 || /"code":\s*(402|429)|RESOURCE_EXHAUSTED|credits are depleted/i.test(message);
}

export const QUOTA_MESSAGE = "AI credit is used up. Top it up in AI Studio, then try again.";
