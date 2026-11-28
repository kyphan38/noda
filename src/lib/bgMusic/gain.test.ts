import { describe, expect, it } from 'vitest';

import {
  clampVolume,
  DEFAULT_VOLUME,
  DUCK_FACTOR,
  DUCK_MS,
  FADE_IN_MS,
  FADE_OUT_MS,
  MAX_VOLUME,
  rampMs,
  shouldPlay,
  targetGain,
} from './gain';

describe('shouldPlay', () => {
  it('plays in listen, dictation and shadowing when enabled', () => {
    for (const mode of ['listen', 'dictation', 'shadowing'] as const) {
      expect(shouldPlay({ enabled: true, mode, micOpen: false })).toBe(true);
    }
  });

  it('stays quiet when turned off', () => {
    expect(shouldPlay({ enabled: false, mode: 'listen', micOpen: false })).toBe(false);
  });

  it('stops while the mic is open', () => {
    expect(shouldPlay({ enabled: true, mode: 'shadowing', micOpen: true })).toBe(false);
  });

  it('stays quiet outside a lesson', () => {
    expect(shouldPlay({ enabled: true, mode: null, micOpen: false })).toBe(false);
  });
});

describe('clampVolume', () => {
  it('keeps values inside 0..MAX_VOLUME and rounds them', () => {
    expect(clampVolume(-5)).toBe(0);
    expect(clampVolume(99)).toBe(MAX_VOLUME);
    expect(clampVolume(12.4)).toBe(12);
  });

  it('falls back to the default for bad input', () => {
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_VOLUME);
  });
});

describe('targetGain', () => {
  it('is the volume as a fraction', () => {
    expect(targetGain(20, false, true)).toBeCloseTo(0.2);
  });

  it('dips lightly while the clip plays', () => {
    expect(targetGain(20, true, true)).toBeCloseTo(0.2 * DUCK_FACTOR);
  });

  it('is zero when not playing', () => {
    expect(targetGain(20, false, false)).toBe(0);
  });

  it('never goes above MAX_VOLUME', () => {
    expect(targetGain(100, false, true)).toBeCloseTo(MAX_VOLUME / 100);
  });
});

describe('rampMs', () => {
  it('fades in from silence', () => {
    expect(rampMs(0, 0.12)).toBe(FADE_IN_MS);
  });

  it('fades out to silence', () => {
    expect(rampMs(0.12, 0)).toBe(FADE_OUT_MS);
  });

  it('uses a short step between two levels', () => {
    expect(rampMs(0.12, 0.072)).toBe(DUCK_MS);
  });
});
