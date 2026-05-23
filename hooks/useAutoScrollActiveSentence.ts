import { useEffect, useRef, type MutableRefObject } from 'react';
import { scrollTranscriptRowIntoView } from '@/lib/transcript-scroll';
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
    let activeIndex = -1;
    for (let i = prevActiveIndexRef.current >= 0 ? prevActiveIndexRef.current : 0; i < transcript.length; i++) {
      const s = transcript[i];
      if (currentTime >= s.start && currentTime < s.end) {
        activeIndex = i;
        break;
      }
      if (s.start > currentTime) break;
    }
    if (activeIndex === -1 && prevActiveIndexRef.current > 0) {
      for (let i = prevActiveIndexRef.current - 1; i >= 0; i--) {
        const s = transcript[i];
        if (currentTime >= s.start && currentTime < s.end) {
          activeIndex = i;
          break;
        }
        if (s.end <= currentTime) break;
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
