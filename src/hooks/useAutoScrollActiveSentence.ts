import { useEffect, useRef, type MutableRefObject } from 'react';
import { findActiveTranscriptIndex, scrollTranscriptRowIntoView } from '@/lib/transcript-scroll';
import type { Sentence } from '@/types';

/**
 * Smooth-scrolls the transcript container so the active sentence stays in view during playback.
 * Uses binary search and only scrolls when the active sentence actually changes.
 */
export function useAutoScrollActiveSentence(
  currentTime: number,
  transcript: Sentence[],
  scrollContainerRef: MutableRefObject<HTMLDivElement | null>,
  lastScrolledIndexRef: MutableRefObject<number>
) {
  const prevActiveIndexRef = useRef(-1);

  useEffect(() => {
    let activeIndex = findActiveTranscriptIndex(currentTime, transcript);

    // Prefer scanning forward from last known index when still inside that sentence.
    if (prevActiveIndexRef.current >= 0) {
      const s = transcript[prevActiveIndexRef.current];
      if (s && currentTime >= s.start && currentTime < s.end) {
        activeIndex = prevActiveIndexRef.current;
      }
    }

    prevActiveIndexRef.current = activeIndex;

    if (activeIndex !== -1 && activeIndex !== lastScrolledIndexRef.current && scrollContainerRef.current) {
      if (scrollTranscriptRowIntoView(scrollContainerRef.current, activeIndex, 'smooth')) {
        lastScrolledIndexRef.current = activeIndex;
      }
    }
  }, [currentTime, transcript, scrollContainerRef, lastScrolledIndexRef]);
}
