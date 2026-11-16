import type { Sentence } from '@/types';
import { SPEAKING_SEGMENT_MAX_WORDS, SPEAKING_SEGMENT_MIN_WORDS } from '@/constants';

export interface SpeakingSegment {
  /** `${firstSentenceId}-${lastSentenceId}`: stable while the transcript is unchanged. */
  id: string;
  sentences: Sentence[];
  text: string;
  wordCount: number;
  start: number;
  end: number;
}

/** Longest segment the Cloud Function accepts (MAX_SEGMENT_SECONDS). */
const MAX_SEGMENT_SECONDS = 90;

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Groups the transcript into segments for the speaking check, always cutting at a
 * sentence end. A segment closes once it has `minWords`, or earlier when the next
 * sentence would push it past `maxWords`. One very long sentence stays a segment of
 * its own. A short leftover at the end joins the segment before it when that still
 * fits, so the lesson never ends on a two-word segment.
 */
export function buildSpeakingSegments(
  transcript: Sentence[],
  minWords = SPEAKING_SEGMENT_MIN_WORDS,
  maxWords = SPEAKING_SEGMENT_MAX_WORDS
): SpeakingSegment[] {
  const groups: Sentence[][] = [];
  let current: Sentence[] = [];
  let words = 0;

  for (const s of transcript) {
    const w = countWords(s.text);
    if (w === 0) continue;
    const tooLong =
      current.length > 0 &&
      (words + w > maxWords || s.end - current[0].start > MAX_SEGMENT_SECONDS);
    if (tooLong) {
      groups.push(current);
      current = [];
      words = 0;
    }
    current.push(s);
    words += w;
    if (words >= minWords) {
      groups.push(current);
      current = [];
      words = 0;
    }
  }
  if (current.length > 0) {
    const prev = groups[groups.length - 1];
    const prevWords = prev ? prev.reduce((n, s) => n + countWords(s.text), 0) : 0;
    const fits =
      prev &&
      words < minWords / 2 &&
      prevWords + words <= Math.round(maxWords * 1.3) &&
      current[current.length - 1].end - prev[0].start <= MAX_SEGMENT_SECONDS;
    if (fits) prev.push(...current);
    else groups.push(current);
  }

  return groups.map((sentences) => {
    const text = sentences.map((s) => s.text.trim()).join(' ');
    return {
      id: `${sentences[0].id}-${sentences[sentences.length - 1].id}`,
      sentences,
      text,
      wordCount: countWords(text),
      start: sentences[0].start,
      end: sentences[sentences.length - 1].end,
    };
  });
}
