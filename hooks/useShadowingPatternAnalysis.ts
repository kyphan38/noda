'use client';

import { useCallback, useRef, useState } from 'react';
import { getShadowingAnalysisFirestore } from '@/lib/db';
import { requestShadowingAnalysis } from '@/lib/shadowingAnalysis';
import type { ShadowingPatternAnalysis } from '@/types';

export type ShadowingPatternStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface UseShadowingPatternAnalysisResult {
  status: ShadowingPatternStatus;
  analysis: ShadowingPatternAnalysis | null;
  error: string | null;
  /** Checks the Firestore cache first; only calls the Cloud Function on a miss. No-op while loading. */
  trigger: () => void;
}

/**
 * Per-sentence state machine for the shadowing-pattern explanation feature
 * (see /Users/kyphan/.claude/plans/ok-v-y-b-y-gi-delegated-garden.md, Stage 5).
 * One instance per rendered sentence row, so state (idle/loading/ready/error) stays
 * independent per sentence — clicking a different sentence's icon does not affect this one.
 */
export function useShadowingPatternAnalysis(
  lessonId: string | null,
  sentenceId: number,
  startSec: number,
  endSec: number,
  mediaStoragePath: string | null,
  sourceText: string
): UseShadowingPatternAnalysisResult {
  const [status, setStatus] = useState<ShadowingPatternStatus>('idle');
  const [analysis, setAnalysis] = useState<ShadowingPatternAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const trigger = useCallback(() => {
    if (loadingRef.current) return;
    if (!lessonId || !mediaStoragePath) {
      setStatus('error');
      setError('Bài này chưa có audio trên cloud.');
      return;
    }

    loadingRef.current = true;
    setStatus('loading');
    setError(null);

    (async () => {
      try {
        const cached = await getShadowingAnalysisFirestore(lessonId, sentenceId);
        if (cached) {
          setAnalysis(cached.analysis);
          setStatus('ready');
          return;
        }
        const result = await requestShadowingAnalysis(
          lessonId,
          sentenceId,
          startSec,
          endSec,
          mediaStoragePath,
          sourceText
        );
        setAnalysis(result.analysis);
        setStatus('ready');
      } catch (e) {
        console.error('Shadowing pattern analysis failed:', e);
        setError(e instanceof Error ? e.message : 'Không phân tích được câu này.');
        setStatus('error');
      } finally {
        loadingRef.current = false;
      }
    })();
  }, [lessonId, sentenceId, startSec, endSec, mediaStoragePath, sourceText]);

  return { status, analysis, error, trigger };
}
