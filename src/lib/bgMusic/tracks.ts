// Background music tracks. Files are in Storage defaults/bgm/<id>.mp3
// (scripts/upload-bgm.sh), all at the same loudness.

export type BgCategory = 'piano' | 'cinematic' | 'chill';

export const BG_CATEGORIES: readonly BgCategory[] = ['piano', 'cinematic', 'chill'];

export type BgTrack = { id: string; name: string; category: BgCategory };

export const DEFAULT_TRACKS: readonly BgTrack[] = [
  { id: 'solas', name: 'solas', category: 'piano' },
  { id: 'track-in-time', name: 'track in time', category: 'piano' },
  { id: 'gifts', name: 'gifts', category: 'piano' },
  { id: 'library-poets', name: 'library poets', category: 'piano' },
  { id: 'interstellar', name: 'interstellar', category: 'piano' },
  { id: 'scent', name: 'scent', category: 'piano' },
  { id: 'waterfall', name: 'waterfall', category: 'piano' },
  { id: 'pluto', name: 'pluto', category: 'piano' },
  { id: 'stay', name: 'stay', category: 'cinematic' },
  { id: 'daylight', name: 'daylight', category: 'cinematic' },
  { id: 'minari', name: 'minari', category: 'cinematic' },
  { id: 'sojourn', name: 'sojourn', category: 'cinematic' },
  { id: 'bipolar', name: 'bipolar', category: 'chill' },
  { id: 'green-to-blue', name: 'green to blue', category: 'chill' },
  { id: 'lights-are-on', name: 'lights are on', category: 'chill' },
  { id: 'champs', name: 'champs', category: 'chill' },
  { id: 'ceo-mindset', name: 'ceo mindset', category: 'chill' },
];

export function trackPath(id: string): string {
  return `defaults/bgm/${id}.mp3`;
}

/** The chosen track, or the first track when the choice is gone. Null with no tracks. */
export function pickTrack(trackId: string | null, tracks: readonly BgTrack[]): BgTrack | null {
  return (trackId ? tracks.find((t) => t.id === trackId) : undefined) ?? tracks[0] ?? null;
}

export function tracksIn(category: BgCategory, tracks: readonly BgTrack[]): BgTrack[] {
  return tracks.filter((t) => t.category === category);
}

/** The track after `id` in its category, back to the first after the last. */
export function nextTrack(id: string, tracks: readonly BgTrack[]): BgTrack | null {
  const current = tracks.find((t) => t.id === id);
  if (!current) return pickTrack(null, tracks);
  const list = tracksIn(current.category, tracks);
  return list[(list.indexOf(current) + 1) % list.length];
}
