// Playback speeds
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

// Default values
export const DEFAULT_RECOGNITION_LANG = 'de-DE';
export const DEFAULT_LOOP_MODE = 'none' as const;
export const DEFAULT_APP_MODE = 'normal' as const;

// Sidebar sections
export const SIDEBAR_SECTIONS = ['audio-en', 'audio-de', 'flashcard-en', 'flashcard-de'] as const;
export const SECTION_LABELS: Record<string, string> = {
  'audio-en': 'EN',
  'audio-de': 'DE',
  'flashcard-en': 'EN',
  'flashcard-de': 'DE',
};

// Languages
export const LANGUAGES = [
  { value: 'de-DE', label: 'German (de-DE)' },
  { value: 'en-US', label: 'English (en-US)' },
] as const;

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
export const PRONUNCIATION_SCORE_THRESHOLD = 80; // Min score to show "Next" button

