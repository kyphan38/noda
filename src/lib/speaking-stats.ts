// noda - Speaking over time (N5) and sound habits that keep going wrong (N6). Pure.

import type { SpeakingAttempt } from '@/types';

export type ScorePoint = { label: string; score: number; n: number };

function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Average score per day, oldest first. */
export function dailyScores(attempts: Pick<SpeakingAttempt, 'score' | 'createdAt'>[]): ScorePoint[] {
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const a of attempts) {
    const d = localDay(a.createdAt);
    const cur = byDay.get(d) ?? { sum: 0, n: 0 };
    byDay.set(d, { sum: cur.sum + a.score, n: cur.n + 1 });
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([label, v]) => ({ label, score: Math.round(v.sum / v.n), n: v.n }));
}

/** Each attempt in order, for one lesson's chart. */
export function attemptScores(attempts: Pick<SpeakingAttempt, 'score' | 'createdAt'>[]): ScorePoint[] {
  return [...attempts]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((a) => ({ label: localDay(a.createdAt), score: a.score, n: 1 }));
}

export type Habit = { label: string; misses: number; checks: number };

/**
 * Sound habits (linking, reduction, elision, assimilation, by sound) that did not come
 * through: "no" counts 1, "partly" a half. Worst first, then the most checked.
 */
export function topHabits(attempts: Pick<SpeakingAttempt, 'checks'>[], limit: number): Habit[] {
  const m = new Map<string, Habit>();
  for (const a of attempts) {
    for (const c of a.checks ?? []) {
      const sounds = (c.sounds ?? '').trim();
      const label = sounds ? `${c.type} · ${sounds}` : c.type;
      const h = m.get(label) ?? { label, misses: 0, checks: 0 };
      h.checks += 1;
      h.misses += c.result === 'no' ? 1 : c.result === 'partly' ? 0.5 : 0;
      m.set(label, h);
    }
  }
  return [...m.values()]
    .filter((h) => h.misses > 0)
    .sort((a, b) => b.misses - a.misses || b.checks - a.checks || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export type WordMiss = { word: string; times: number };

/** Words said wrong most often across attempts. */
export function topWords(attempts: Pick<SpeakingAttempt, 'wordIssues' | 'referenceText'>[], limit: number): WordMiss[] {
  const m = new Map<string, number>();
  for (const a of attempts) {
    const words = (a.referenceText ?? '').split(/\s+/);
    for (const w of a.wordIssues ?? []) {
      if (w.kind !== 'mispronounced') continue;
      const word = (words[w.index] ?? '').toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
      if (word) m.set(word, (m.get(word) ?? 0) + 1);
    }
  }
  return [...m.entries()]
    .map(([word, times]) => ({ word, times }))
    .sort((a, b) => b.times - a.times || a.word.localeCompare(b.word))
    .slice(0, limit);
}
