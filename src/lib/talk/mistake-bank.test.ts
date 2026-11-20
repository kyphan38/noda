import { describe, expect, it } from 'vitest';
import { addSessionFixes, applyWarmupAnswer, GRADUATE_STREAK, patternLabel, pickWarmup, type TalkMistake } from './mistake-bank';
import type { TalkFix, TalkTurn } from './types';

const fix = (wrong: string, pattern: string): TalkFix => ({ kind: 'grammar', wrong, right: `${wrong}!`, why: 'because', pattern });
const turn = (fixes: TalkFix[], dismissedFixes: number[] = []): TalkTurn => ({
  ai: { text: '', curveball: false },
  transcript: '',
  seconds: 0,
  review: { correct: '', natural: '', levelUp: '', fixes },
  usedPhraseIds: [],
  dismissedFixes,
});
const entry = (pattern: string, hits: number, extra: Partial<TalkMistake> = {}): TalkMistake => ({
  pattern,
  hits,
  cleanStreak: 0,
  graduated: false,
  examples: [{ wrong: `${pattern} wrong`, right: `${pattern} right`, why: '', sessionId: 's', at: 0 }],
  updatedAt: 0,
  ...extra,
});

describe('addSessionFixes', () => {
  it('counts fixes per pattern, skips dismissed and other, resets the streak', () => {
    const bank = new Map([['verb_tense', entry('verb_tense', 3, { cleanStreak: 4 })]]);
    const out = addSessionFixes(bank, [turn([fix('I go', 'verb_tense'), fix('x', 'other')]), turn([fix('I am go', 'verb_tense'), fix('a cat', 'article')], [1])], 's2', 10);
    const tense = out.find((m) => m.pattern === 'verb_tense')!;
    expect(out.map((m) => m.pattern)).toEqual(['verb_tense']);
    expect(tense.hits).toBe(5);
    expect(tense.cleanStreak).toBe(0);
    expect(tense.examples.map((e) => e.wrong)).toEqual(['I am go', 'I go', 'verb_tense wrong']);
  });
  it('does not repeat the same wrong words', () => {
    const out = addSessionFixes(new Map(), [turn([fix('I GO', 'verb_tense')]), turn([fix('i go', 'verb_tense')])], 's', 1);
    expect(out[0].examples).toHaveLength(1);
    expect(out[0].hits).toBe(2);
  });
});

describe('pickWarmup', () => {
  it('takes the most frequent open patterns, newest first on a tie', () => {
    const bank = [entry('article', 2, { updatedAt: 5 }), entry('verb_tense', 7), entry('plural_s', 2, { updatedAt: 9 }), entry('tone', 9, { graduated: true })];
    expect(pickWarmup(bank, 3).map((w) => w.pattern)).toEqual(['verb_tense', 'plural_s', 'article']);
  });
});

describe('applyWarmupAnswer', () => {
  it('graduates after enough right answers in a row and resets on a miss', () => {
    let m = entry('article', 1);
    for (let i = 0; i < GRADUATE_STREAK - 1; i++) m = applyWarmupAnswer(m, true, 1);
    expect(m.graduated).toBe(false);
    expect(applyWarmupAnswer(m, false, 1).cleanStreak).toBe(0);
    expect(applyWarmupAnswer(m, true, 1).graduated).toBe(true);
    expect(patternLabel('article')).toBe('a / an / the');
    expect(patternLabel('new_one')).toBe('new_one');
  });
});
