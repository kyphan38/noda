// Background music tracks. The default list is filled in phase B0 (PLAN-bg-music.md),
// once the owner's audio files are on Storage.

export type BgTrack = { id: string; name: string; url: string };

export const DEFAULT_TRACKS: readonly BgTrack[] = [];

/** URL of the chosen track, or the first track when the choice is gone. Null with no tracks. */
export function pickTrackUrl(trackId: string | null, tracks: readonly BgTrack[]): string | null {
  const chosen = trackId ? tracks.find((t) => t.id === trackId) : undefined;
  return (chosen ?? tracks[0])?.url ?? null;
}
