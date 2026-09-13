'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getShadowingAnalysisFirestore } from '@/lib/db';
import { requestShadowingAnalysis } from '@/lib/shadowingAnalysis';
import { isRenderableAnalysis } from '@/lib/shadowingChunks';
import { nextSentencesToPrefetch } from '@/lib/shadowingPrefetch';
import { resolveShadowingErrorMessage, type ShadowingPatternStatus } from './useShadowingPatternAnalysis';
import type { Sentence, ShadowingPatternAnalysis } from '@/types';

export interface ShadowingEntry {
  status: ShadowingPatternStatus;
  analysis: ShadowingPatternAnalysis | null;
  error: string | null;
}

const IDLE_ENTRY: ShadowingEntry = { status: 'idle', analysis: null, error: null };

/**
 * Shown when the analysis comes back in a shape this client cannot render, which in
 * practice means the deployed Cloud Function is still on the previous analysis version.
 * Worth naming precisely: this is a single-user app whose owner can fix it by deploying.
 */
const STALE_SERVER_ERROR = 'Server còn bản phân tích cũ - deploy lại Cloud Function rồi thử lại.';

export interface ShadowingSentenceRef {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface UseShadowingPatternManagerResult {
  activeSentenceId: number | null;
  isPanelOpen: boolean;
  confirmingSentenceId: number | null;
  getEntry: (sentenceId: number) => ShadowingEntry;
  handleSparkleClick: (sentence: ShadowingSentenceRef) => void;
  confirmGenerate: (sentence: ShadowingSentenceRef) => void;
  cancelConfirm: () => void;
  close: () => void;
  retry: (sentence: ShadowingSentenceRef) => void;
}

/**
 * Centralized shadowing-pattern analysis state for a lesson's transcript.
 *
 * Only one sentence's analysis panel can be open at a time (Stage 7 redesign - the panel
 * moved out of each transcript row into a shared side panel / bottom sheet), so instead of
 * one `useState` per row, this hook owns a single `Record<sentenceId, entry>` cache plus one
 * "active" id. Switching the active sentence never cancels a previous in-flight fetch - it
 * keeps running in the background and lands in the cache, so reopening an already-viewed
 * sentence later in the same session is instant (no refetch, no loading flicker).
 *
 * Cost guard: tapping the sparkle icon on a sentence that has never been analyzed does NOT
 * immediately call the (paid) Gemini analysis. It first does a cheap, silent Firestore cache
 * peek; a hit opens instantly at $0. A miss surfaces `confirmingSentenceId` so the caller can
 * show a confirmation popover - only `confirmGenerate` actually triggers the Cloud Function.
 *
 * Prefetch: analysis takes 10-20s and almost all of that is Gemini reasoning about the audio,
 * which measurement showed cannot be cut without the answers getting worse. So the wait is
 * hidden rather than shortened - opening one sentence starts `SHADOWING_PREFETCH_COUNT` of the
 * following ones in the background, and by the time the learner moves on they are already
 * cached. Prefetch only ever fires from a deliberate user action, never from another prefetch:
 * cascading would quietly analyze (and bill for) an entire lesson.
 */
export function useShadowingPatternManager(
  lessonId: string | null,
  mediaStoragePath: string | null,
  transcript: Sentence[]
): UseShadowingPatternManagerResult {
  const [entries, setEntries] = useState<Record<number, ShadowingEntry>>({});
  const [activeSentenceId, setActiveSentenceId] = useState<number | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [confirmingSentenceId, setConfirmingSentenceId] = useState<number | null>(null);
  const loadingIdsRef = useRef<Set<number>>(new Set());
  /** Mirrors `entries` so the prefetch path can read current state without being
   *  rebuilt (and re-firing) on every entry update. */
  const entriesRef = useRef<Record<number, ShadowingEntry>>({});
  const transcriptRef = useRef<Sentence[]>(transcript);
  /** Sentences already attempted in the background; a failed prefetch is never retried
   *  on its own, it just falls back to the normal confirm-then-generate flow. */
  const prefetchedIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Entries are keyed by sentence id, and sentence ids restart at 1 in every lesson, so
  // state kept across a lesson switch would show the previous lesson's analysis on a
  // same-numbered sentence. `LessonView` is not remounted per lesson, so clear it here.
  useEffect(() => {
    entriesRef.current = {};
    prefetchedIdsRef.current = new Set();
    setEntries({});
    setActiveSentenceId(null);
    setIsPanelOpen(false);
    setConfirmingSentenceId(null);
  }, [lessonId]);

  const getEntry = useCallback(
    (sentenceId: number) => entries[sentenceId] ?? IDLE_ENTRY,
    [entries]
  );

  const setEntry = useCallback((sentenceId: number, entry: ShadowingEntry) => {
    entriesRef.current = { ...entriesRef.current, [sentenceId]: entry };
    setEntries((prev) => ({ ...prev, [sentenceId]: entry }));
  }, []);

  const close = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const cancelConfirm = useCallback(() => {
    setConfirmingSentenceId(null);
  }, []);

  /**
   * Analyze one sentence quietly. Differs from `runGenerate` in three ways: it peeks the
   * Firestore cache first (so a sentence someone already paid for costs nothing and does
   * not even wake the function), it never opens the panel, and a failure leaves the entry
   * idle instead of surfacing an error - the user did not ask for this one, so a red
   * message about it would be noise. Clicking the sentence then behaves normally.
   */
  const prefetchSentence = useCallback(
    async (sentence: Sentence) => {
      if (!lessonId || !mediaStoragePath) return;
      if (loadingIdsRef.current.has(sentence.id)) return;
      if (entriesRef.current[sentence.id]?.status === 'ready') return;
      if (prefetchedIdsRef.current.has(sentence.id)) return;

      prefetchedIdsRef.current.add(sentence.id);
      loadingIdsRef.current.add(sentence.id);
      // A real 'loading' entry, not a hidden one: it spins that row's sparkle so the work
      // is visible, and it makes a click during the prefetch join the in-flight request
      // instead of starting a second (paid) one.
      setEntry(sentence.id, { status: 'loading', analysis: null, error: null });

      try {
        const cached = await getShadowingAnalysisFirestore(lessonId, sentence.id);
        if (cached && isRenderableAnalysis(cached.analysis)) {
          setEntry(sentence.id, { status: 'ready', analysis: cached.analysis, error: null });
          return;
        }
        const result = await requestShadowingAnalysis(
          lessonId,
          sentence.id,
          sentence.start,
          sentence.end,
          mediaStoragePath,
          sentence.text
        );
        setEntry(
          sentence.id,
          isRenderableAnalysis(result.analysis)
            ? { status: 'ready', analysis: result.analysis, error: null }
            : IDLE_ENTRY
        );
      } catch (e) {
        console.warn('Shadowing prefetch failed (harmless):', e);
        setEntry(sentence.id, IDLE_ENTRY);
      } finally {
        loadingIdsRef.current.delete(sentence.id);
      }
    },
    [lessonId, mediaStoragePath, setEntry]
  );

  /** Start the next `SHADOWING_PREFETCH_COUNT` sentences after `sentenceId`. */
  const prefetchAfter = useCallback(
    (sentenceId: number) => {
      if (!lessonId || !mediaStoragePath) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

      for (const next of nextSentencesToPrefetch(transcriptRef.current, sentenceId)) {
        void prefetchSentence(next);
      }
    },
    [lessonId, mediaStoragePath, prefetchSentence]
  );

  const runGenerate = useCallback(
    (sentence: ShadowingSentenceRef) => {
      if (!lessonId || !mediaStoragePath) {
        setEntry(sentence.id, { status: 'error', analysis: null, error: 'Bài này chưa có audio trên cloud.' });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setEntry(sentence.id, {
          status: 'error',
          analysis: null,
          error: 'Bạn đang offline - cần mạng để phân tích.',
        });
        return;
      }
      if (loadingIdsRef.current.has(sentence.id)) return;
      loadingIdsRef.current.add(sentence.id);
      setEntry(sentence.id, { status: 'loading', analysis: null, error: null });

      (async () => {
        try {
          const result = await requestShadowingAnalysis(
            lessonId,
            sentence.id,
            sentence.start,
            sentence.end,
            mediaStoragePath,
            sentence.text
          );
          if (!isRenderableAnalysis(result.analysis)) {
            console.error('Shadowing analysis has an unrenderable shape:', result.analysis);
            setEntry(sentence.id, { status: 'error', analysis: null, error: STALE_SERVER_ERROR });
            return;
          }
          setEntry(sentence.id, { status: 'ready', analysis: result.analysis, error: null });
          prefetchAfter(sentence.id);
        } catch (e) {
          console.error('Shadowing pattern analysis failed:', e);
          setEntry(sentence.id, { status: 'error', analysis: null, error: resolveShadowingErrorMessage(e) });
        } finally {
          loadingIdsRef.current.delete(sentence.id);
        }
      })();
    },
    [lessonId, mediaStoragePath, prefetchAfter, setEntry]
  );

  const confirmGenerate = useCallback(
    (sentence: ShadowingSentenceRef) => {
      setConfirmingSentenceId(null);
      setActiveSentenceId(sentence.id);
      setIsPanelOpen(true);
      runGenerate(sentence);
    },
    [runGenerate]
  );

  const retry = useCallback(
    (sentence: ShadowingSentenceRef) => {
      runGenerate(sentence);
    },
    [runGenerate]
  );

  const handleSparkleClick = useCallback(
    (sentence: ShadowingSentenceRef) => {
      // Only one confirm popover at a time.
      setConfirmingSentenceId((prev) => (prev !== null && prev !== sentence.id ? null : prev));

      // Toggle off if this sentence's panel is already the one open.
      if (activeSentenceId === sentence.id && isPanelOpen) {
        close();
        return;
      }

      const cachedEntry = entries[sentence.id];
      if (cachedEntry?.status === 'ready') {
        setActiveSentenceId(sentence.id);
        setIsPanelOpen(true);
        prefetchAfter(sentence.id);
        return;
      }

      // Already in flight - usually a prefetch for this very sentence. Show the panel and
      // let the running request land in it rather than ignoring the click.
      if (loadingIdsRef.current.has(sentence.id)) {
        setActiveSentenceId(sentence.id);
        setIsPanelOpen(true);
        return;
      }
      if (!lessonId || !mediaStoragePath) {
        setEntry(sentence.id, { status: 'error', analysis: null, error: 'Bài này chưa có audio trên cloud.' });
        setActiveSentenceId(sentence.id);
        setIsPanelOpen(true);
        return;
      }

      // Silent cache peek - never counts as the costly Gemini call.
      loadingIdsRef.current.add(sentence.id);
      setEntry(sentence.id, { status: 'loading', analysis: null, error: null });

      (async () => {
        try {
          const cached = await getShadowingAnalysisFirestore(lessonId, sentence.id);
          if (cached && isRenderableAnalysis(cached.analysis)) {
            setEntry(sentence.id, { status: 'ready', analysis: cached.analysis, error: null });
            setActiveSentenceId(sentence.id);
            setIsPanelOpen(true);
            prefetchAfter(sentence.id);
          } else {
            setEntry(sentence.id, { status: 'idle', analysis: null, error: null });
            setConfirmingSentenceId(sentence.id);
          }
        } catch (e) {
          console.error('Shadowing pattern cache check failed:', e);
          setEntry(sentence.id, { status: 'idle', analysis: null, error: null });
          setConfirmingSentenceId(sentence.id);
        } finally {
          loadingIdsRef.current.delete(sentence.id);
        }
      })();
    },
    [activeSentenceId, isPanelOpen, entries, lessonId, mediaStoragePath, close, prefetchAfter, setEntry]
  );

  return {
    activeSentenceId,
    isPanelOpen,
    confirmingSentenceId,
    getEntry,
    handleSparkleClick,
    confirmGenerate,
    cancelConfirm,
    close,
    retry,
  };
}
