import { describe, expect, it } from 'vitest';
import { buildTopicPrompt, checkTopicRequest, MAX_TARGETS } from '../../../functions/src/lib/talkTopic';

const base = { topicId: 'lesson-abc123', kind: 'custom', title: 'Swiss trains', description: '', level: 'B2' };

describe('checkTopicRequest, lesson topics', () => {
  it('keeps the lesson id and cleaned targets, at most MAX_TARGETS', () => {
    const targets = ['  pure   rock ', '', ...Array.from({ length: 20 }, (_, i) => `line ${i}`)];
    const req = checkTopicRequest({ ...base, notesKind: 'lesson', notes: 'x'.repeat(3000), lessonId: 'AbC123', targets });
    expect(req.notesKind).toBe('lesson');
    expect(req.lessonId).toBe('AbC123');
    expect(req.targets?.[0]).toBe('pure rock');
    expect(req.targets).toHaveLength(MAX_TARGETS);
  });

  it('allows longer notes only for a lesson', () => {
    expect(() => checkTopicRequest({ ...base, notesKind: 'context', notes: 'x'.repeat(3000) })).toThrow('too long');
    expect(() => checkTopicRequest({ ...base, notesKind: 'lesson', notes: 'x'.repeat(4001), lessonId: 'a' })).toThrow('too long');
  });

  it('needs the lesson text and id', () => {
    expect(() => checkTopicRequest({ ...base, notesKind: 'lesson', lessonId: 'a' })).toThrow('lesson text');
    expect(() => checkTopicRequest({ ...base, notesKind: 'lesson', notes: 'Some text.' })).toThrow('lesson id');
  });

  it('leaves other topics without lesson fields', () => {
    const req = checkTopicRequest({ ...base, notes: 'agenda', lessonId: 'a', targets: ['x'] });
    expect(req).not.toHaveProperty('lessonId');
    expect(req).not.toHaveProperty('targets');
  });
});

describe('buildTopicPrompt, lesson topics', () => {
  it('puts the clip and the missed lines in the prompt', () => {
    const req = checkTopicRequest({ ...base, notesKind: 'lesson', notes: 'The tunnel is 57 km long.', lessonId: 'a', targets: ['pure rock'] });
    const prompt = buildTopicPrompt(req);
    expect(prompt).toContain('The tunnel is 57 km long.');
    expect(prompt).toContain('- pure rock');
    expect(prompt).toContain('exactly as they appear');
  });

  it('takes chunks from the clip when there are no missed lines', () => {
    const req = checkTopicRequest({ ...base, notesKind: 'lesson', notes: 'Text.', lessonId: 'a' });
    expect(buildTopicPrompt(req)).toContain('taken from the clip');
  });
});
