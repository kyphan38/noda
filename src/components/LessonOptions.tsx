'use client';

import { useSyncExternalStore } from 'react';
import { BookA, Hourglass, Music } from 'lucide-react';

import { bgMusicPrefsStore } from '@/lib/bgMusic/prefs';
import { currentLessonStore, listenPausesStore, wordCardsOnStore } from '@/lib/lesson-session';
import type { AppMode } from '@/types';

/** Word cards (N3), pauses (N10, Listen on an uploaded file) and background music (every lesson tab). */
export function useLessonOptions(mode: AppMode) {
  const lesson = useSyncExternalStore(currentLessonStore.subscribe, currentLessonStore.get, () => null);
  const pauses = useSyncExternalStore(listenPausesStore.subscribe, listenPausesStore.get, () => false);
  const words = useSyncExternalStore(wordCardsOnStore.subscribe, wordCardsOnStore.get, () => false);
  const music = useSyncExternalStore(bgMusicPrefsStore.subscribe, bgMusicPrefsStore.get, bgMusicPrefsStore.getServer).enabled;
  const showWords = mode !== 'dictation';
  // YouTube lessons keep playing straight through.
  const showPauses = mode === 'listen' && !!lesson && !lesson.youtube;
  return { words, pauses, music, showWords, showPauses, changed: (showWords && words) || (showPauses && pauses) || music };
}

const row =
  'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white';
const icon = 'h-4 w-4 shrink-0';

/** Rows for the player's More menu. */
export function LessonOptionRows({ mode }: { mode: AppMode }) {
  const { words, pauses, music, showWords, showPauses } = useLessonOptions(mode);
  return (
    <div className="border-t border-gray-800 pt-1">
      {showWords && (
        <Switch label="Word meanings" title="Double click a word for its meaning" on={words} onChange={(v) => wordCardsOnStore.set(v)}>
          <BookA className={icon} aria-hidden />
        </Switch>
      )}
      {showPauses && (
        <Switch label="Pauses" title="Silence after each sentence, to say it" on={pauses} onChange={(v) => listenPausesStore.set(v)}>
          <Hourglass className={icon} aria-hidden />
        </Switch>
      )}
      <Switch label="Music" title="Background music behind the lesson" on={music} onChange={(v) => bgMusicPrefsStore.set({ enabled: v })}>
        <Music className={icon} aria-hidden />
      </Switch>
    </div>
  );
}

function Switch(props: { label: string; title: string; on: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={props.on} title={props.title} onClick={() => props.onChange(!props.on)} className={row}>
      {props.children}
      <span className="flex-1">{props.label}</span>
      <span className={`text-xs ${props.on ? 'font-medium text-gray-100' : 'text-gray-500'}`}>{props.on ? 'on' : 'off'}</span>
    </button>
  );
}
