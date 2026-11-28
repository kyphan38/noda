'use client';

import { useSyncExternalStore } from 'react';
import { Music } from 'lucide-react';

import { MAX_VOLUME } from '@/lib/bgMusic/gain';
import { bgMusicPrefsStore } from '@/lib/bgMusic/prefs';
import { BG_CATEGORIES, DEFAULT_TRACKS, pickTrack, tracksIn } from '@/lib/bgMusic/tracks';

const word = (on: boolean) => (on ? 'font-medium text-gray-100' : 'text-gray-500 hover:text-gray-100');

/** One row of words, like Theme: the chosen one is bright. */
function Words<T extends string>(props: { label: string; items: readonly { id: T; name: string }[]; value: T | undefined; onPick: (id: T) => void }) {
  return (
    <span role="radiogroup" aria-label={props.label} className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
      {props.items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="radio"
          aria-checked={it.id === props.value}
          onClick={() => props.onPick(it.id)}
          className={word(it.id === props.value)}
        >
          {it.name}
        </button>
      ))}
    </span>
  );
}

const ON_OFF = [
  { id: 'off', name: 'off' },
  { id: 'on', name: 'on' },
] as const;
const CATEGORY_ITEMS = BG_CATEGORIES.map((c) => ({ id: c, name: c }));

/** Settings row: background music on or off, then category, track and volume while on. */
export function BackgroundMusicSettings() {
  const prefs = useSyncExternalStore(bgMusicPrefsStore.subscribe, bgMusicPrefsStore.get, bgMusicPrefsStore.getServer);
  const current = pickTrack(prefs.trackId, DEFAULT_TRACKS);
  const inCategory = current ? tracksIn(current.category, DEFAULT_TRACKS) : [];

  return (
    <div className="px-3 py-2 text-sm text-gray-300">
      <div className="flex items-center gap-2.5">
        <Music size={16} aria-hidden />
        <span className="flex-1">Background music</span>
        <Words
          label="Background music"
          items={ON_OFF}
          value={prefs.enabled ? 'on' : 'off'}
          onPick={(v) => bgMusicPrefsStore.set({ enabled: v === 'on' })}
        />
      </div>
      {prefs.enabled && current && (
        <div className="mt-2 flex flex-col gap-2 pl-[26px]">
          <Words
            label="Category"
            items={CATEGORY_ITEMS}
            value={current.category}
            onPick={(c) => bgMusicPrefsStore.set({ trackId: tracksIn(c, DEFAULT_TRACKS)[0]?.id ?? null })}
          />
          <Words label="Track" items={inCategory} value={current.id} onPick={(id) => bgMusicPrefsStore.set({ trackId: id })} />
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
