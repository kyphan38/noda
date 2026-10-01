import { describe, it, expect } from 'vitest';
import { completionPercent, findResumeTarget } from '@/lib/progress';
import type { Sentence } from '@/types';

const transcript: Sentence[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  text: `line ${i + 1}`,
  start: i * 10,
  end: i * 10 + 8,
}));

describe('completionPercent', () => {
  it('counts only true entries against the total', () => {
    expect(completionPercent({ 1: true, 2: true, 3: false }, 10)).toBe(20);
  });
  it('is 0 for no data or an empty lesson', () => {
    expect(completionPercent(undefined, 10)).toBe(0);
    expect(completionPercent({ 1: true }, 0)).toBe(0);
  });
  it('never goes above 100 when ids outnumber the transcript', () => {
    expect(completionPercent({ 1: true, 2: true, 3: true }, 2)).toBe(100);
  });
});

describe('findResumeTarget', () => {
  it('returns null without a last mode', () => {
    expect(findResumeTarget(undefined, undefined, {}, transcript)).toBeNull();
  });

  it('dictation: resumes at the first sentence not typed yet', () => {
    expect(findResumeTarget('dictation', undefined, { 1: true, 2: true, 4: true }, transcript)).toEqual({
      mode: 'dictation',
      index: 2,
      time: 20,
    });
  });

  it('dictation: nothing to resume when not started or fully done', () => {
    expect(findResumeTarget('dictation', undefined, {}, transcript)).toBeNull();
    const all = Object.fromEntries(transcript.map((s) => [s.id, true]));
    expect(findResumeTarget('dictation', undefined, all, transcript)).toBeNull();
  });

  it('shadowing: prefers the saved sentence over the first open one', () => {
    const progress = { shadowing: { completed: { 1: true }, lastIndex: 6 } };
    expect(findResumeTarget('shadowing', progress, {}, transcript)).toEqual({
      mode: 'shadowing',
      index: 6,
      time: 60,
    });
  });

  it('shadowing: falls back to the first open sentence when lastIndex is missing or out of range', () => {
    const progress = { shadowing: { completed: { 1: true, 2: true }, lastIndex: 99 } };
    expect(findResumeTarget('shadowing', progress, {}, transcript)?.index).toBe(2);
  });

  it('listen: resumes at the saved time, but not near the start or end', () => {
    expect(findResumeTarget('listen', { listen: { lastTime: 43 } }, {}, transcript)).toEqual({
      mode: 'listen',
      index: 4,
      time: 43,
    });
    expect(findResumeTarget('listen', { listen: { lastTime: 2 } }, {}, transcript)).toBeNull();
    expect(findResumeTarget('listen', { listen: { lastTime: 96 } }, {}, transcript)).toBeNull();
  });

  it('listen: a time in a gap points at the next sentence', () => {
    expect(findResumeTarget('listen', { listen: { lastTime: 49 } }, {}, transcript)?.index).toBe(5);
  });
});
