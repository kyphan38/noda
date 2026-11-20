/**
 * Token use of one Gemini call, for the cost log. Numbers only, never content.
 * No @google/genai import, so the app's vitest suite can load it.
 */

export interface UsageMeta {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

/** USD per 1M tokens for gemini-3.8-flash (input, output; thinking bills as output). Check ai.google.dev/pricing. */
export function flashPrice(now: number): { input: number; output: number } {
  return now < Date.UTC(2027, 0, 1) ? { input: 0.75, output: 3.75 } : { input: 1.5, output: 7.5 };
}

export function summarizeUsage(label: string, meta: UsageMeta | undefined, now: number) {
  const input = meta?.promptTokenCount ?? 0;
  const output = meta?.candidatesTokenCount ?? 0;
  const thoughts = meta?.thoughtsTokenCount ?? 0;
  const price = flashPrice(now);
  const usd = (input * price.input + (output + thoughts) * price.output) / 1_000_000;
  return { label, input, output, thoughts, usd: Math.round(usd * 1e6) / 1e6 };
}

export type UsageTotal = { label: string; calls: number; input: number; output: number; thoughts: number; usd: number };

/** Sums the [gemini-usage] lines of a log, per label, most expensive first. Other lines are skipped. */
export function totalUsage(logLines: string[]): UsageTotal[] {
  const by = new Map<string, UsageTotal>();
  for (const l of logLines) {
    const at = l.indexOf("[gemini-usage]");
    if (at < 0) continue;
    let u: ReturnType<typeof summarizeUsage>;
    try {
      u = JSON.parse(l.slice(l.indexOf("{", at)));
    } catch {
      continue;
    }
    const t = by.get(u.label) ?? { label: u.label, calls: 0, input: 0, output: 0, thoughts: 0, usd: 0 };
    t.calls++;
    t.input += u.input;
    t.output += u.output;
    t.thoughts += u.thoughts;
    t.usd = Math.round((t.usd + u.usd) * 1e6) / 1e6;
    by.set(u.label, t);
  }
  return [...by.values()].sort((a, b) => b.usd - a.usd);
}
