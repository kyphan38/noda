import { describe, it, expect } from 'vitest';
import { buildSpeechPrompt, checkSpeechRequest, parseSpeech, SpeechShapeError } from '../../../functions/src/lib/talkSpeech';

describe('talk speech', () => {
  it('checks the request', () => {
    expect(checkSpeechRequest({ mode: 'transcribe', source: 'ignored' })).toEqual({ mode: 'transcribe', source: '' });
    expect(checkSpeechRequest({ mode: 'retell', source: ' A text. ' })).toEqual({ mode: 'retell', source: 'A text.' });
    expect(() => checkSpeechRequest({ mode: 'retell', source: '' })).toThrow();
    expect(() => checkSpeechRequest({ mode: 'other' })).toThrow();
    expect(() => checkSpeechRequest({ mode: 'retell', source: 'x'.repeat(4001) })).toThrow();
  });
  it('builds a short prompt to transcribe and a full one to retell', () => {
    expect(buildSpeechPrompt({ mode: 'transcribe', source: '' })).not.toContain('points: the');
    const p = buildSpeechPrompt({ mode: 'retell', source: 'The deploy failed.' });
    expect(p).toContain('The deploy failed.');
    expect(p).toContain('EXACTLY what the learner said');
  });
  it('parses both modes', () => {
    expect(parseSpeech(JSON.stringify({ transcript: ' uh so  the deploy ' }), 'transcribe')).toEqual({ transcript: 'uh so the deploy', points: [], model: '', fixes: [] });
    const r = parseSpeech(
      JSON.stringify({
        transcript: 'the deploy is fail',
        points: [{ point: 'The deploy failed', covered: true }, { point: 'It was rolled back', covered: false }, { point: '' }],
        model: 'The deploy failed, so we rolled it back.',
        fixes: [{ kind: 'grammar', wrong: 'is fail', right: 'failed', why: 'Past.', pattern: 'verb_form' }, { kind: 'nope', wrong: 'a', right: 'b' }],
      }),
      'retell',
    );
    expect(r.points).toEqual([{ point: 'The deploy failed', covered: true }, { point: 'It was rolled back', covered: false }]);
    expect(r.fixes.map((f) => f.right)).toEqual(['failed']);
    expect(() => parseSpeech(JSON.stringify({ transcript: 'x', points: [] }), 'retell')).toThrow(SpeechShapeError);
  });
});
