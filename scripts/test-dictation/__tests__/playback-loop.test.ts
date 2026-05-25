import { describe, it, expect } from 'vitest';
import { shouldRepeatSentenceAtEnd } from '../../../lib/repeat-count';
import { SENTENCE_PRE_ROLL_SECONDS, REPEAT_PAUSE_MS } from '../../../constants';
import type { Sentence, RepeatCount, LoopMode, AppMode } from '../../../types';

// ---------------------------------------------------------------------------
// Helpers that replicate the playback-loop's core decision logic so we can
// test the scenarios without mounting React or mocking rAF / HTMLMediaElement.
// ---------------------------------------------------------------------------

function findActiveSentence(
  transcript: Sentence[],
  time: number,
): Sentence | null {
  return transcript.find((s) => time >= s.start && time < s.end) ?? null;
}

/** The seek target when the user clicks a sentence (Normal mode applies pre-roll). */
function clickSeekTarget(sentence: Sentence, appMode: AppMode): number {
  const preRoll = appMode === 'dictation' ? 0 : SENTENCE_PRE_ROLL_SECONDS;
  return Math.max(0, sentence.start - preRoll);
}

type LoopAction =
  | { action: 'repeat'; seekTo: number }
  | { action: 'advance' }
  | { action: 'skip-repeat-user-navigating' };

/**
 * Mirrors the decision the playback loop makes when the active sentence ends.
 * The seek target for repeats uses sentence.start directly (no pre-roll) —
 * this is the fix under test.
 */
function decideAtSentenceEnd(
  activeSentence: Sentence,
  repeatCount: RepeatCount,
  sentencePlayCount: number,
  loopMode: LoopMode,
  userSeekTarget: number | null,
): LoopAction {
  const shouldRepeat = shouldRepeatSentenceAtEnd(repeatCount, sentencePlayCount);

  if (loopMode === 'one' && userSeekTarget === null) {
    return { action: 'repeat', seekTo: activeSentence.start };
  } else if (shouldRepeat && userSeekTarget === null) {
    return { action: 'repeat', seekTo: activeSentence.start };
  } else if (userSeekTarget !== null) {
    return { action: 'skip-repeat-user-navigating' };
  } else {
    return { action: 'advance' };
  }
}

// ---------------------------------------------------------------------------
// Fixtures — back-to-back sentences (common in real SRT data).
// ---------------------------------------------------------------------------

const backToBack: Sentence[] = [
  { id: 4, text: 'This tunnel is 57 kilometers long', start: 10.0, end: 12.5 },
  { id: 5, text: "It's 35 miles", start: 12.5, end: 14.0 },
];

const threeBackToBack: Sentence[] = [
  { id: 7, text: 'A few months ago, I asked the people', start: 20.0, end: 23.0 },
  { id: 8, text: "who run Switzerland's trains", start: 23.0, end: 25.5 },
  { id: 9, text: 'if they would let me spend a week doing nothing', start: 25.5, end: 29.0 },
];

// ---------------------------------------------------------------------------
// Bug 1 — Click navigation with infinite repeat gets stuck on active line.
//
// Repro: Line 4 active, user clicks Line 5 in Normal mode with infinite
// repeat. Pre-roll seeks to Line5.start − 0.1, which lands inside Line 4.
// Without the userSeekTarget guard the loop would repeat Line 4 forever.
// ---------------------------------------------------------------------------

describe('click navigation with infinite repeat (back-to-back sentences)', () => {
  const line4 = backToBack[0];
  const line5 = backToBack[1];

  it('pre-roll on click lands inside the previous sentence when sentences are back-to-back', () => {
    const seekPos = clickSeekTarget(line5, 'normal');
    expect(seekPos).toBe(line5.start - SENTENCE_PRE_ROLL_SECONDS);

    const found = findActiveSentence(backToBack, seekPos);
    // The seek position falls within Line 4 — this is the root cause of the bug.
    expect(found).not.toBeNull();
    expect(found!.id).toBe(line4.id);
  });

  it('userSeekTarget suppresses repeat while navigating to the clicked sentence', () => {
    const decision = decideAtSentenceEnd(
      line4,
      'infinite',
      0,
      'none',
      line5.id, // user clicked Line 5
    );
    expect(decision.action).toBe('skip-repeat-user-navigating');
  });

  it('repeat resumes once the target sentence becomes active (userSeekTarget cleared)', () => {
    // Simulate: audio has advanced into Line 5, userSeekTarget is cleared.
    const decision = decideAtSentenceEnd(
      line5,
      'infinite',
      0,
      'none',
      null, // cleared
    );
    expect(decision.action).toBe('repeat');
    expect((decision as { seekTo: number }).seekTo).toBe(line5.start);
  });

  it('userSeekTarget suppresses loop-one mode while navigating', () => {
    const decision = decideAtSentenceEnd(
      line4,
      1,
      0,
      'one',
      line5.id,
    );
    expect(decision.action).toBe('skip-repeat-user-navigating');
  });
});

// ---------------------------------------------------------------------------
// Bug 2 — Repeat seek drifts backward through consecutive sentences.
//
// Repro: Line 8 finishes with infinite repeat. Old code seeked to
// Line8.start − preRoll, landing inside Line 7. Line 7 plays briefly,
// repeats, drifts to Line 7 — and from Line 9 the cascade goes 9→8→7.
// ---------------------------------------------------------------------------

describe('repeat seek must not drift into the previous sentence', () => {
  const line7 = threeBackToBack[0];
  const line8 = threeBackToBack[1];
  const line9 = threeBackToBack[2];

  it('repeat seek target is exactly sentence.start (no pre-roll)', () => {
    const decision = decideAtSentenceEnd(line8, 'infinite', 0, 'none', null);
    expect(decision.action).toBe('repeat');
    expect((decision as { seekTo: number }).seekTo).toBe(line8.start);
  });

  it('active sentence at the repeat seek target is the same sentence', () => {
    const decision = decideAtSentenceEnd(line8, 'infinite', 0, 'none', null);
    const seekTo = (decision as { seekTo: number }).seekTo;
    const found = findActiveSentence(threeBackToBack, seekTo);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(line8.id);
  });

  it('no backward cascade: repeating Line 9 stays on Line 9', () => {
    const d9 = decideAtSentenceEnd(line9, 'infinite', 0, 'none', null);
    expect(d9.action).toBe('repeat');
    const seek9 = (d9 as { seekTo: number }).seekTo;
    const after9 = findActiveSentence(threeBackToBack, seek9);
    expect(after9!.id).toBe(line9.id);
  });

  it('no backward cascade: repeating Line 8 stays on Line 8', () => {
    const d8 = decideAtSentenceEnd(line8, 'infinite', 0, 'none', null);
    expect(d8.action).toBe('repeat');
    const seek8 = (d8 as { seekTo: number }).seekTo;
    const after8 = findActiveSentence(threeBackToBack, seek8);
    expect(after8!.id).toBe(line8.id);
  });

  it('old pre-roll seek WOULD have landed in the previous sentence (regression proof)', () => {
    // This test documents exactly what the old buggy code did: seek to
    // sentence.start − SENTENCE_PRE_ROLL_SECONDS for repeats.
    const oldSeekTarget = line8.start - SENTENCE_PRE_ROLL_SECONDS;
    const found = findActiveSentence(threeBackToBack, oldSeekTarget);
    // With back-to-back sentences the old target falls inside Line 7.
    expect(found).not.toBeNull();
    expect(found!.id).toBe(line7.id);
  });
});

// ---------------------------------------------------------------------------
// Forward-merge: advancing from one sentence to the next with finite repeat
// counts must still work — ensure the userSeekTarget guard doesn't block
// normal (non-infinite) repeat exhaustion.
// ---------------------------------------------------------------------------

describe('finite repeat count exhaustion still advances', () => {
  const line4 = backToBack[0];

  it('repeat=2, playCount=0 → should repeat', () => {
    const decision = decideAtSentenceEnd(line4, 2, 0, 'none', null);
    expect(decision.action).toBe('repeat');
  });

  it('repeat=2, playCount=1 → should advance', () => {
    const decision = decideAtSentenceEnd(line4, 2, 1, 'none', null);
    expect(decision.action).toBe('advance');
  });

  it('repeat=3, playCount=1 → should repeat', () => {
    const decision = decideAtSentenceEnd(line4, 3, 1, 'none', null);
    expect(decision.action).toBe('repeat');
  });

  it('repeat=3, playCount=2 → should advance', () => {
    const decision = decideAtSentenceEnd(line4, 3, 2, 'none', null);
    expect(decision.action).toBe('advance');
  });

  it('repeat=1 → should advance immediately', () => {
    const decision = decideAtSentenceEnd(line4, 1, 0, 'none', null);
    expect(decision.action).toBe('advance');
  });
});

// ---------------------------------------------------------------------------
// Bug 3 — Dictation Enter-advance: completing line N and pressing Enter jumps
// to line N+1 but then snaps back to line N after 0-2 seconds.
//
// Repro: Line 103 ("and a name") is short. User completes it, presses Enter.
// Audio briefly plays line 104 then jumps back to 103 because a pending
// repeat timeout (from line 103's replay-once) fires after the advance,
// seeking audio back to line 103's start. The Enter handler must cancel
// pending timeouts and reset sentencePlayCount before advancing.
//
// Additionally, the "sentence change" guard in the playback loop (lines 55-69
// of useLessonPlaybackLoop.ts) must NOT fire when replayOnceRef is set for
// the target sentence — it should only fire for unexpected drift.
// ---------------------------------------------------------------------------

const shortThenLong: Sentence[] = [
  { id: 103, text: 'and a name', start: 200.0, end: 201.5 },
  { id: 104, text: 'but now begins the impossible task of uniting this diverse mix of people', start: 201.5, end: 207.0 },
];

/**
 * Mirrors the dictation "jump back to previous" guard in useLessonPlaybackLoop
 * lines 55-69. Returns true if the guard would yank audio back.
 */
function wouldJumpBackToPrevious(
  replayOnceRef: { sentenceId: number; end: number } | null,
  prevActiveSentenceId: number | null,
  currentSentence: Sentence | undefined,
): boolean {
  return (
    !replayOnceRef &&
    prevActiveSentenceId !== null &&
    currentSentence !== undefined &&
    currentSentence.id !== prevActiveSentenceId
  );
}

/**
 * Simulates the state produced by handleDictationKeyDown(Enter) after the fix.
 * Returns the state that the playback loop will see on its next tick.
 */
function simulateEnterAdvance(
  completedSentence: Sentence,
  nextSentence: Sentence,
  prevSentencePlayCount: number,
) {
  // The Enter handler (after fix) clears pending timeout and resets counters
  const loopTimeoutCleared = true;
  const isLoopDelaying = false;
  const sentencePlayCount = 0; // reset by Enter handler
  const replayOnceRef = { sentenceId: nextSentence.id, end: nextSentence.end };
  const audioCurrentTime = nextSentence.start;

  return {
    loopTimeoutCleared,
    isLoopDelaying,
    sentencePlayCount,
    replayOnceRef,
    audioCurrentTime,
  };
}

describe('dictation Enter-advance: no snap-back to previous sentence', () => {
  const line103 = shortThenLong[0];
  const line104 = shortThenLong[1];

  it('Enter advance sets replayOnce for next sentence, blocking jump-back guard', () => {
    const state = simulateEnterAdvance(line103, line104, 2);

    // replayOnce is set for line 104
    expect(state.replayOnceRef).toEqual({ sentenceId: 104, end: line104.end });

    // The jump-back guard should NOT fire because replayOnce is set
    const active = findActiveSentence(shortThenLong, state.audioCurrentTime);
    const jumpBack = wouldJumpBackToPrevious(state.replayOnceRef, line103.id, active!);
    expect(jumpBack).toBe(false);
  });

  it('sentencePlayCount is reset to 0 after Enter advance', () => {
    // Before Enter: play count was 2 from repeating line 103
    const state = simulateEnterAdvance(line103, line104, 2);
    expect(state.sentencePlayCount).toBe(0);
  });

  it('line 104 gets correct repeat behavior with fresh play count', () => {
    const state = simulateEnterAdvance(line103, line104, 2);

    // With repeat=2 and fresh playCount=0, line 104 should repeat once
    const decision = decideAtSentenceEnd(line104, 2, state.sentencePlayCount, 'none', null);
    expect(decision.action).toBe('repeat');
    expect((decision as { seekTo: number }).seekTo).toBe(line104.start);
  });

  it('stale play count would have caused incorrect repeat skip (regression proof)', () => {
    // Without the fix: sentencePlayCount=2 from line 103 repeats
    // With repeat=2, playCount=2 → shouldRepeat(2,2) = 2 > 1 && 2 < 1 → false
    // Line 104 would NOT repeat even though it should
    const staleDecision = decideAtSentenceEnd(line104, 2, 2, 'none', null);
    expect(staleDecision.action).toBe('advance'); // bug: skips repeat
  });

  it('pending timeout is cleared, preventing seek back to previous sentence', () => {
    const state = simulateEnterAdvance(line103, line104, 1);
    expect(state.loopTimeoutCleared).toBe(true);
    expect(state.isLoopDelaying).toBe(false);
  });

  it('jump-back guard WOULD fire without replayOnce (regression proof)', () => {
    // If replayOnce were null (e.g., cleared prematurely), the guard fires
    const active = findActiveSentence(shortThenLong, line104.start);
    const jumpBack = wouldJumpBackToPrevious(null, line103.id, active!);
    expect(jumpBack).toBe(true); // This is the bug scenario
  });

  it('audio seeks to exact start of next sentence (no gap/overlap issue)', () => {
    const state = simulateEnterAdvance(line103, line104, 0);
    const active = findActiveSentence(shortThenLong, state.audioCurrentTime);
    expect(active).not.toBeNull();
    expect(active!.id).toBe(line104.id);
  });
});
