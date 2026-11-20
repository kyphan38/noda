import { describe, it, expect } from 'vitest';
import { flashPrice, summarizeUsage, totalUsage } from '../../../functions/src/lib/geminiUsage';

describe('totalUsage', () => {
  it('sums log lines per label and skips the rest', () => {
    const lines = [
      '2026-11-20T10:00:00Z I talkTurn: [gemini-usage] {"label":"talkTurn","input":100,"output":10,"thoughts":5,"usd":0.001}',
      'some other log line',
      '... [gemini-usage] {"label":"talkTurn","input":200,"output":20,"thoughts":0,"usd":0.002}',
      '... [gemini-usage] {"label":"talkWrap","input":50,"output":5,"thoughts":0,"usd":0.0005}',
      '... [gemini-usage] {broken',
    ];
    expect(totalUsage(lines)).toEqual([
      { label: 'talkTurn', calls: 2, input: 300, output: 30, thoughts: 5, usd: 0.003 },
      { label: 'talkWrap', calls: 1, input: 50, output: 5, thoughts: 0, usd: 0.0005 },
    ]);
  });
});

describe('gemini usage', () => {
  it('uses the 2026 price, then the 2027 one', () => {
    expect(flashPrice(Date.UTC(2026, 10, 20))).toEqual({ input: 0.75, output: 3.75 });
    expect(flashPrice(Date.UTC(2027, 0, 1))).toEqual({ input: 1.5, output: 7.5 });
  });
  it('counts thinking as output and rounds the cost', () => {
    const u = summarizeUsage('talkTurn', { promptTokenCount: 2000, candidatesTokenCount: 600, thoughtsTokenCount: 400 }, Date.UTC(2026, 10, 20));
    expect(u).toEqual({ label: 'talkTurn', input: 2000, output: 600, thoughts: 400, usd: 0.00525 });
    expect(summarizeUsage('x', undefined, 0)).toEqual({ label: 'x', input: 0, output: 0, thoughts: 0, usd: 0 });
  });
});
