'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { clearMissFirestore, listLessonsFirestore, listMissesFirestore } from '@/lib/db';
import { topMisses, type MissRow } from '@/lib/dictation-misses';
import { buildItemSearchString } from '@/lib/item-url';
import { normalizeDictationTarget } from '@/lib/utils';

const LIST_SIZE = 30;

type LessonMedia = { name: string; url: string | null; youtube: boolean };

/** Sentences written wrong most often, in every lesson. Tap one to hear it and write it again. */
export function MistakesView() {
  const [rows, setRows] = useState<MissRow[] | null>(null);
  const [media, setMedia] = useState<Map<string, LessonMedia>>(new Map());
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listMissesFirestore(), listLessonsFirestore()])
      .then(([docs, lessons]) => {
        if (!alive) return;
        const live = lessons.filter((l) => !l.isTrashed);
        setMedia(
          new Map(live.map((l) => [l.id, { name: l.name, url: l.mediaUrl ?? null, youtube: l.source === 'youtube' }])),
        );
        setRows(topMisses(docs, new Set(live.map((l) => l.id)), LIST_SIZE));
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  if (rows === null) return <p className="breathe text-sm text-gray-500">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-gray-400">No mistakes yet. They show up after Dictation.</p>;

  const key = (r: MissRow) => `${r.lessonId}:${r.sentenceId}`;
  return (
    <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">
      {rows.map((r) => (
        <li key={key(r)}>
          {open === key(r) ? (
            <Practice
              row={r}
              lesson={media.get(r.lessonId)}
              onClose={() => setOpen(null)}
              onRight={() => {
                void clearMissFirestore(r.lessonId, r.sentenceId).catch(() => {});
                setRows((prev) => (prev ?? []).filter((x) => key(x) !== key(r)));
                setOpen(null);
              }}
            />
          ) : (
            <button type="button" onClick={() => setOpen(key(r))} className="flex w-full items-baseline gap-3 px-4 py-3 text-left hover:bg-gray-800/60">
              <span className="min-w-0 flex-1 truncate text-sm text-gray-100">{media.get(r.lessonId)?.name ?? r.lessonName}</span>
              <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                {r.n} {r.n === 1 ? 'miss' : 'misses'}
              </span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Practice({ row, lesson, onClose, onRight }: { row: MissRow; lesson: LessonMedia | undefined; onClose: () => void; onRight: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'wrong' | 'shown'>('idle');

  const play = () => {
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
          close
        </button>
      </div>
      {lesson?.url && !lesson.youtube ? (
        <>
          <audio ref={audioRef} src={lesson.url} preload="auto" onLoadedMetadata={play} />
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
          YouTube lessons play in the lesson.{' '}
          <Link href={lessonHref} className="text-gray-100 hover:text-white">
            Open it
          </Link>{' '}
          and use Dictation.
        </p>
      )}
    </div>
  );
}
