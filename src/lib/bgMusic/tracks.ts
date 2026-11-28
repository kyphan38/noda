// Background music tracks. Default files are in Storage defaults/bgm/<id>.mp3
// (scripts/upload-bgm.sh), all at the same loudness. Own tracks ("mine") live in
// users/{uid}/bgm/ and carry a gain measured at upload.

export type BgCategory = 'piano' | 'cinematic' | 'chill' | 'mine';

export const BG_CATEGORIES: readonly BgCategory[] = ['piano', 'cinematic', 'chill', 'mine'];

export type BgTrack = {
  id: string;
  name: string;
  category: BgCategory;
  /** Storage path of the file. */
  path: string;
  /** Playback gain so the track is as loud as the others. 1 for defaults. */
  gain: number;
};

export function trackPath(id: string): string {
  return `defaults/bgm/${id}.mp3`;
}

const def = (id: string, name: string, category: BgCategory): BgTrack => ({ id, name, category, path: trackPath(id), gain: 1 });

export const DEFAULT_TRACKS: readonly BgTrack[] = [
  def('solas', 'solas', 'piano'),
  def('track-in-time', 'track in time', 'piano'),
  def('gifts', 'gifts', 'piano'),
  def('library-poets', 'library poets', 'piano'),
  def('interstellar', 'interstellar', 'piano'),
  def('scent', 'scent', 'piano'),
  def('waterfall', 'waterfall', 'piano'),
  def('pluto', 'pluto', 'piano'),
  def('stay', 'stay', 'cinematic'),
  def('daylight', 'daylight', 'cinematic'),
  def('minari', 'minari', 'cinematic'),
  def('sojourn', 'sojourn', 'cinematic'),
  def('bipolar', 'bipolar', 'chill'),
  def('green-to-blue', 'green to blue', 'chill'),
  def('lights-are-on', 'lights are on', 'chill'),
  def('champs', 'champs', 'chill'),
  def('ceo-mindset', 'ceo mindset', 'chill'),
];

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
