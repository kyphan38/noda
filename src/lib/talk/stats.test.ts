import { describe, expect, it } from 'vitest';
import { streak, talkNumbers, weekSummary } from './stats';
import type { TalkFix, TalkSession, TalkTurn } from './types';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 20, 12).getTime();

const turn = (transcript: string, seconds: number, fixes: TalkFix[] = [], usedPhraseIds: string[] = [], dismissedFixes: number[] = []): TalkTurn => ({
  ai: { text: '', curveball: false },
  transcript,
  seconds,
  review: { correct: '', natural: '', levelUp: '', fixes },
  usedPhraseIds,
  dismissedFixes,
});
const session = (daysAgo: number, turns: TalkTurn[] = [turn('hi there', 1)], topicId = 't'): TalkSession => ({
  id: `s${daysAgo}-${Math.random()}`,
  topicId,
  setIndex: 0,
  scenarioId: 's0',
  level: 'B2',
  mode: 'instant',
  selfRepair: true,
  turns,
  startedAt: NOW - daysAgo * DAY,
});
const fix = (pattern: string): TalkFix => ({ kind: 'grammar', wrong: 'a', right: 'b', why: '', pattern });

describe('streak', () => {
  it('counts days in a row; today does not break it yet', () => {
    expect(streak([session(0), session(1), session(2)], NOW)).toBe(3);
    expect(streak([session(1), session(2)], NOW)).toBe(2);
    expect(streak([], NOW)).toBe(0);
  });
  it('allows 2 rest days in 7, not 3', () => {
    // Practiced 1, 3, 5, 6 days ago: misses on days 2 and 4 are rest days.
    expect(streak([1, 3, 5, 6].map((d) => session(d)), NOW)).toBe(4);
    // Days 1 and 5 only: misses on 2, 3, 4 -> the third one breaks it.
    expect(streak([1, 5].map((d) => session(d)), NOW)).toBe(1);
  });
  it('ignores talks with no answer', () => {
    expect(streak([session(1, [])], NOW)).toBe(0);
  });
});

describe('weekSummary', () => {
  it('sums the last 7 days and ranks mistake types', () => {
    const w = weekSummary(
      [
        session(1, [turn('one two three four five six', 60, [fix('verb_tense'), fix('article'), fix('other')], ['p0']), turn('a b c', 60, [fix('verb_tense'), fix('article')], ['p0'], [1])]),
        session(2, [turn('x y z', 60, [fix('verb_tense')], ['p0'])], 'u'),
        session(9, [turn('old', 600, [fix('plural_s')])]),
      ],
      NOW,
    );
    expect(w).toEqual({
      talks: 2,
      answers: 3,
      minutes: 3,
      wpm: 4,
      phrasesUsed: 2,
      topPatterns: [
        { pattern: 'verb_tense', label: 'Verb tense', n: 3 },
        { pattern: 'article', label: 'a / an / the', n: 1 },
      ],
    });
  });
});

describe('talkNumbers', () => {
  it('gives per-answer numbers', () => {
    const n = talkNumbers(session(0, [turn('a b c um', 2, [fix('x'), fix('y')], ['p0'], [1]), turn('e f', 2, [], ['p0', 'p1'])]));
    expect(n).toEqual({ wordsPerAnswer: 3, wpm: 90, fixesPerAnswer: 0.5, fillersPerAnswer: 0.5, phrasesUsed: 2 });
  });
});
