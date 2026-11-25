// noda - Daily queue: today's short review, from dictation misses and Talk mistakes. Pure.
import type { MissRow } from './dictation-misses';

/** Lines to hear and write again each day. */
export const DAILY_LINES = 5;
/** A line missed this recently was just practiced in its lesson; it waits a bit. */
export const FRESH_MS = 12 * 60 * 60 * 1000;

/**
 * Lines for today: only lessons that can play here (`playable`), not missed in the
 * last FRESH_MS, most misses first, then the oldest miss (it has waited longest).
 */
export function pickDailyLines(rows: readonly MissRow[], playable: ReadonlySet<string>, now: number, n = DAILY_LINES): MissRow[] {
  return rows
    .filter((r) => r.n > 0 && playable.has(r.lessonId) && now - r.at >= FRESH_MS)
    .sort((a, b) => b.n - a.n || a.at - b.at)
    .slice(0, n);
}

/** Local calendar day, e.g. 2026-11-26: "today" turns over at the user's midnight. */
export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
