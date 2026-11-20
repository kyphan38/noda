// noda - Talk: numbers across talks (streak, this week, old vs new). Pure.

import { PATTERN_LABELS } from './mistake-bank';
import { wordsPerMinute } from './session';
import type { TalkSession } from './types';

/** Missed days that do not break a streak, per 7 days. */
export const REST_DAYS_PER_WEEK = 2;
const DAY = 86_400_000;

/** Local calendar day, so the streak follows the user's own midnight. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const practiced = (sessions: TalkSession[]) => sessions.filter((s) => s.turns.length > 0);

/**
 * Days in a row with at least one answer. Today does not count against you
 * until it is over. A missed day is a rest day while there are fewer than
 * REST_DAYS_PER_WEEK misses in the 7 days ending on it; rest days add nothing.
 */
export function streak(sessions: TalkSession[], now: number): number {
  const days = new Set(practiced(sessions).map((s) => dayKey(s.startedAt)));
  let count = 0;
  const misses: number[] = [];
  for (let d = 0; d < 366; d++) {
    if (days.has(dayKey(now - d * DAY))) {
      count++;
      continue;
    }
    if (d === 0) continue;
    if (misses.filter((m) => m > d - 7).length >= REST_DAYS_PER_WEEK) break;
    misses.push(d);
  }
  return count;
}

export type WeekSummary = {
  talks: number;
  answers: number;
  minutes: number;
  wpm: number;
  phrasesUsed: number;
  topPatterns: { pattern: string; label: string; n: number }[];
};

/** The last 7 days. Fixes marked "I said it right" are not counted. */
export function weekSummary(sessions: TalkSession[], now: number): WeekSummary {
  const week = practiced(sessions).filter((s) => s.startedAt > now - 7 * DAY);
  const turns = week.flatMap((s) => s.turns);
  const seconds = turns.reduce((n, t) => n + t.seconds, 0);
  const counts = new Map<string, number>();
  for (const t of turns)
    t.review.fixes.forEach((f, i) => {
      if ((t.dismissedFixes ?? []).includes(i) || !PATTERN_LABELS[f.pattern]) return;
      counts.set(f.pattern, (counts.get(f.pattern) ?? 0) + 1);
    });
  return {
    talks: week.length,
    answers: turns.length,
    minutes: Math.round(seconds / 60),
    wpm: wordsPerMinute(turns.map((t) => t.transcript).join(' '), seconds),
    phrasesUsed: new Set(week.flatMap((s) => s.turns.flatMap((t) => t.usedPhraseIds.map((id) => `${s.topicId}:${id}`)))).size,
    topPatterns: [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([pattern, n]) => ({ pattern, label: PATTERN_LABELS[pattern], n })),
  };
}

export type TalkNumbers = { wordsPerAnswer: number; wpm: number; fixesPerAnswer: number; phrasesUsed: number };

/** The numbers compared when a talk is done again. */
export function talkNumbers(s: TalkSession): TalkNumbers {
  const n = Math.max(1, s.turns.length);
  const words = s.turns.reduce((a, t) => a + t.transcript.split(/\s+/).filter(Boolean).length, 0);
  const seconds = s.turns.reduce((a, t) => a + t.seconds, 0);
  const fixes = s.turns.reduce((a, t) => a + t.review.fixes.filter((_, i) => !(t.dismissedFixes ?? []).includes(i)).length, 0);
  return {
    wordsPerAnswer: Math.round(words / n),
    wpm: wordsPerMinute(s.turns.map((t) => t.transcript).join(' '), seconds),
    fixesPerAnswer: Math.round((fixes / n) * 10) / 10,
    phrasesUsed: new Set(s.turns.flatMap((t) => t.usedPhraseIds)).size,
  };
}
