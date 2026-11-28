'use client';

import { useMemo, useSyncExternalStore } from 'react';

import { myBgTracksStore } from '@/lib/db';
import { DEFAULT_TRACKS, type BgTrack } from '@/lib/bgMusic/tracks';

/** Default tracks, then the owner's own tracks (category "mine"). */
export function useBgTracks(): readonly BgTrack[] {
  const mine = useSyncExternalStore(myBgTracksStore.subscribe, myBgTracksStore.get, myBgTracksStore.getServer);
  return useMemo(() => (mine.length ? [...DEFAULT_TRACKS, ...mine] : DEFAULT_TRACKS), [mine]);
}
