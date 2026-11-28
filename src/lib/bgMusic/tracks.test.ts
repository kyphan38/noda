import { describe, expect, it } from 'vitest';

import { pickTrackUrl, type BgTrack } from './tracks';

const tracks: BgTrack[] = [
  { id: 'rain', name: 'Rain', url: 'rain.mp3' },
  { id: 'lofi', name: 'Lofi', url: 'lofi.mp3' },
];

describe('pickTrackUrl', () => {
  it('returns the chosen track', () => {
    expect(pickTrackUrl('lofi', tracks)).toBe('lofi.mp3');
  });

  it('falls back to the first track when nothing or a removed track is chosen', () => {
    expect(pickTrackUrl(null, tracks)).toBe('rain.mp3');
    expect(pickTrackUrl('gone', tracks)).toBe('rain.mp3');
  });

  it('is null with no tracks', () => {
    expect(pickTrackUrl(null, [])).toBeNull();
  });
});
