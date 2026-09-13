import { SHADOWING_PREFETCH_COUNT } from '@/constants';
import type { Sentence } from '@/types';

/**
 * The sentences to analyze in the background after `sentenceId` is opened: the next
 * `count` in transcript order, or fewer near the end of the lesson.
 *
 * Kept as a pure function, apart from the hook, because the interesting part is the
 * boundaries - the last sentence prefetches nothing, an id that is not in this lesson
 * prefetches nothing - and those are worth testing without mounting React or Firebase.
 */
export function nextSentencesToPrefetch(
  transcript: Sentence[],
  sentenceId: number,
  count: number = SHADOWING_PREFETCH_COUNT
): Sentence[] {
  if (count <= 0) return [];
  const index = transcript.findIndex((s) => s.id === sentenceId);
  if (index < 0) return [];
  return transcript.slice(index + 1, index + 1 + count);
}
