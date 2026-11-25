'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { getLessonMisses, listWordsForSentences } from '@/lib/db';
import { buildLessonNotes, lessonTopicId } from '@/lib/lesson-talk';
import { readTalkLevel } from '@/lib/talk/prefs';
import { getTalkStore } from '@/lib/talk/store';
import type { TalkTopic } from '@/lib/talk/types';
import type { Sentence } from '@/types';

type Lesson = { id: string; name: string };

/** Makes (once) or opens the Talk topic built from this lesson, then goes to Talk. */
export function LessonTalkStart({ lesson, transcript }: { lesson: Lesson; transcript: Sentence[] }) {
  const router = useRouter();
  const topicId = lessonTopicId(lesson.id);
  // undefined while checking whether the topic exists.
  const [topic, setTopic] = useState<TalkTopic | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getTalkStore()
      .getTopic(topicId)
      .catch(() => null)
      .then((t) => alive && setTopic(t));
    return () => {
      alive = false;
    };
  }, [topicId]);

  const open = () => router.push(`/talk/?topic=${encodeURIComponent(topicId)}`);

  const make = async (again: boolean) => {
    if (again && !window.confirm('Make a new talk? The old one and its phrases go away.')) return;
    setBusy(true);
    setError(null);
    try {
      const store = getTalkStore();
      if (again) await store.deleteTopic(topicId);
      // No sign-in (E2E) or a failed read: build from the transcript alone.
      const [doc, words] = await Promise.all([
        getLessonMisses(lesson.id).catch(() => null),
        listWordsForSentences(transcript.map((s) => s.text)).catch(() => []),
      ]);
      const misses = Object.entries(doc?.items ?? {}).map(([id, it]) => ({ sentenceId: Number(id), n: it?.n ?? 0, text: it?.text ?? '' }));
      const { notes, targets } = buildLessonNotes(transcript, misses, words);
      await store.ensureTopic({
        topicId,
        kind: 'custom',
        title: lesson.name.trim().slice(0, 80) || 'Lesson',
        description: '',
        level: readTalkLevel(),
        notes,
        notesKind: 'lesson',
        lessonId: lesson.id,
        targets,
      });
      open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make the talk.');
      setBusy(false);
    }
  };

  if (topic === undefined) return null;
  const primary = 'w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 hover:bg-white disabled:opacity-60';
  const secondary = 'w-full rounded-lg border border-gray-800 py-2 text-sm text-gray-300 hover:bg-gray-100/[0.06] disabled:opacity-60';

  return (
    <div className="space-y-2">
      <p className="text-center text-sm text-gray-400">Talk about this clip, using the lines and words you missed.</p>
      {topic ? (
        <>
          <button type="button" onClick={open} disabled={busy} className={primary}>
            Open the talk
          </button>
          <button type="button" onClick={() => void make(true)} disabled={busy} className={secondary}>
            {busy ? 'Making the talk...' : 'Make a new one'}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => void make(false)} disabled={busy} className={primary}>
          {busy ? 'Making the talk...' : 'Make the talk'}
        </button>
      )}
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
