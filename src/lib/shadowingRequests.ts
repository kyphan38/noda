/**
 * Tracks in-flight shadowing analysis requests for the lesson that is open now.
 *
 * Sentence ids restart at 1 in every lesson, so a request started in lesson A
 * for sentence 3 must never land in lesson B's sentence 3, and must not make
 * lesson B's sentence 3 look "already loading". `reset()` on lesson switch
 * starts a new generation with a fresh in-flight set; tokens from the old
 * generation then report `isCurrent() === false` and their `end()` only touches
 * the old set.
 *
 * Plain class instead of hook state so the race can be unit-tested without React.
 */
export interface ShadowingRequestToken {
  readonly sentenceId: number;
  readonly generation: number;
  readonly inFlight: Set<number>;
}

export class ShadowingRequestTracker {
  private generation = 0;
  private inFlight = new Set<number>();

  /** Call when the open lesson changes. */
  reset(): void {
    this.generation += 1;
    this.inFlight = new Set();
  }

  isLoading(sentenceId: number): boolean {
    return this.inFlight.has(sentenceId);
  }

  /** Marks the sentence as loading. Returns null if a request for it is already running. */
  begin(sentenceId: number): ShadowingRequestToken | null {
    if (this.inFlight.has(sentenceId)) return null;
    this.inFlight.add(sentenceId);
    return { sentenceId, generation: this.generation, inFlight: this.inFlight };
  }

  /** A token for a read-only lookup: lets the caller drop a late result after a lesson
   *  switch, without marking the sentence in flight (so `begin` is still free). */
  watch(sentenceId: number): ShadowingRequestToken {
    return { sentenceId, generation: this.generation, inFlight: new Set() };
  }

  /** False once the lesson has changed since `begin`; the result must then be dropped. */
  isCurrent(token: ShadowingRequestToken): boolean {
    return token.generation === this.generation;
  }

  end(token: ShadowingRequestToken): void {
    token.inFlight.delete(token.sentenceId);
  }
}
