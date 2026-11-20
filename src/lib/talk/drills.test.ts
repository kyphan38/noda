import { describe, expect, it } from 'vitest';
import { capsuleDue, monthKey, roundNumbers } from './drills';

describe('drills', () => {
  it('counts words, speed and fillers of a round', () => {
    expect(roundNumbers('uh so we um shipped it', 3)).toEqual({ words: 6, wpm: 120, fillers: 2 });
  });
  it('keys capsules by month and knows when one is due', () => {
    const now = new Date(2026, 10, 20).getTime();
    expect(monthKey(now)).toBe('2026-11');
    expect(capsuleDue([{ month: '2026-10' }], now)).toBe(true);
    expect(capsuleDue([{ month: '2026-11' }], now)).toBe(false);
  });
});
