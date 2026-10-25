'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getShadowingAnalysisFirestore } from '@/lib/db';
import { requestShadowingAnalysis } from '@/lib/shadowingAnalysis';
import { isRenderableAnalysis } from '@/lib/shadowingChunks';
import { readAutoAnalyze, writeAutoAnalyze } from '@/lib/shadowingAutoAnalyze';
import { nextSentencesToPrefetch, sentencesToAutoAnalyze } from '@/lib/shadowingPrefetch';
import { ShadowingRequestTracker } from '@/lib/shadowingRequests';
import { resolveShadowingErrorMessage, type ShadowingPatternStatus } from './useShadowingPatternAnalysis';
import type { Sentence, ShadowingPatternAnalysis } from '@/types';

export interface ShadowingEntry {
  status: ShadowingPatternStatus;
  analysis: ShadowingPatternAnalysis | null;
  error: string | null;
}

const IDLE_ENTRY: ShadowingEntry = { status: 'idle', analysis: null, error: null };

/** Auto-analyze stops after this many failures in a row - usually the network or the
 *  function is down, and going on would just fail (or bill) the next sentences too. */
const AUTO_MAX_FAILURES_IN_A_ROW = 2;

type PrefetchResult = 'ready' | 'failed' | 'skipped';

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
  /** The panel's "Auto" toggle: analyze the current sentence and the next ones without asking. */
  autoAnalyze: boolean;
  /** True when auto-analyze gave up after failures in a row; turning it on again resets it. */
  autoStopped: boolean;
  setAutoAnalyze: (on: boolean) => void;
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
 *
 * Auto-analyze (opt-in toggle, saved per device): while the panel is open, keep a sliding
 * window ready - the sentence the panel is on plus the next `SHADOWING_PREFETCH_COUNT`.
 * The window is worked through one sentence at a time, in order, and it moves only with
 * the panel, so the cost follows what is actually listened to and never runs ahead to the
 * end of the lesson. A sentence that fails is skipped; failures in a row stop it.
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
  const [autoAnalyze, setAutoAnalyzeState] = useState(false);
  const [autoStopped, setAutoStopped] = useState(false);
  /** Mirrors of the state the auto loop reads between awaits. */
  const autoAnalyzeRef = useRef(false);
  const isPanelOpenRef = useRef(false);
  const activeSentenceIdRef = useRef<number | null>(null);
  /** Id of the running auto loop (0 = none); a loop exits as soon as it is no longer current. */
  const autoRunRef = useRef(0);
  const autoRunSeqRef = useRef(0);
  const autoFailuresRef = useRef(0);

  // localStorage is read after mount so the server render and the first client render match.
  useEffect(() => {
    const on = readAutoAnalyze();
    autoAnalyzeRef.current = on;
    setAutoAnalyzeState(on);
  }, []);

  useEffect(() => {
    isPanelOpenRef.current = isPanelOpen;
  }, [isPanelOpen]);

  useEffect(() => {
    activeSentenceIdRef.current = activeSentenceId;
  }, [activeSentenceId]);

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
    autoRunRef.current = 0;
    autoFailuresRef.current = 0;
    setAutoStopped(false);
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
    async (sentence: Sentence): Promise<PrefetchResult> => {
      if (!lessonId || !mediaStoragePath) return 'skipped';
      const requests = requestsRef.current;
      if (requests.isLoading(sentence.id)) return 'skipped';
      if (entriesRef.current[sentence.id]?.status === 'ready') return 'skipped';
      if (prefetchedIdsRef.current.has(sentence.id)) return 'skipped';

      const token = requests.begin(sentence.id);
      if (!token) return 'skipped';
      prefetchedIdsRef.current.add(sentence.id);
      // A real 'loading' entry, not a hidden one: it spins that row's sparkle so the work
      // is visible, and it makes a click during the prefetch join the in-flight request
      // instead of starting a second (paid) one.
      setEntry(sentence.id, { status: 'loading', analysis: null, error: null });

      try {
        const cached = await getShadowingAnalysisFirestore(lessonId, sentence.id);
        if (!requests.isCurrent(token)) return 'skipped';
        if (cached && isRenderableAnalysis(cached.analysis)) {
          setEntry(sentence.id, { status: 'ready', analysis: cached.analysis, error: null });
          return 'ready';
        }
        const result = await requestShadowingAnalysis(
          lessonId,
          sentence.id,
          sentence.start,
          sentence.end,
          mediaStoragePath,
          sentence.text
        );
        if (!requests.isCurrent(token)) return 'skipped';
        if (!isRenderableAnalysis(result.analysis)) {
          setEntry(sentence.id, IDLE_ENTRY);
          return 'failed';
        }
        setEntry(sentence.id, { status: 'ready', analysis: result.analysis, error: null });
        return 'ready';
      } catch (e) {
        console.warn('Shadowing prefetch failed (harmless):', e);
        if (!requests.isCurrent(token)) return 'skipped';
        setEntry(sentence.id, IDLE_ENTRY);
        return 'failed';
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

  /**
   * Work through the auto-analyze window, one sentence at a time. Re-reads the panel's
   * sentence after every step, so the window slides as playback moves. Only one loop runs;
   * calling this while one is running is a no-op (the running loop sees the new state).
   */
  const runAuto = useCallback(async () => {
    if (autoRunRef.current !== 0) return;
    const runId = ++autoRunSeqRef.current;
    autoRunRef.current = runId;
    try {
      while (autoRunRef.current === runId) {
        if (!lessonId || !mediaStoragePath) return;
        if (!autoAnalyzeRef.current || !isPanelOpenRef.current) return;
        const activeId = activeSentenceIdRef.current;
        if (activeId == null) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setAutoStopped(true);
          return;
        }

        const next = sentencesToAutoAnalyze(transcriptRef.current, activeId).find((s) => {
          if (prefetchedIdsRef.current.has(s.id)) return false; // tried already (a failure is skipped)
          if (requestsRef.current.isLoading(s.id)) return false;
          const status = entriesRef.current[s.id]?.status;
          // 'error' is a failed manual analyze: the panel shows Retry, leave it to the user.
          return status !== 'ready' && status !== 'error';
        });
        if (!next) return; // window is full; a new active sentence starts the loop again

        const result = await prefetchSentence(next);
        if (result === 'ready') autoFailuresRef.current = 0;
        if (result === 'failed') {
          autoFailuresRef.current += 1;
          if (autoFailuresRef.current >= AUTO_MAX_FAILURES_IN_A_ROW) {
            setAutoStopped(true);
            return;
          }
        }
        // 'skipped' moves on too: the sentence is now tried or loading, so `find` passes it.
      }
    } finally {
      if (autoRunRef.current === runId) autoRunRef.current = 0;
    }
  }, [lessonId, mediaStoragePath, prefetchSentence]);

  useEffect(() => {
    if (autoAnalyze && !autoStopped && isPanelOpen && activeSentenceId != null) void runAuto();
  }, [autoAnalyze, autoStopped, isPanelOpen, activeSentenceId, runAuto]);

  const setAutoAnalyze = useCallback((on: boolean) => {
    autoAnalyzeRef.current = on;
    autoFailuresRef.current = 0;
    setAutoStopped(false);
    setAutoAnalyzeState(on);
    writeAutoAnalyze(on);
  }, []);

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
          // Auto-analyze already covers the next ones, in order; do not fire them in parallel.
          if (!autoAnalyzeRef.current) prefetchAfter(sentence.id);
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
    autoAnalyze,
    autoStopped,
    setAutoAnalyze,
  };
}
