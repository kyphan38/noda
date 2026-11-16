import { describe, it, expect } from 'vitest';
import { buildWordPrompt, checkWordRequest, cleanWord, parseWordCard, wordKey } from '../../../functions/src/lib/wordCard';

describe('word card', () => {
  it('cleans the word and checks the request', () => {
    expect(cleanWord('  "Thought," ')).toBe('thought');
    expect(cleanWord('don’t')).toBe("don't");
    expect(checkWordRequest({ word: 'Ran.', sentence: ' She  ran home. ' })).toEqual({ word: 'ran', sentence: 'She ran home.' });
    expect(() => checkWordRequest({ word: '...', sentence: 'x' })).toThrow();
    expect(() => checkWordRequest({ word: 'ok', sentence: '' })).toThrow();
  });

  it('keys by word and sentence', () => {
    const a = wordKey({ word: 'bank', sentence: 'The river bank.' });
    const b = wordKey({ word: 'bank', sentence: 'The bank is closed.' });
    expect(a.startsWith('bank__')).toBe(true);
    expect(a).not.toBe(b);
    expect(wordKey({ word: 'bank', sentence: 'THE RIVER BANK.' })).toBe(a);
  });

  it('asks for simple English in context', () => {
    const p = buildWordPrompt({ word: 'bank', sentence: 'The river bank.' });
    expect(p).toContain('"bank"');
    expect(p).toContain('simple English');
  });

  it('parses the model answer and refuses an incomplete one', () => {
    expect(parseWordCard('{"ipa":"/bæŋk/","partOfSpeech":"Noun","meaning":"the land along a river"}', 'bank')).toEqual({
      word: 'bank',
      ipa: '/bæŋk/',
      partOfSpeech: 'noun',
      meaning: 'the land along a river',
    });
    expect(() => parseWordCard('{"ipa":""}', 'bank')).toThrow();
  });
});
