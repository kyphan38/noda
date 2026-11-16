import { describe, expect, it } from 'vitest';
import {
  cycleRepeatCount,
  isRepeatCountActive,
  repeatCountAriaLabel,
  shouldRepeatSentenceAtEnd,
} from './repeat-count';

describe('repeat count', () => {
  it('cycles 1, 2, 3, infinite and back to 1', () => {
    expect([1, 2, 3, 'infinite'].map((c) => cycleRepeatCount(c as never))).toEqual([2, 3, 'infinite', 1]);
  });
  it('repeats a sentence until it has played the chosen number of times', () => {
    expect(shouldRepeatSentenceAtEnd(1, 0)).toBe(false);
    expect(shouldRepeatSentenceAtEnd(3, 0)).toBe(true);
    expect(shouldRepeatSentenceAtEnd(3, 1)).toBe(true);
    expect(shouldRepeatSentenceAtEnd(3, 2)).toBe(false);
    expect(shouldRepeatSentenceAtEnd('infinite', 99)).toBe(true);
  });
  it('is active for anything but 1, with a readable label', () => {
    expect(isRepeatCountActive(1)).toBe(false);
    expect(isRepeatCountActive('infinite')).toBe(true);
    expect(repeatCountAriaLabel(1)).toBe('Repeat 1 time');
    expect(repeatCountAriaLabel(2)).toBe('Repeat 2 times');
  });
});
