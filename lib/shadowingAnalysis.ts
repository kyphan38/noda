"use client";

import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/auth/firebase-client';
import { SHADOWING_ANALYSIS_FUNCTION_NAME } from '@/constants';
import type { ShadowingPatternDoc } from '@/types';

interface RequestShadowingAnalysisPayload {
  lessonId: string;
  sentenceId: number;
  startSec: number;
  endSec: number;
  mediaStoragePath: string;
  sourceText: string;
}

/**
 * Response from the `analyzeShadowingPattern` Cloud Function.
 * - Cache hit: returns the full cached Firestore doc (`createdAt`/`generatedBy` present).
 * - Cache miss: the function writes the cache doc server-side but returns the
 *   just-computed object without `createdAt`/`generatedBy` (those are
 *   server-timestamp sentinels, not safe to serialize back over the callable channel).
 */
export type ShadowingAnalysisResult = Pick<
  ShadowingPatternDoc,
  'sentenceId' | 'startSec' | 'endSec' | 'sourceText' | 'model' | 'analysis'
> &
  Partial<Pick<ShadowingPatternDoc, 'createdAt' | 'generatedBy'>>;

/**
 * Calls the `analyzeShadowingPattern` Cloud Function (cache-first; see
 * /Users/kyphan/.claude/plans/ok-v-y-b-y-gi-delegated-garden.md, Stage 3).
 * Cheap and fast on a cache hit; on a miss it downloads+slices the media and
 * calls Gemini server-side, which can take several seconds.
 */
export async function requestShadowingAnalysis(
  lessonId: string,
  sentenceId: number,
  startSec: number,
  endSec: number,
  mediaStoragePath: string,
  sourceText: string
): Promise<ShadowingAnalysisResult> {
  const callable = httpsCallable<RequestShadowingAnalysisPayload, ShadowingAnalysisResult>(
    getFirebaseFunctions(),
    SHADOWING_ANALYSIS_FUNCTION_NAME
  );
  const result = await callable({ lessonId, sentenceId, startSec, endSec, mediaStoragePath, sourceText });
  return result.data;
}
