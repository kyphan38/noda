import { describe, it, expect } from 'vitest';
import { shouldRepeatSentenceAtEnd } from '../../../lib/repeat-count';
import { SENTENCE_PRE_ROLL_SECONDS } from '../../../constants';
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
