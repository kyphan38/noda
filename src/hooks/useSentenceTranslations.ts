'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { listLessonTranslations, translateSentences } from '@/lib/db';
import {
  canTranslate,
  resolveTargetIndex,
  pickTranslateBatch,
  translationLines,
  usableTranslations,
  type TranslationLine,
} from '@/lib/translate';
import type { AppMode, CompletedSentences, Sentence } from '@/types';

/** The player's VI button: translates the sentence just heard into Vietnamese. */
export interface PlayerViButton {
  onClick: () => void;
  /** This sentence's translation is shown. */
  active: boolean;
  loading: boolean;
  disabled: boolean;
}

type Options = {
  lessonId: string | null;
  title: string;
  transcript: Sentence[];
  mode: AppMode;
  focusActive: boolean;
  currentTime: number;
  /** Dictation: lines typed correctly. */
  completedSentences: CompletedSentences;
};

/** Translations kept for the visit per lesson, so switching tabs (which remounts the view) does not reread them. */
const knownByLesson = new Map<string, Map<number, string>>();
const loadedLessons = new Set<string>();

const NO_LINES: ReadonlyMap<number, TranslationLine> = new Map();

/**
 * Sentence translation in a lesson: the VI button and "T" key translate the sentence just heard.
 * One model call covers it and the next untranslated sentences, but only the asked one is shown.
 */
export function useSentenceTranslations({
  lessonId,
  title,
  transcript,
  mode,
  focusActive,
  currentTime,
  completedSentences,
}: Options) {
  const [known, setKnown] = useState<ReadonlyMap<number, string>>(() =>
    lessonId ? new Map(knownByLesson.get(lessonId)) : new Map()
  );
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const [errors, setErrors] = useState<ReadonlyMap<number, string>>(new Map());
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set());

  const remember = useCallback(
    (items: Iterable<[number, string]>) => {
      if (!lessonId) return;
      const store = knownByLesson.get(lessonId) ?? new Map<number, string>();
      for (const [id, vi] of items) store.set(id, vi);
      knownByLesson.set(lessonId, store);
      setKnown(new Map(store));
    },
    [lessonId]
  );

  // Saved translations of this lesson, read once per visit.
  useEffect(() => {
    if (!lessonId || loadedLessons.has(lessonId) || transcript.length === 0) return;
    let alive = true;
    listLessonTranslations(lessonId)
      .then((docs) => {
        loadedLessons.add(lessonId);
        if (alive) remember(usableTranslations(docs, transcript));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lessonId, transcript, remember]);

  // The last sentence really played or tapped: at a loop's pause and in a tap's pre-roll the
  // time sits in a gap, where it alone would point at a neighbour.
  const [followedId, setFollowedId] = useState<number | null>(null);
  const playingId = transcript.find((s) => currentTime >= s.start && currentTime < s.end)?.id ?? null;
  const [prevPlayingId, setPrevPlayingId] = useState(playingId);
  if (playingId !== prevPlayingId) {
    setPrevPlayingId(playingId);
    if (playingId != null) setFollowedId(playingId);
  }
  const followSentence = useCallback((id: number) => setFollowedId(id), []);

  const available = !!lessonId && !focusActive && transcript.length > 0;
  const targetIndex = resolveTargetIndex(transcript, currentTime, followedId);
  const target = targetIndex >= 0 ? transcript[targetIndex] : undefined;
  const targetAllowed = !!target && canTranslate(mode, !!completedSentences[target.id]);

  const onViClick = useCallback(() => {
    if (!lessonId || !target || !targetAllowed) return;
    const id = target.id;
    if (open.has(id)) {
      setOpen((o) => new Set([...o].filter((x) => x !== id)));
      return;
    }
    setOpen((o) => new Set(o).add(id));
    setErrors((e) => {
      const next = new Map(e);
      next.delete(id);
      return next;
    });
    const batch = pickTranslateBatch(transcript, targetIndex, new Set(known.keys()), pending);
    if (!batch) return;
    const ids = batch.items.map((i) => i.id);
    setPending((p) => new Set([...p, ...ids]));
    translateSentences({ lessonId, title, ...batch })
      .then((items) => remember(items.map((t) => [t.id, t.vi] as [number, string])))
      .catch((e: { code?: string }) => {
        const message =
          e?.code === 'functions/resource-exhausted'
            ? 'AI credit used up, or the daily limit is reached.'
            : 'Could not translate. Try again.';
        setErrors((prev) => new Map(prev).set(id, message));
      })
      .finally(() => setPending((p) => new Set([...p].filter((x) => !ids.includes(x)))));
  }, [lessonId, title, target, targetAllowed, targetIndex, transcript, open, known, pending, remember]);

  // "T" works like the VI button.
  useEffect(() => {
    if (!available) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyT' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      if (el instanceof HTMLElement && el.isContentEditable) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      e.preventDefault();
      onViClick();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [available, onViClick]);

  const lines = useMemo(
    () => (open.size === 0 ? NO_LINES : translationLines(open, known, errors, mode, completedSentences)),
    [open, known, errors, mode, completedSentences]
  );

  const targetId = target?.id;
  const viButton = useMemo<PlayerViButton | undefined>(
    () =>
      available
        ? {
            onClick: onViClick,
            active: targetId != null && open.has(targetId) && targetAllowed,
            loading: targetId != null && open.has(targetId) && pending.has(targetId),
            disabled: !targetAllowed,
          }
        : undefined,
    [available, onViClick, targetId, open, pending, targetAllowed]
  );

  return { translationLines: lines, viButton, followSentence };
}
