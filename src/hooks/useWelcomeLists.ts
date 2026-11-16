'use client';

import { useMemo } from 'react';
import type { LessonItem } from '@/types';

type Row = Omit<LessonItem, 'type' | 'language'> & { isTrashed?: boolean };

function pick(ids: string[], rows: Row[]): LessonItem[] {
  return ids
    .map((id) => rows.find((l) => l.id === id))
    .filter((l): l is Row => !!l && !l.isTrashed)
    .map((l) => ({
      id: l.id,
      name: l.name,
      language: 'en',
      dictationProgress: l.dictationProgress,
      shadowingProgress: l.shadowingProgress,
      hasMedia: l.hasMedia,
      mediaType: l.mediaType,
      type: 'lesson',
    }));
}

/** Lesson lists for the welcome screen: the latest opened, and ones to listen to again (N9). */
export function useWelcomeLists(rows: Row[], recentIds: string[], listenAgainIds: string[]) {
  const recentLessons = useMemo(() => pick(recentIds, rows), [recentIds, rows]);
  const listenAgainLessons = useMemo(() => pick(listenAgainIds, rows), [listenAgainIds, rows]);
  return { recentLessons, listenAgainLessons };
}
