// noda - Listen with pauses (N10): how long to stay silent after a sentence. Pure.

/** Extra time on top of the sentence length, to start speaking. */
export const LISTEN_PAUSE_EXTRA_MS = 1_000;
/** A very long cue would leave a long silence; cap it. */
export const LISTEN_PAUSE_MAX_MS = 15_000;

export function listenPauseMs(sentence: { start: number; end: number }): number {
  const length = Math.max(0, (sentence.end - sentence.start) * 1000);
  return Math.min(LISTEN_PAUSE_MAX_MS, Math.round(length) + LISTEN_PAUSE_EXTRA_MS);
}
