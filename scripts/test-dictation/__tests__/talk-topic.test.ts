import { describe, it, expect } from 'vitest';
import {
  buildTopicPrompt,
  checkTopicRequest,
  parseTopicContent,
  PHRASE_COUNT,
  SET_SIZE,
} from '../../../functions/src/lib/talkTopic';

const good = { topicId: 'standup-b2', kind: 'preset', presetId: 'standup', title: 'Daily standup', description: 'What I did.', level: 'B2' };

describe('talk topic request', () => {
  it('accepts a good request and trims text', () => {
    expect(checkTopicRequest({ ...good, title: '  Daily   standup ' })).toEqual({ ...good, title: 'Daily standup' });
    expect(checkTopicRequest({ ...good, kind: 'custom', topicId: 'custom-abc123' }).presetId).toBeUndefined();
  });
  it('rejects bad ids, levels, kinds and long text', () => {
    expect(() => checkTopicRequest({ ...good, topicId: 'Bad/Id' })).toThrow();
    expect(() => checkTopicRequest({ ...good, level: 'A1' })).toThrow();
    expect(() => checkTopicRequest({ ...good, kind: 'other' })).toThrow();
    expect(() => checkTopicRequest({ ...good, title: '' })).toThrow();
    expect(() => checkTopicRequest({ ...good, description: 'x'.repeat(401) })).toThrow();
    expect(() => checkTopicRequest({ ...good, presetId: '' })).toThrow();
  });
});

describe('talk topic prompt', () => {
  it('names the topic, level and phrase count', () => {
    const p = buildTopicPrompt(checkTopicRequest(good));
    expect(p).toContain('Topic: Daily standup');
    expect(p).toContain('B2:');
    expect(p).toContain(`Return ${PHRASE_COUNT} useful phrases`);
    expect(p).toContain('everyday life');
    expect(p).toContain('Notes only, never a sentence');
    expect(p).not.toMatch(/\n\n\n/);
  });
});

describe('talk topic parsing', () => {
  const phrase = (i: number) => ({ text: `phrase number ${i}`, ipa: '/x/', meaning: `what phrase ${i} means`, example: `I use phrase number ${i} here.` });
  const answer = (n: number, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      persona: { name: 'Dana', role: 'Engineering manager', style: 'Calm and direct.' },
      scenarios: [
        { title: 'Redis memory alert', facts: ['Redis at 95% memory', '2am page'], opening: 'What happened last night?', ideas: ['the alert', 'first check'] },
        { title: 'No facts', facts: [], opening: 'Skipped?', ideas: [] },
      ],
      phrases: Array.from({ length: n }, (_, i) => phrase(i)),
      ...extra,
    });

  it('gives ids and sets, and stops at the phrase count', () => {
    const c = parseTopicContent(answer(PHRASE_COUNT + 5));
    expect(c.phrases).toHaveLength(PHRASE_COUNT);
    expect(c.phrases[0].id).toBe('p0');
    expect(c.phrases[SET_SIZE].setIndex).toBe(1);
    expect(c.persona.name).toBe('Dana');
    expect(c.scenarios).toEqual([
      { id: 's0', title: 'Redis memory alert', facts: ['Redis at 95% memory', '2am page'], opening: 'What happened last night?', ideas: ['the alert', 'first check'] },
    ]);
  });
  it('drops duplicates and phrases with no meaning', () => {
    const list = [phrase(0), { ...phrase(0), text: 'PHRASE NUMBER 0' }, { ...phrase(1), meaning: '' }, ...Array.from({ length: 25 }, (_, i) => phrase(i + 2))];
    const c = parseTopicContent(answer(0, { phrases: list }));
    expect(c.phrases.map((p) => p.text)).not.toContain('phrase number 1');
    expect(c.phrases.filter((p) => p.text.toLowerCase() === 'phrase number 0')).toHaveLength(1);
    expect(c.phrases[1].id).toBe('p1');
  });
  it('throws when too few phrases or no persona', () => {
    expect(() => parseTopicContent(answer(5))).toThrow();
    expect(() => parseTopicContent(answer(30, { persona: {} }))).toThrow();
    expect(() => parseTopicContent(answer(30, { scenarios: [] }))).toThrow();
    expect(() => parseTopicContent('not json')).toThrow();
  });
});
