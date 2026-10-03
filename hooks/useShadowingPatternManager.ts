'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getShadowingAnalysisFirestore } from '@/lib/db';
import { requestShadowingAnalysis } from '@/lib/shadowingAnalysis';
import { isRenderableAnalysis } from '@/lib/shadowingChunks';
import { nextSentencesToPrefetch } from '@/lib/shadowingPrefetch';
import { ShadowingRequestTracker } from '@/lib/shadowingRequests';
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
const STALE_SERVER_ERROR = 'The server still has the old analysis version - redeploy the Cloud Function and try again.';

export interface ShadowingSentenceRef {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface UseShadowingPatternManagerResult {
  activeSentenceId: number | null;
  isPanelOpen: boolean;
  getEntry: (sentenceId: number) => ShadowingEntry;
  open: (sentence: ShadowingSentenceRef) => void;
  close: () => void;
  /** Look up the cached analysis for free; with `follow`, also point the panel at it. */
  show: (sentence: ShadowingSentenceRef, options: { follow: boolean }) => void;
  /** Paid Gemini analysis - only from an explicit button press. */
  analyze: (sentence: ShadowingSentenceRef) => void;
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
 * The panel follows the sentence being played (`show` with `follow`). Cost guard: following
 * never calls the (paid) Gemini analysis. It only does a free Firestore cache lookup; a hit
 * shows instantly at $0, a miss leaves the entry `idle` and the panel offers a
 * "Analyze with AI" button. Only that button (`analyze`) triggers the Cloud Function.
 *
 * Prefetch: analysis takes 10-20s and almost all of that is Gemini reasoning about the audio,
 * which measurement showed cannot be cut without the answers getting worse. So the wait is
 * hidden rather than shortened - analyzing one sentence starts `SHADOWING_PREFETCH_COUNT` of the
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
  /** In-flight requests for the open lesson; reset on lesson switch so late results are dropped. */
  const requestsRef = useRef(new ShadowingRequestTracker());
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
    requestsRef.current.reset();
    entriesRef.current = {};
    prefetchedIdsRef.current = new Set();
    setEntries({});
    setActiveSentenceId(null);
    setIsPanelOpen(false);
  }, [lessonId]);

  const getEntry = useCallback(
    (sentenceId: number) => entries[sentenceId] ?? IDLE_ENTRY,
    [entries]
  );

  const setEntry = useCallback((sentenceId: number, entry: ShadowingEntry) => {
    entriesRef.current = { ...entriesRef.current, [sentenceId]: entry };
    setEntries((prev) => ({ ...prev, [sentenceId]: entry }));
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
      const requests = requestsRef.current;
      if (requests.isLoading(sentence.id)) return;
      if (entriesRef.current[sentence.id]?.status === 'ready') return;
      if (prefetchedIdsRef.current.has(sentence.id)) return;

      const token = requests.begin(sentence.id);
      if (!token) return;
      prefetchedIdsRef.current.add(sentence.id);
      // A real 'loading' entry, not a hidden one: it spins that row's sparkle so the work
      // is visible, and it makes a click during the prefetch join the in-flight request
      // instead of starting a second (paid) one.
      setEntry(sentence.id, { status: 'loading', analysis: null, error: null });

      try {
        const cached = await getShadowingAnalysisFirestore(lessonId, sentence.id);
        if (!requests.isCurrent(token)) return;
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
        if (!requests.isCurrent(token)) return;
        setEntry(
          sentence.id,
          isRenderableAnalysis(result.analysis)
            ? { status: 'ready', analysis: result.analysis, error: null }
            : IDLE_ENTRY
        );
      } catch (e) {
        console.warn('Shadowing prefetch failed (harmless):', e);
        if (requests.isCurrent(token)) setEntry(sentence.id, IDLE_ENTRY);
      } finally {
        requests.end(token);
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
        setEntry(sentence.id, { status: 'error', analysis: null, error: 'This lesson has no audio in the cloud yet.' });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setEntry(sentence.id, {
          status: 'error',
          analysis: null,
          error: 'You are offline - analysis needs a connection.',
        });
        return;
      }
      const requests = requestsRef.current;
      const token = requests.begin(sentence.id);
      if (!token) return;
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
          if (!requests.isCurrent(token)) return;
          if (!isRenderableAnalysis(result.analysis)) {
            console.error('Shadowing analysis has an unrenderable shape:', result.analysis);
            setEntry(sentence.id, { status: 'error', analysis: null, error: STALE_SERVER_ERROR });
            return;
          }
          setEntry(sentence.id, { status: 'ready', analysis: result.analysis, error: null });
          prefetchAfter(sentence.id);
        } catch (e) {
          console.error('Shadowing pattern analysis failed:', e);
          if (!requests.isCurrent(token)) return;
          setEntry(sentence.id, { status: 'error', analysis: null, error: resolveShadowingErrorMessage(e) });
        } finally {
          requests.end(token);
        }
      })();
    },
    [lessonId, mediaStoragePath, prefetchAfter, setEntry]
  );

  /** Open the panel on `sentence`. The panel then follows the current sentence via `show`. */
  const open = useCallback((sentence: ShadowingSentenceRef) => {
    setActiveSentenceId(sentence.id);
    setIsPanelOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  /**
   * Point the open panel at `sentence` and look up its cached analysis (free Firestore
   * read, never Gemini). Also used with the panel closed, so the player button can show
   * "already analyzed". A miss leaves the entry `idle`: the panel then offers the
   * "Analyze with AI" button, and only that button spends money.
   *
   * Deliberately no prefetch here. Following the playback through cached sentences must
   * not keep buying the next ones; prefetch only follows an explicit "Analyze with AI".
   */
  const show = useCallback(
    (sentence: ShadowingSentenceRef, { follow }: { follow: boolean }) => {
      if (follow) setActiveSentenceId(sentence.id);
      if (!lessonId) return;
      if (entriesRef.current[sentence.id]) return; // known: checking, loading, ready, idle or error
      const requests = requestsRef.current;
      // `watch`, not `begin`: pressing "Analyze with AI" during the lookup must start its request.
      const token = requests.watch(sentence.id);
      setEntry(sentence.id, { status: 'checking', analysis: null, error: null });
      void getShadowingAnalysisFirestore(lessonId, sentence.id)
        .then((cached) => {
          if (!requests.isCurrent(token)) return;
          if (entriesRef.current[sentence.id]?.status !== 'checking') return;
          setEntry(
            sentence.id,
            cached && isRenderableAnalysis(cached.analysis)
              ? { status: 'ready', analysis: cached.analysis, error: null }
              : IDLE_ENTRY
          );
        })
        .catch((e) => {
          console.warn('Shadowing cache lookup failed (harmless):', e);
          if (!requests.isCurrent(token)) return;
          if (entriesRef.current[sentence.id]?.status === 'checking') setEntry(sentence.id, IDLE_ENTRY);
        });
    },
    [lessonId, setEntry]
  );

  /** The explicit, paid analysis - the panel's "Analyze with AI" and "Retry" buttons. */
  const analyze = useCallback(
    (sentence: ShadowingSentenceRef) => {
      runGenerate(sentence);
    },
    [runGenerate]
  );

  return {
    activeSentenceId,
    isPanelOpen,
    getEntry,
    open,
    close,
    show,
    analyze,
  };
}
