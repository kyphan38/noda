'use client';

import { useEffect, useState } from 'react';

import { MissPractice, type LessonMedia } from '@/components/MissPractice';

import { clearMissFirestore, listLessonsFirestore, listMissesFirestore } from '@/lib/db';
import { topMisses, type MissRow } from '@/lib/dictation-misses';

const LIST_SIZE = 30;

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
          new Map(live.map((l) => [l.id, { name: l.name, url: l.mediaUrl ?? null, youtube: l.source === 'youtube', videoId: l.youtubeVideoId ?? null }])),
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
            <MissPractice
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
