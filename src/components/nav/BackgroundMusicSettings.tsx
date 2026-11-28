'use client';

import { useState, useSyncExternalStore } from 'react';
import { Music } from 'lucide-react';

import { BgMyTracks } from '@/components/nav/BgMyTracks';
import { BgWords } from '@/components/nav/BgWords';
import { useBgTracks } from '@/hooks/useBgTracks';
import { MAX_VOLUME } from '@/lib/bgMusic/gain';
import { bgMusicPrefsStore } from '@/lib/bgMusic/prefs';
import { BG_CATEGORIES, pickTrack, tracksIn, type BgCategory } from '@/lib/bgMusic/tracks';

const ON_OFF = [
  { id: 'off', name: 'off' },
  { id: 'on', name: 'on' },
] as const;
const CATEGORY_ITEMS = BG_CATEGORIES.map((c) => ({ id: c, name: c }));

/** Settings row: background music on or off, then group, track and volume while on. */
export function BackgroundMusicSettings() {
  const prefs = useSyncExternalStore(bgMusicPrefsStore.subscribe, bgMusicPrefsStore.get, bgMusicPrefsStore.getServer);
  const tracks = useBgTracks();
  const current = pickTrack(prefs.trackId, tracks);
  // The group shown can differ from the playing one: "mine" may still be empty.
  const [shown, setShown] = useState<BgCategory | null>(null);
  const category = shown ?? current?.category ?? 'piano';
  const inCategory = tracksIn(category, tracks);
  const pickTrackId = (id: string) => bgMusicPrefsStore.set({ trackId: id });

  return (
    <div className="px-3 py-2 text-sm text-gray-300">
      <div className="flex items-center gap-2.5">
        <Music size={16} aria-hidden />
        <span className="flex-1">Background music</span>
        <BgWords
          label="Background music"
          items={ON_OFF}
          value={prefs.enabled ? 'on' : 'off'}
          onPick={(v) => bgMusicPrefsStore.set({ enabled: v === 'on' })}
        />
      </div>
      {prefs.enabled && (
        <div className="mt-2 flex flex-col gap-2 pl-[26px]">
          <BgWords
            label="Group"
            items={CATEGORY_ITEMS}
            value={category}
            onPick={(c) => {
              setShown(c);
              const first = tracksIn(c, tracks)[0];
              if (first) pickTrackId(first.id);
            }}
          />
          {category === 'mine' ? (
            <BgMyTracks
              tracks={inCategory}
              value={current?.category === 'mine' ? current.id : undefined}
              onPick={pickTrackId}
              onDeleted={() => bgMusicPrefsStore.set({ trackId: null })}
            />
          ) : (
            <BgWords label="Track" items={inCategory} value={current?.id} onPick={pickTrackId} />
          )}
          <input
            type="range"
            min={0}
            max={MAX_VOLUME}
            step={1}
            value={prefs.volume}
            onChange={(e) => bgMusicPrefsStore.set({ volume: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-gray-300"
            aria-label="Music volume"
          />
        </div>
      )}
    </div>
  );
}
