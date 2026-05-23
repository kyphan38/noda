import type { Sentence } from '@/types';

/**
 * Index of the sentence active at `currentTime`, or the next sentence if in a gap.
 */
export function findActiveTranscriptIndex(currentTime: number, transcript: Sentence[]): number {
  if (transcript.length === 0) return -1;

  for (let i = 0; i < transcript.length; i++) {
    const s = transcript[i];
    if (currentTime >= s.start && currentTime < s.end) return i;
    if (s.start > currentTime) return i;
  }

  return transcript.length - 1;
}

/**
 * Scrolls a transcript row into the vertical center of its scroll container.
 */
export function scrollTranscriptRowIntoView(
  container: HTMLElement,
  rowIndex: number,
  behavior: ScrollBehavior = 'smooth',
): boolean {
  const activeElement = container.querySelector(`[data-index="${rowIndex}"]`);
  if (!activeElement) return false;

  const el = activeElement as HTMLElement;
  const containerRect = container.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const targetScrollTop =
    container.scrollTop +
    (elRect.top - containerRect.top) -
    (container.clientHeight - el.offsetHeight) / 2;
  container.scrollTo({ top: Math.max(0, targetScrollTop), behavior });
  return true;
}

/**
 * Scrolls to the sentence active at `currentTime` and updates lastScrolledIndexRef.
 */
export function scrollActiveTranscriptRow(
  container: HTMLElement | null,
  currentTime: number,
  transcript: Sentence[],
  lastScrolledIndexRef: { current: number },
  behavior: ScrollBehavior = 'smooth',
): boolean {
  const activeIndex = findActiveTranscriptIndex(currentTime, transcript);
  if (activeIndex === -1 || !container) return false;
  const ok = scrollTranscriptRowIntoView(container, activeIndex, behavior);
  if (ok) lastScrolledIndexRef.current = activeIndex;
  return ok;
}

/**
 * Row to show when entering dictation: playback position if that line still needs typing,
 * otherwise the first incomplete sentence (saved progress with audio at 0).
 */
export function findDictationScrollIndex(
  transcript: Sentence[],
  currentTime: number,
  completedSentences: Record<number, boolean>,
): number {
  if (transcript.length === 0) return -1;

  const timeIndex = findActiveTranscriptIndex(currentTime, transcript);
  const firstIncomplete = transcript.findIndex((s) => !completedSentences[s.id]);
  if (firstIncomplete === -1) return timeIndex;

  const timeSentence = transcript[timeIndex];
  if (timeSentence && !completedSentences[timeSentence.id]) return timeIndex;

  return firstIncomplete;
}

export function scrollDictationTargetRow(
  container: HTMLElement | null,
  transcript: Sentence[],
  currentTime: number,
  completedSentences: Record<number, boolean>,
  lastScrolledIndexRef: { current: number },
  behavior: ScrollBehavior = 'smooth',
): { index: number; ok: boolean } {
  const index = findDictationScrollIndex(transcript, currentTime, completedSentences);
  if (index === -1 || !container) return { index: -1, ok: false };
  const ok = scrollTranscriptRowIntoView(container, index, behavior);
  if (ok) lastScrolledIndexRef.current = index;
  return { index, ok };
}
