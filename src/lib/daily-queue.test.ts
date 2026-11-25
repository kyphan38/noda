import { describe, expect, it } from 'vitest';
import { dayKey, FRESH_MS, pickDailyLines } from './daily-queue';
import type { MissRow } from './dictation-misses';

const NOW = 1_000 * FRESH_MS;
const row = (lessonId: string, sentenceId: number, n: number, agoMs: number): MissRow => ({
  lessonId,
  lessonName: lessonId,
  sentenceId,
  n,
  text: `line ${sentenceId}`,
  start: 0,
  end: 1,
  at: NOW - agoMs,
});

describe('pickDailyLines', () => {
  it('keeps playable, not fresh lines; most misses first, then the oldest', () => {
    const rows = [
      row('a', 1, 2, 2 * FRESH_MS),
      row('a', 2, 5, FRESH_MS / 2), // fresh
      row('yt', 3, 9, 3 * FRESH_MS), // not playable
      row('a', 4, 2, 5 * FRESH_MS),
      row('b', 5, 3, FRESH_MS),
      row('b', 6, 0, 9 * FRESH_MS), // no misses left
    ];
    const picked = pickDailyLines(rows, new Set(['a', 'b']), NOW);
    expect(picked.map((r) => r.sentenceId)).toEqual([5, 4, 1]);
  });

  it('stops at n', () => {
    const rows = Array.from({ length: 9 }, (_, i) => row('a', i, 1, 2 * FRESH_MS + i));
    expect(pickDailyLines(rows, new Set(['a']), NOW, 3)).toHaveLength(3);
  });
});

describe('dayKey', () => {
  it('is the local date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 10, 26, 0, 1).getTime())).toBe('2026-11-26');
  });
});
