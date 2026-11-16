import type { Sentence } from '@/types';
import { SEEK_SETTLE_TOLERANCE_S } from '@/constants';

/**
 * "Sticky target" for a deliberate jump to a sentence (click, Enter, Control replay).
 *
 * Seeking is never frame-exact, and YouTube or streamed media can land a bit early.
 * When the target sits right after another sentence, an early landing falls inside
 * the PREVIOUS sentence (or the gap before the target). The boundary scan would then
 * pick the previous sentence: the highlight jumps back, and in shadowing or dictation
 * the loop pauses at once because it thinks that sentence just ended.
 *
 * While a target is pending and `time` is within the settle window before its start,
 * report the target's start instead. Only the value the loop reads changes; the media
 * element is not touched, so playback simply runs on into the target. Outside the
 * window (a seek that failed or went elsewhere) `time` is returned unchanged.
 */
export function settleTimeTowardTarget(
  transcript: Sentence[],
  time: number,
  targetId: number | null
): number {
  if (targetId === null) return time;
  const target = transcript.find((s) => s.id === targetId);
  if (!target) return time;
  if (time < target.start && time >= target.start - SEEK_SETTLE_TOLERANCE_S) {
    return target.start;
  }
  return time;
}
