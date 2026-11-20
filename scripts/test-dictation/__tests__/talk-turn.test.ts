import { describe, it, expect } from 'vitest';
import { buildTurnPrompt, checkTurnRequest, frameFor, MAX_FIXES, parseTurnResult, TurnShapeError } from '../../../functions/src/lib/talkTurn';

const ctx = {
  level: 'B2' as const,
  topicTitle: 'Daily standup',
  persona: { name: 'Dana', role: 'Engineering manager', style: 'Calm.' },
  targets: [
    { id: 'p0', text: 'wrap up' },
    { id: 'p1', text: 'on track' },
  ],
  facts: ['Redis at 95% memory'],
};

describe('talk turn request', () => {
  it('keeps the last 3 history items and valid phrase ids only', () => {
    const req = checkTurnRequest({
      topicId: 'standup-b2',
      scenarioId: 's1',
      aiLine: '  What did you do? ',
      history: [1, 2, 3, 4].map((i) => ({ ai: `q${i}`, you: `a${i}` })),
      targetIds: ['p0', 'p1', '../x', 7],
      curveball: true,
    });
    expect(req.aiLine).toBe('What did you do?');
    expect(req.history.map((h) => h.ai)).toEqual(['q2', 'q3', 'q4']);
    expect(req.targetIds).toEqual(['p0', 'p1']);
    expect(req.curveball).toBe(true);
    expect(req.isLast).toBe(false);
    expect(req.replyKind).toBe('question');
    expect(checkTurnRequest({ topicId: 'standup-b2', scenarioId: 's0', aiLine: 'Hi', replyKind: 'share' }).replyKind).toBe('share');
    expect(checkTurnRequest({ topicId: 'standup-b2', scenarioId: 's0', aiLine: 'Hi', replyKind: 'odd' }).replyKind).toBe('question');
  });
  it('rejects a bad topic id or an empty line', () => {
    expect(() => checkTurnRequest({ topicId: 'x/y', scenarioId: 's0', aiLine: 'Hi' })).toThrow();
    expect(() => checkTurnRequest({ topicId: 'standup-b2', scenarioId: 's0', aiLine: ' ' })).toThrow();
    expect(() => checkTurnRequest({ topicId: 'standup-b2', scenarioId: 'x', aiLine: 'Hi' })).toThrow();
  });
});

describe('talk turn prompt', () => {
  const base = checkTurnRequest({ topicId: 'standup-b2', scenarioId: 's0', aiLine: 'What did you do?', history: [{ ai: 'Hi', you: 'Hello' }] });
  it('asks for an exact transcript and lists the targets', () => {
    const p = buildTurnPrompt(base, ctx);
    expect(p).toContain('EXACTLY what the learner said');
    expect(p).toContain('- p0: wrap up');
    expect(p).toContain('Dana: Hi\nLearner: Hello');
    expect(p).toContain('ONE natural follow-up question');
    expect(p).not.toMatch(/Vietnamese meaning|tiếng/);
    expect(p).toContain('- Redis at 95% memory');
    expect(p).toContain('ideas: 2 or 3 notes');
    expect(p).toContain('Every fix must agree with those versions.');
  });
  it('asks for structure notes only on framed topics', () => {
    expect(buildTurnPrompt(base, ctx)).toContain('5. structure: an empty string.');
    expect(buildTurnPrompt(base, { ...ctx, frame: 'bluf' })).toContain('BLUF: the main point or answer first');
    expect(frameFor('interview')).toBe('star');
    expect(frameFor('small-talk')).toBeUndefined();
    expect(frameFor(undefined)).toBeUndefined();
  });
  it('adds mood, time, memory, spoken style, recasts and delivery rules', () => {
    const p = buildTurnPrompt({ ...base, when: 'Friday afternoon' }, { ...ctx, mood: 'stressed', memory: ['Has a release on Friday'] });
    expect(p).toContain('Your mood in this situation: stressed.');
    expect(p).toContain('For the learner it is Friday afternoon now.');
    expect(p).toContain('- Has a release on Friday');
    expect(p).toContain('Sound like a real person talking');
    expect(p).toContain('echo their idea back correctly');
    expect(p).toContain('No rush, Take your time');
    expect(buildTurnPrompt(base, ctx)).not.toContain('What you remember');
    expect(checkTurnRequest({ topicId: 'standup-b2', scenarioId: 's0', aiLine: 'Hi', when: 'Friday<script>' }).when).toBe('');
  });
  it('switches the reply rule for a curveball and for the last turn', () => {
    expect(buildTurnPrompt({ ...base, curveball: true }, ctx)).toContain('Curveball');
    expect(buildTurnPrompt({ ...base, isLast: true }, ctx)).toContain('close the talk politely');
    expect(buildTurnPrompt({ ...base, replyKind: 'share' }, ctx)).toContain('end WITHOUT a question');
    expect(buildTurnPrompt({ ...base, replyKind: 'invite' }, ctx)).toContain('asks them to ask YOU something now');
    expect(buildTurnPrompt(base, ctx)).toContain('first answer it briefly');
  });
});

describe('talk turn parsing', () => {
  const answer = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      transcript: 'I am working on backend for many product.',
      reply: { text: 'Nice. What blocks you?', curveball: false, ideas: ['the API keys', '', 'who can help', 'x', 'y'] },
      review: {
        correct: "I've been working on the backend for many products.",
        natural: "I've mainly been working on backend services.",
        levelUp: '',
        fixes: [
          { kind: 'grammar', wrong: 'I am working', right: "I've been working", why: 'Started before and still going.', pattern: 'verb_tense' },
          { kind: 'grammar', wrong: 'many product', right: 'many products', why: 'Many needs a plural.', pattern: 'plural_s' },
          { kind: 'bad-kind', wrong: 'x', right: 'y', why: '', pattern: 'other' },
          { kind: 'word', wrong: 'same', right: 'SAME', why: '', pattern: 'other' },
          { kind: 'natural', wrong: 'on backend', right: 'on backend services', why: '', pattern: 'made_up' },
          { kind: 'tone', wrong: 'a', right: 'b', why: '', pattern: 'tone' },
        ],
      },
      usedPhraseIds: ['p0', 'p0', 'p9'],
      ...extra,
    });

  it('cleans fixes, fills empty levels and keeps only known phrase ids', () => {
    const r = parseTurnResult(answer(), ['p0', 'p1']);
    expect(r.review.fixes).toHaveLength(MAX_FIXES);
    expect(r.review.fixes.map((f) => f.pattern)).toEqual(['verb_tense', 'plural_s', 'other']);
    expect(r.review.levelUp).toBe(r.review.natural);
    expect(r.usedPhraseIds).toEqual(['p0']);
    expect(r.reply.curveball).toBe(false);
    expect(r.reply.ideas).toEqual(['the API keys', 'who can help', 'x']);
    expect(r.review.structure).toBeUndefined();
    expect(parseTurnResult(answer({ review: { correct: 'a', natural: 'b', levelUp: 'c', fixes: [], structure: ' Say the result first. ' } }), []).review.structure).toBe('Say the result first.');
  });
  it('throws a shape error on bad JSON or no reply', () => {
    expect(() => parseTurnResult('oops', [])).toThrow(TurnShapeError);
    expect(() => parseTurnResult(answer({ reply: {} }), [])).toThrow(TurnShapeError);
  });
});
