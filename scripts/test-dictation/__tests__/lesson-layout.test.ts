import { describe, it, expect } from 'vitest';
import { countDone, donePercent, mergeLesson, splitLesson } from '@/lib/lessonLayout';

const lesson = {
  id: 'L1',
  name: 'Talk',
  mediaPath: 'users/u/media/1.mp3',
  totalSentences: 4,
  transcriptText: '1\n00:00:00,000 --> 00:00:01,000\nhi',
  completedSentences: { 1: true, 2: true, 3: false },
  dictationInputs: { 3: 'he' },
  progress: { shadowing: { completed: { 1: true } }, listen: { lastTime: 12 } },
  lastMode: 'dictation',
};

describe('lesson layout', () => {
  it('puts heavy fields in content and counts on the lesson doc', () => {
    const { meta, content } = splitLesson(lesson);
    expect(Object.keys(content).sort()).toEqual(
      ['completedSentences', 'dictationInputs', 'lastMode', 'progress', 'transcriptText'].sort()
    );
    expect(meta).toMatchObject({ id: 'L1', name: 'Talk', totalSentences: 4, dictationDone: 2, shadowingDone: 1 });
    expect(meta).not.toHaveProperty('transcriptText');
  });

  it('round-trips through split and merge', () => {
    const { meta, content } = splitLesson(lesson);
    expect(mergeLesson(meta, content)).toMatchObject(lesson);
  });

  it('reads heavy fields from the lesson doc when there is no content doc (pre-split)', () => {
    expect(mergeLesson(lesson, undefined)).toMatchObject(lesson);
  });

  it('computes percent from counts, falling back to maps on pre-split docs', () => {
    expect(donePercent(2, undefined, 4)).toBe(50);
    expect(donePercent(undefined, { 1: true, 2: false }, 4)).toBe(25);
    expect(donePercent(9, undefined, 4)).toBe(100);
    expect(donePercent(1, undefined, 0)).toBe(0);
    expect(countDone({ 1: true, 2: false, 3: true })).toBe(2);
  });
});
