// noda - Talk: the mistake bank. Fixes from every talk, grouped by pattern
// (verb tense, articles...). The next talk warms up on the top patterns;
// GRADUATE_STREAK right answers in a row and a pattern is done. Pure.

import type { TalkTurn } from './types';

export const GRADUATE_STREAK = 5;
export const MAX_EXAMPLES = 10;
export const WARMUP_COUNT = 4;

export type MistakeExample = { wrong: string; right: string; why: string; sessionId: string; at: number };

export type TalkMistake = {
  pattern: string;
  hits: number;
  cleanStreak: number;
  graduated: boolean;
  examples: MistakeExample[];
  updatedAt: number;
};

export const PATTERN_LABELS: Record<string, string> = {
  plural_s: 'Plural -s',
  verb_tense: 'Verb tense',
  verb_form: 'Verb form',
  subject_verb: 'Subject and verb',
  article: 'a / an / the',
  preposition: 'Prepositions',
  word_order: 'Word order',
  missing_word: 'Missing words',
  word_choice: 'Word choice',
  collocation: 'Word partners',
  vietlish: 'Word-for-word from Vietnamese',
  tone: 'Tone',
};

export const patternLabel = (p: string) => PATTERN_LABELS[p] ?? p;

/**
 * Adds a finished talk's fixes (not the ones marked "I said it right") to the
 * bank. "other" is left out: it groups nothing. Returns only changed entries.
 */
export function addSessionFixes(bank: Map<string, TalkMistake>, turns: TalkTurn[], sessionId: string, now: number): TalkMistake[] {
  const changed = new Map<string, TalkMistake>();
  turns.forEach((t) =>
    t.review.fixes.forEach((f, i) => {
      if ((t.dismissedFixes ?? []).includes(i) || !PATTERN_LABELS[f.pattern]) return;
      const prev = changed.get(f.pattern) ?? bank.get(f.pattern);
      const example = { wrong: f.wrong, right: f.right, why: f.why, sessionId, at: now };
      const examples = [example, ...(prev?.examples ?? []).filter((e) => e.wrong.toLowerCase() !== f.wrong.toLowerCase())].slice(0, MAX_EXAMPLES);
      changed.set(f.pattern, { pattern: f.pattern, hits: (prev?.hits ?? 0) + 1, cleanStreak: 0, graduated: false, examples, updatedAt: now });
    }),
  );
  return [...changed.values()];
}

export type WarmupItem = { pattern: string; wrong: string; right: string; why: string };

/** One recent example from each of the most frequent open patterns. */
export function pickWarmup(bank: TalkMistake[], n = WARMUP_COUNT): WarmupItem[] {
  return bank
    .filter((m) => !m.graduated && m.examples.length > 0)
    .sort((a, b) => b.hits - a.hits || b.updatedAt - a.updatedAt)
    .slice(0, n)
    .map((m) => ({ pattern: m.pattern, wrong: m.examples[0].wrong, right: m.examples[0].right, why: m.examples[0].why }));
}

export function applyWarmupAnswer(m: TalkMistake, right: boolean, now: number): TalkMistake {
  const cleanStreak = right ? m.cleanStreak + 1 : 0;
  return { ...m, cleanStreak, graduated: cleanStreak >= GRADUATE_STREAK, updatedAt: now };
}
