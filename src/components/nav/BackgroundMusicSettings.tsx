'use client';

import { useSyncExternalStore } from 'react';
import { Music } from 'lucide-react';

import { MAX_VOLUME } from '@/lib/bgMusic/gain';
import { bgMusicPrefsStore } from '@/lib/bgMusic/prefs';
import { DEFAULT_TRACKS } from '@/lib/bgMusic/tracks';

const word = (on: boolean) => (on ? 'font-medium text-gray-100' : 'text-gray-500 hover:text-gray-100');

/** Settings row: background music on or off, then track and volume while on. */
export function BackgroundMusicSettings() {
  const prefs = useSyncExternalStore(bgMusicPrefsStore.subscribe, bgMusicPrefsStore.get, bgMusicPrefsStore.getServer);
  const tracks = DEFAULT_TRACKS;
  const currentId = (tracks.find((t) => t.id === prefs.trackId) ?? tracks[0])?.id;

  return (
    <div className="px-3 py-2 text-sm text-gray-300">
      <div className="flex items-center gap-2.5">
        <Music size={16} aria-hidden />
        <span className="flex-1">Background music</span>
        <span role="radiogroup" aria-label="Background music" className="flex gap-1.5 text-xs">
          {([false, true] as const).map((on, i) => (
            <span key={String(on)} className="flex gap-1.5">
              {i > 0 && <span className="text-gray-600" aria-hidden>·</span>}
              <button
                type="button"
                role="radio"
                aria-checked={prefs.enabled === on}
                onClick={() => bgMusicPrefsStore.set({ enabled: on })}
                className={word(prefs.enabled === on)}
              >
                {on ? 'on' : 'off'}
              </button>
            </span>
          ))}
        </span>
      </div>
      {prefs.enabled && (
        <div className="mt-2 flex flex-col gap-2 pl-[26px]">
          {tracks.length === 0 && <p className="text-xs text-gray-500">No tracks yet</p>}
          {tracks.length > 1 && (
            <span role="radiogroup" aria-label="Track" className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
              {tracks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={t.id === currentId}
                  onClick={() => bgMusicPrefsStore.set({ trackId: t.id })}
                  className={word(t.id === currentId)}
                >
                  {t.name}
                </button>
              ))}
            </span>
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
