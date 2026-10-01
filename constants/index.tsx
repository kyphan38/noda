// Playback speeds
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

// Default values
export const DEFAULT_LOOP_MODE = 'none' as const;
export const DEFAULT_REPEAT_COUNT = 1 as const;
export const DEFAULT_APP_MODE = 'listen' as const;

// Lesson tabs, in header order (also the Cmd/Ctrl+1..3 shortcut order).
export const LESSON_MODES = [
  { mode: 'listen' as const, label: 'Listen' },
  { mode: 'shadowing' as const, label: 'Shadowing' },
  { mode: 'dictation' as const, label: 'Dictation' },
] as const;

/** Throttle for saving where the learner is (sentence / playback time) to Firestore. */
export const RESUME_SAVE_INTERVAL_MS = 3000;

// Loop modes (UI display)
export const LOOP_MODE_LABELS: Record<string, string> = {
  none: 'Loop',
  one: 'Loop one',
};

// Timing
export const LOOP_DELAY_MS = 1500; // 1.5 seconds delay on loop one
export const SAVE_PROGRESS_DELAY_MS = 1000; // 1 second debounce for saving
/** Debounce Firestore writes while typing in dictation (does not affect live match UI). */
export const DICTATION_SAVE_DEBOUNCE_MS = 200;
export const REPEAT_PAUSE_MS = 750;
export const SENTENCE_PRE_ROLL_SECONDS = 0.1;
/** Dictation seek settle window: tolerate this much undershoot after seeking to a
 *  sentence's start (audio/video seeking is never frame-exact) so the app doesn't
 *  mistakenly treat the tail end of the PREVIOUS sentence as active when two
 *  sentences sit very close together. */
export const SEEK_SETTLE_TOLERANCE_S = 0.35;
/** Max time to trust that a pending user-initiated seek (click / Enter / Control
 *  replay) hasn't landed yet. On network-streamed media (e.g. Firebase Storage),
 *  `currentTime`/`seeking` can lag several animation frames behind a `.currentTime`
 *  assignment. We hold off publishing playback state during that lag so the UI
 *  doesn't flash back to the sentence we just left; this timeout is a safety net
 *  in case the seek never settles (e.g. it was cancelled or the media errored). */
export const SEEK_GUARD_TIMEOUT_MS = 1500;
/** Seconds to skip when pressing the Left/Right arrow keys. Change this number to adjust the skip amount. */
export const ARROW_SKIP_SECONDS = 5;

// Shadowing pattern explanation (Cloud Function name; must match functions/src/index.ts export)
export const SHADOWING_ANALYSIS_FUNCTION_NAME = 'analyzeShadowingPattern';


/** Hard cap on notes the panel renders; the Cloud Function truncates anything longer.
 *  Raised from 4 to 8: at 4 the prompt had to pick "the most important" junctions and
 *  quietly dropped real ones (weak forms like "if you", "you know"), which is exactly the
 *  detail an upper-intermediate learner is looking for. The notes area scrolls, so length
 *  costs nothing as long as the annotated line above stays pinned. */
export const SHADOWING_MAX_NOTES = 8;
/** At most one `rhythm` note - the rest of the list is for audible sound changes. */
export const SHADOWING_MAX_RHYTHM_NOTES = 1;

/**
 * How many following sentences to analyze in the background once the user opens a
 * sentence's panel. Shadowing is practised in order, so the next sentence is nearly
 * always the next thing opened - analyzing it during the ~20s the user spends
 * imitating the current one turns the wait into nothing. Deliberately small: each
 * prefetched sentence is a paid Gemini call for something the user might never open.
 */
export const SHADOWING_PREFETCH_COUNT = 2;
