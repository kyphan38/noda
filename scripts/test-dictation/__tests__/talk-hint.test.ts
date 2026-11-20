import { describe, it, expect } from 'vitest';
import { buildHintPrompt, checkHintRequest, MAX_HINTS, parseHints } from '../../../functions/src/lib/talkHint';

describe('talk hint', () => {
  it('checks the request', () => {
    expect(checkHintRequest({ topicId: 'incident-b2', aiLine: ' What broke? ', idea: ' the database was too slow ' })).toEqual({
      topicId: 'incident-b2',
      aiLine: 'What broke?',
      idea: 'the database was too slow',
    });
    expect(() => checkHintRequest({ topicId: 'incident-b2', aiLine: 'x', idea: '' })).toThrow();
    expect(() => checkHintRequest({ topicId: 'incident-b2', aiLine: 'x', idea: 'y'.repeat(201) })).toThrow();
    expect(() => checkHintRequest({ topicId: 'Bad/Id', aiLine: 'x', idea: 'y' })).toThrow();
  });
  it('asks for chunks, never a full answer', () => {
    const p = buildHintPrompt({ topicId: 't-b2', aiLine: 'What broke?', idea: 'db slow' }, 'Production incident');
    expect(p).toContain('Never a full sentence and never the full answer');
    expect(p).toContain('"db slow"');
  });
  it('drops long chunks and caps the list', () => {
    const raw = JSON.stringify({
      hints: [
        { text: 'hit a bottleneck', use: 'when something slows all the rest' },
        { text: 'this is a whole long sentence that gives the answer away', use: 'x' },
        { text: 'under heavy load', use: 'many users at once' },
        { text: '', use: 'empty' },
        { text: 'a', use: '' },
        { text: 'b', use: '' },
      ],
    });
    const h = parseHints(raw);
    expect(h.map((x) => x.text)).toEqual(['hit a bottleneck', 'under heavy load', 'a']);
    expect(h).toHaveLength(MAX_HINTS);
  });
});
