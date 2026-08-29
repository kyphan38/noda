'use client';

import { useCallback, useRef, useState } from 'react';
import { getShadowingAnalysisFirestore } from '@/lib/db';
import { requestShadowingAnalysis } from '@/lib/shadowingAnalysis';
import { resolveShadowingErrorMessage, type ShadowingPatternStatus } from './useShadowingPatternAnalysis';
import type { ShadowingPatternAnalysis } from '@/types';

export interface ShadowingEntry {
  status: ShadowingPatternStatus;
  analysis: ShadowingPatternAnalysis | null;
  error: string | null;
}

const IDLE_ENTRY: ShadowingEntry = { status: 'idle', analysis: null, error: null };

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
 */
export function useShadowingPatternManager(
  lessonId: string | null,
  mediaStoragePath: string | null
): UseShadowingPatternManagerResult {
  const [entries, setEntries] = useState<Record<number, ShadowingEntry>>({});
  const [activeSentenceId, setActiveSentenceId] = useState<number | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [confirmingSentenceId, setConfirmingSentenceId] = useState<number | null>(null);
  const loadingIdsRef = useRef<Set<number>>(new Set());

  const getEntry = useCallback(
    (sentenceId: number) => entries[sentenceId] ?? IDLE_ENTRY,
    [entries]
  );

  const setEntry = useCallback((sentenceId: number, entry: ShadowingEntry) => {
    setEntries((prev) => ({ ...prev, [sentenceId]: entry }));
  }, []);

  const close = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const cancelConfirm = useCallback(() => {
    setConfirmingSentenceId(null);
  }, []);

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
          setEntry(sentence.id, { status: 'ready', analysis: result.analysis, error: null });
        } catch (e) {
          console.error('Shadowing pattern analysis failed:', e);
          setEntry(sentence.id, { status: 'error', analysis: null, error: resolveShadowingErrorMessage(e) });
        } finally {
          loadingIdsRef.current.delete(sentence.id);
        }
      })();
    },
    [lessonId, mediaStoragePath, setEntry]
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
        return;
      }

      if (loadingIdsRef.current.has(sentence.id)) return;
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
          if (cached) {
            setEntry(sentence.id, { status: 'ready', analysis: cached.analysis, error: null });
            setActiveSentenceId(sentence.id);
            setIsPanelOpen(true);
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
    [activeSentenceId, isPanelOpen, entries, lessonId, mediaStoragePath, close, setEntry]
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
