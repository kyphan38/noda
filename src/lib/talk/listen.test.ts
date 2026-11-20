import { describe, expect, it } from 'vitest';
import { isAppleTouch, pickEngine, speechErrorReason } from './listen';

describe('listen', () => {
  it('spots iPhone and iPad, not a Mac', () => {
    expect(isAppleTouch('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(isAppleTouch('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isAppleTouch('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
  });
  it('uses the browser only where it works', () => {
    expect(pickEngine({ hasWebSpeech: true, appleTouch: false, browserFailed: false })).toBe('browser');
    expect(pickEngine({ hasWebSpeech: true, appleTouch: true, browserFailed: false })).toBe('gemini');
    expect(pickEngine({ hasWebSpeech: true, appleTouch: false, browserFailed: true })).toBe('gemini');
    expect(pickEngine({ hasWebSpeech: false, appleTouch: false, browserFailed: false })).toBe('gemini');
  });
  it('gives a plain reason for each error', () => {
    expect(speechErrorReason('not-allowed')).toContain('blocked');
    expect(speechErrorReason('service-not-allowed')).toContain('Switched to Gemini');
    expect(speechErrorReason('no-speech')).toContain('No speech heard');
    expect(speechErrorReason('weird')).toContain('Could not hear you');
  });
});
