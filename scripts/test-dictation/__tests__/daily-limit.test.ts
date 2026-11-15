import { describe, expect, it } from 'vitest';
import { nextAiUsage, usageDay } from '../../../functions/src/lib/dailyLimit';

const T = Date.UTC(2026, 10, 15, 3, 0); // 10:00 in Vietnam

describe('nextAiUsage', () => {
  it('starts a new count on a new day', () => {
    expect(nextAiUsage({ day: '2026-11-14', count: 200 }, T, 200)).toEqual({
      allowed: true,
      usage: { day: '2026-11-15', count: 1 },
    });
  });

  it('blocks at the limit', () => {
    expect(nextAiUsage({ day: '2026-11-15', count: 200 }, T, 200).allowed).toBe(false);
  });

  it('treats a missing doc as zero', () => {
    expect(nextAiUsage(undefined, T, 200).usage.count).toBe(1);
  });
});

describe('usageDay', () => {
  it('rolls over at midnight Vietnam time', () => {
    expect(usageDay(Date.UTC(2026, 10, 15, 16, 59))).toBe('2026-11-15');
    expect(usageDay(Date.UTC(2026, 10, 15, 17, 0))).toBe('2026-11-16');
  });
});
