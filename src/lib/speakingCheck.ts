"use client";

import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/auth/firebase-client';
import { SPEAKING_CHECK_FUNCTION_NAME } from '@/constants';
import type { ShadowingMediaSource } from '@/lib/shadowingAnalysis';
import type { SpeakingSegment } from '@/lib/speakingSegments';
import type { SpeakingAttempt } from '@/types';

/** Keep above `timeoutSeconds` in functions/src/assessSpeaking.ts. */
const SPEAKING_CHECK_CLIENT_TIMEOUT_MS = 190_000;

type SpeakingCheckPayload = {
  lessonId: string;
  segmentId: string;
  sentenceIds: number[];
  startSec: number;
  endSec: number;
  referenceText: string;
  recording: string;
  recordingMimeType: string;
} & ShadowingMediaSource;

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Sends one recorded segment to the `assessSpeaking` Cloud Function; it saves and returns the attempt. */
export async function requestSpeakingCheck(
  lessonId: string,
  segment: SpeakingSegment,
  media: ShadowingMediaSource,
  recording: Blob
): Promise<SpeakingAttempt> {
  const callable = httpsCallable<SpeakingCheckPayload, SpeakingAttempt>(
    getFirebaseFunctions(),
    SPEAKING_CHECK_FUNCTION_NAME,
    { timeout: SPEAKING_CHECK_CLIENT_TIMEOUT_MS }
  );
  const result = await callable({
    lessonId,
    segmentId: segment.id,
    sentenceIds: segment.sentences.map((s) => s.id),
    startSec: segment.start,
    endSec: segment.end,
    referenceText: segment.text,
    recording: await blobToBase64(recording),
    // "audio/webm;codecs=opus" -> "audio/webm": ffmpeg sniffs the codec itself.
    recordingMimeType: (recording.type || 'audio/webm').split(';')[0],
    ...media,
  });
  return result.data;
}
