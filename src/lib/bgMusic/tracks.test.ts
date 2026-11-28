import { describe, expect, it } from 'vitest';

import { BG_CATEGORIES, DEFAULT_TRACKS, nextTrack, pickTrack, trackPath, tracksIn, type BgTrack } from './tracks';

const t = (id: string, category: BgTrack['category']): BgTrack => ({ id, name: id, category, path: `p/${id}`, gain: 1 });
const tracks: BgTrack[] = [t('a', 'piano'), t('b', 'piano'), t('c', 'chill')];

describe('pickTrack', () => {
  it('returns the chosen track', () => {
    expect(pickTrack('b', tracks)?.id).toBe('b');
  });

  it('falls back to the first track when nothing or a removed track is chosen', () => {
    expect(pickTrack(null, tracks)?.id).toBe('a');
    expect(pickTrack('gone', tracks)?.id).toBe('a');
  });

  it('is null with no tracks', () => {
    expect(pickTrack(null, [])).toBeNull();
  });
});

describe('nextTrack', () => {
  it('moves to the next track in the same category and wraps', () => {
    expect(nextTrack('a', tracks)?.id).toBe('b');
    expect(nextTrack('b', tracks)?.id).toBe('a');
  });

  it('stays on a track that is alone in its category', () => {
    expect(nextTrack('c', tracks)?.id).toBe('c');
  });
});

describe('DEFAULT_TRACKS', () => {
  it('has unique ids, lowercase names and tracks in every category', () => {
    const ids = DEFAULT_TRACKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of DEFAULT_TRACKS) {
      expect(t.id).toMatch(/^[a-z0-9-]+$/);
      expect(t.name).toBe(t.name.toLowerCase());
    }
    for (const c of BG_CATEGORIES) {
      if (c !== 'mine') expect(tracksIn(c, DEFAULT_TRACKS).length).toBeGreaterThan(1);
    }
    expect(tracksIn('mine', DEFAULT_TRACKS)).toEqual([]);
  });

  it('maps an id to its Storage path', () => {
    expect(trackPath('solas')).toBe('defaults/bgm/solas.mp3');
    expect(DEFAULT_TRACKS[0].path).toBe(trackPath(DEFAULT_TRACKS[0].id));
  });
});
