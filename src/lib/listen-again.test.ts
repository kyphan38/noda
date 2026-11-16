import { describe, expect, it } from 'vitest';
import { listenAgainIds } from './listen-again';

const DAY = 86_400_000;
const NOW = 100 * DAY;
const l = (id: string, daysAgo: number, d: number, s = 0, isTrashed = false) => ({
  id,
  isTrashed,
  lastAccessed: NOW - daysAgo * DAY,
  dictationPercent: d,
  shadowingPercent: s,
});

describe('listenAgainIds', () => {
  it('keeps lessons half done or more and left for a week, oldest first, at most 3', () => {
    const lessons = [l('a', 8, 60), l('b', 30, 0, 80), l('c', 3, 100), l('d', 20, 40), l('e', 9, 50, 0, true), l('f', 10, 90), l('g', 12, 70)];
    expect(listenAgainIds(lessons, NOW)).toEqual(['b', 'g', 'f']);
  });
  it('is empty when nothing fits', () => {
    expect(listenAgainIds([l('c', 3, 100)], NOW)).toEqual([]);
  });
});
