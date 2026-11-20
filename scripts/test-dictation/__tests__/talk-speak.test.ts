import { describe, it, expect } from 'vitest';
import { checkSpeakText, MAX_TTS_CHARS, TTS_VOICE, ttsBody, ttsKey } from '../../../functions/src/lib/talkSpeak';

describe('talk voice', () => {
  it('checks the text', () => {
    expect(checkSpeakText({ text: '  Hi   there ' })).toBe('Hi there');
    expect(() => checkSpeakText({ text: '' })).toThrow();
    expect(() => checkSpeakText({ text: 'x'.repeat(MAX_TTS_CHARS + 1) })).toThrow();
  });
  it('keys the cache by text and voice', () => {
    expect(ttsKey('Hi')).toBe(ttsKey('Hi'));
    expect(ttsKey('Hi')).not.toBe(ttsKey('Hi', 'en-US-Chirp3-HD-Kore'));
    expect(ttsKey('Hi')).toHaveLength(32);
  });
  it('asks for MP3 in the voice language', () => {
    expect(ttsBody('Hi')).toEqual({ input: { text: 'Hi' }, voice: { languageCode: 'en-US', name: TTS_VOICE }, audioConfig: { audioEncoding: 'MP3' } });
  });
});
