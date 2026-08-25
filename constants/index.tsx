// Playback speeds
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

// Default values
export const DEFAULT_RECOGNITION_LANG = 'en-US';
export const DEFAULT_LOOP_MODE = 'none' as const;
export const DEFAULT_REPEAT_COUNT = 1 as const;
export const DEFAULT_APP_MODE = 'normal' as const;

// Learning modes
export const LEARNING_MODES = [
  { value: 'normal' as const, label: 'Normal' },
  { value: 'dictation' as const, label: 'Dictation (Type)' },
  { value: 'shadowing' as const, label: 'Shadowing (Speak)' },
  // { value: 'flashcard' as const, label: 'Flashcard' },
] as const;

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
export const PRONUNCIATION_SCORE_THRESHOLD = 80; // Min score to show "Next" button
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

