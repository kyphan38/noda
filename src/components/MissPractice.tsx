'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import type { MissRow } from '@/lib/dictation-misses';
import { YoutubeClip, type ClipHandle } from '@/components/YoutubeClip';
import { buildItemSearchString } from '@/lib/item-url';
import { normalizeDictationTarget } from '@/lib/utils';

export type LessonMedia = { name: string; url: string | null; youtube: boolean; videoId: string | null };

/** A lesson whose lines can play here: an uploaded file, or a YouTube video. */
export const canPlayLines = (l: LessonMedia | undefined) => !!(l && (l.youtube ? l.videoId : l.url));

/** Hear one missed line from its lesson and write it again. Right once and it leaves the list. */
export function MissPractice({
  row,
  lesson,
  onClose,
  onRight,
  closeLabel = 'close',
}: {
  row: MissRow;
  lesson: LessonMedia | undefined;
  onClose: () => void;
  onRight: () => void;
  closeLabel?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const clipRef = useRef<ClipHandle | null>(null);
  const videoId = lesson?.youtube ? lesson.videoId : null;
  const audioUrl = lesson && !lesson.youtube ? lesson.url : null;
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'wrong' | 'shown'>('idle');

  const play = () => {
    if (videoId) return clipRef.current?.play();
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = row.start;
    void a.play().catch(() => {});
  };

  // Stop at the end of the sentence.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      if (a.currentTime >= row.end) a.pause();
    };
    a.addEventListener('timeupdate', onTime);
    return () => a.removeEventListener('timeupdate', onTime);
  }, [row.end]);

  const check = () => {
    const letters = (s: string) => normalizeDictationTarget(s).replace(/ /g, '');
    if (letters(text) === letters(row.text)) onRight();
    else setState('wrong');
  };

  const lessonHref = `/?${buildItemSearchString({ id: row.lessonId, name: lesson?.name ?? row.lessonName })}`;

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate text-sm text-gray-300">{lesson?.name ?? row.lessonName}</span>
        <button type="button" onClick={onClose} className="shrink-0 text-xs text-gray-500 hover:text-gray-100">
          {closeLabel}
        </button>
      </div>
      {videoId || audioUrl ? (
        <>
          {videoId ? (
            <YoutubeClip ref={clipRef} videoId={videoId} start={row.start} end={row.end} />
          ) : (
            <audio ref={audioRef} src={audioUrl ?? undefined} preload="auto" onLoadedMetadata={play} />
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              check();
            }}
            className="space-y-2"
          >
            <input
              autoFocus
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (state === 'wrong') setState('idle');
              }}
              onKeyDown={(e) => {
                // Same key as Dictation: Control plays the line again.
                if (e.key === 'Control') {
                  e.preventDefault();
                  play();
                }
              }}
              placeholder="Type what you hear. Control plays it again."
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 font-mono text-sm text-gray-100 outline-none focus:border-gray-500"
            />
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <button type="submit" className="rounded-lg bg-gray-100 px-3 py-1.5 font-medium text-gray-900 hover:bg-white">
                Check
              </button>
              <button type="button" onClick={play} className="text-gray-400 hover:text-gray-100">
                play again
              </button>
              <button type="button" onClick={() => setState('shown')} className="text-gray-400 hover:text-gray-100">
                show text
              </button>
              {state === 'wrong' && <span className="text-gray-400">Not yet. Try again.</span>}
            </div>
          </form>
          {state === 'shown' && <p className="text-sm text-gray-300">{row.text}</p>}
        </>
      ) : (
        <p className="text-sm text-gray-400">
          This line cannot play here.{' '}
          <Link href={lessonHref} className="text-gray-100 hover:text-white">
            Open it
          </Link>{' '}
          and use Dictation.
        </p>
      )}
    </div>
  );
}
