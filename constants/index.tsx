// Authentication
export const AUTH_USERNAME = process.env.NEXT_PUBLIC_USERNAME || '';
export const AUTH_PASSWORD = process.env.NEXT_PUBLIC_PASSWORD || '';

// Playback speeds
export const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

// Default values
export const DEFAULT_RECOGNITION_LANG = 'de-DE';
export const DEFAULT_LOOP_MODE = 'none' as const;
export const DEFAULT_APP_MODE = 'normal' as const;

// Sidebar sections
export const SIDEBAR_SECTIONS = ['audio-en', 'audio-de', 'flashcard-en', 'flashcard-de', 'trash'] as const;
export const SECTION_LABELS: Record<string, string> = {
  'audio-en': 'English Audio',
  'audio-de': 'German Audio',
  'flashcard-en': 'English Flashcards',
  'flashcard-de': 'German Flashcards',
  'trash': 'Trash & Cache',
};

// Languages
export const LANGUAGES = [
  { value: 'de-DE', label: 'German (de-DE)' },
  { value: 'en-US', label: 'English (en-US)' },
] as const;

// Learning modes
export const LEARNING_MODES = [
  { value: 'normal' as const, label: 'Normal (Listen)' },
  { value: 'dictation' as const, label: 'Dictation (Type)' },
  { value: 'shadowing' as const, label: 'Shadowing (Speak)' },
  // { value: 'flashcard' as const, label: 'Flashcard' },
] as const;

// Loop modes (UI display)
export const LOOP_MODE_LABELS: Record<string, string> = {
  'none': 'Loop',
  'all': 'Loop All',
  'one': 'Loop One',
};

// Timing
export const LOOP_DELAY_MS = 1500; // 1.5 seconds delay on loop one
export const SAVE_PROGRESS_DELAY_MS = 1000; // 1 second debounce for saving
export const PRONUNCIATION_SCORE_THRESHOLD = 80; // Min score to show "Next" button

// Gemini AI
export const GEMINI_MODEL = 'gemini-3-flash-preview';

// Local storage keys
export const STORAGE_AUTH_KEY = 'shadowing_auth';
