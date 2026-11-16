import { describe, expect, it } from 'vitest';
import { attemptScores, dailyScores, topHabits, topWords } from './speaking-stats';

const at = (iso: string) => new Date(iso).getTime();

describe('scores over time', () => {
  const attempts = [
    { score: 60, createdAt: at('2026-11-02T10:00:00') },
    { score: 80, createdAt: at('2026-11-01T09:00:00') },
    { score: 70, createdAt: at('2026-11-01T20:00:00') },
  ];
  it('averages per day, oldest first', () => {
    expect(dailyScores(attempts)).toEqual([
      { label: '2026-11-01', score: 75, n: 2 },
      { label: '2026-11-02', score: 60, n: 1 },
    ]);
  });
  it('lists one lesson in order', () => {
    expect(attemptScores(attempts).map((p) => p.score)).toEqual([80, 70, 60]);
  });
});

describe('habits and words', () => {
  const check = (type: string, sounds: string, result: 'yes' | 'partly' | 'no') => ({ id: 0, type, text: '', sounds, via: '', result });
  const attempts = [
    { checks: [check('elision', '/t/', 'no'), check('linking', '', 'partly'), check('reduction', '/ə/', 'yes')], wordIssues: [{ index: 1, kind: 'mispronounced' as const, heard: '', tip: '' }], referenceText: 'I thought, so.' },
    { checks: [check('elision', '/t/', 'partly')], wordIssues: [{ index: 1, kind: 'mispronounced' as const, heard: '', tip: '' }, { index: 0, kind: 'missing' as const, heard: '', tip: '' }], referenceText: 'We Thought it' },
  ];
  it('ranks sound habits that did not come through', () => {
    expect(topHabits(attempts, 5)).toEqual([
      { label: 'elision · /t/', misses: 1.5, checks: 2 },
      { label: 'linking', misses: 0.5, checks: 1 },
    ]);
  });
  it('counts mispronounced words without punctuation or case', () => {
    expect(topWords(attempts, 5)).toEqual([{ word: 'thought', times: 2 }]);
  });
});
