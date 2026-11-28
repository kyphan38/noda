import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_VOLUME, MAX_VOLUME } from './gain';
import { bgMusicPrefsStore, DEFAULT_PREFS, parsePrefs, resetBgMusicPrefsForTest } from './prefs';

describe('parsePrefs', () => {
  it('is off by default', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(DEFAULT_PREFS.enabled).toBe(false);
  });

  it('reads saved values', () => {
    expect(parsePrefs(JSON.stringify({ enabled: true, trackId: 'rain', volume: 20 }))).toEqual({
      enabled: true,
      trackId: 'rain',
      volume: 20,
    });
  });

  it('falls back on broken JSON', () => {
    expect(parsePrefs('{oops')).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('null')).toEqual(DEFAULT_PREFS);
  });

  it('cleans bad fields one by one', () => {
    expect(parsePrefs(JSON.stringify({ enabled: 'yes', trackId: '', volume: 500 }))).toEqual({
      enabled: false,
      trackId: null,
      volume: MAX_VOLUME,
    });
    expect(parsePrefs(JSON.stringify({ volume: 'loud' })).volume).toBe(DEFAULT_VOLUME);
  });
});

describe('bgMusicPrefsStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetBgMusicPrefsForTest();
  });

  function stubStorage(): Map<string, string> {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    return data;
  }

  it('saves a change, keeps other fields and tells listeners', () => {
    const data = stubStorage();
    const seen = vi.fn();
    bgMusicPrefsStore.subscribe(seen);

    bgMusicPrefsStore.set({ enabled: true });
    bgMusicPrefsStore.set({ volume: 25 });

    expect(bgMusicPrefsStore.get()).toEqual({ enabled: true, trackId: null, volume: 25 });
    expect(parsePrefs(data.get('noda.bgMusic') ?? null).volume).toBe(25);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('returns the same object until something changes', () => {
    stubStorage();
    expect(bgMusicPrefsStore.get()).toBe(bgMusicPrefsStore.get());
  });

  it('still works when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(bgMusicPrefsStore.get()).toEqual(DEFAULT_PREFS);
    bgMusicPrefsStore.set({ enabled: true });
    expect(bgMusicPrefsStore.get().enabled).toBe(true);
  });
});
