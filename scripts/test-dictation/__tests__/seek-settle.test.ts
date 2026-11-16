import { describe, it, expect } from 'vitest';
import { settleTimeTowardTarget } from '../../../src/lib/seekSettle';
import { SEEK_SETTLE_TOLERANCE_S } from '../../../src/constants';
import type { Sentence } from '../../../src/types';

const close: Sentence[] = [
  { id: 1, text: 'First line', start: 10.0, end: 12.5 },
  { id: 2, text: 'Second line', start: 12.5, end: 14.0 },
  { id: 3, text: 'Third line after a gap', start: 14.2, end: 16.0 },
];

const active = (t: number) => close.find((s) => t >= s.start && t < s.end)?.id ?? null;

describe('settleTimeTowardTarget (sticky seek target)', () => {
  it('an early landing inside the previous sentence resolves to the target', () => {
    const landed = 12.4; // seek to line 2 landed 0.1 s early, inside line 1
    expect(active(landed)).toBe(1);
    const t = settleTimeTowardTarget(close, landed, 2);
    expect(t).toBe(12.5);
    expect(active(t)).toBe(2);
  });

  it('an early landing in the gap before the target resolves to the target', () => {
    const landed = 14.1; // between line 2 end and line 3 start
    expect(active(landed)).toBeNull();
    expect(active(settleTimeTowardTarget(close, landed, 3))).toBe(3);
  });

  it('leaves time alone when no target is pending', () => {
    expect(settleTimeTowardTarget(close, 12.4, null)).toBe(12.4);
  });

  it('leaves time alone once playback is past the target start', () => {
    expect(settleTimeTowardTarget(close, 13.0, 2)).toBe(13.0);
  });

  it('leaves time alone when the seek landed far away (outside the window)', () => {
    const far = 12.5 - SEEK_SETTLE_TOLERANCE_S - 0.5;
    expect(settleTimeTowardTarget(close, far, 2)).toBe(far);
  });

  it('a deliberate jump BACK to an earlier sentence still works', () => {
    const landed = 9.9; // user clicked line 1 while on line 3, landed slightly early
    expect(active(settleTimeTowardTarget(close, landed, 1))).toBe(1);
  });

  it('ignores an unknown target id', () => {
    expect(settleTimeTowardTarget(close, 12.4, 99)).toBe(12.4);
  });
});
