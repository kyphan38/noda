// Sentence structure for transcript
export type Sentence = {
  id: number;
  text: string;
  start: number;
  end: number;
};

// Learning modes
export type LoopMode = 'none' | 'one';
export type AppMode = 'normal' | 'dictation' | 'shadowing' | 'flashcard';
// Pronunciation result
export type SpokenResult = {
  text: string;
  score: number;
  diff: { word: string; status: string }[];
};

// Recognition error/result state
export type RecognitionState = Record<number, string>;
export type SpokenResults = Record<number, SpokenResult>;
export type DictationInputs = Record<number, string>;
export type CompletedSentences = Record<number, boolean>;

// Lesson summary from DB
export type LessonSummary = {
  id: string;
  type?: 'audio' | 'flashcard';
  name: string;
  language: string;
  progress: number;
  /** Line / sentence count from DB (used for deck card counts in sidebar). */
  totalSentences: number;
  /** Library section: audio lessons vs flashcard decks (independent of whether audio file is present). */
  kind: 'audio' | 'flashcard';
  isTrashed: boolean;
  /** Whether a media blob exists in IndexedDB (audio or video). */
  hasMedia: boolean;
  /** For kind=audio: audio vs video lesson; for flashcard unused (always 'audio'). */
  mediaType: 'audio' | 'video';
  trashedAt?: number;
};

// Lesson detail from DB
export type Lesson = {
  id: string;
  type?: 'audio' | 'flashcard';
  name: string;
  language: string;
  mediaFile?: File;
  mediaType?: 'audio' | 'video';
  transcriptText: string;
  completedSentences: CompletedSentences;
  totalSentences: number;
  createdAt: number;
  lastAccessed: number;
  isTrashed?: boolean;
};

export type ContentType = 'lesson' | 'deck';

export interface LessonItem {
  id: string;
  name: string;
  language: 'en' | 'de';
  progress: number; // 0-100
  hasMedia: boolean;
  mediaType: 'audio' | 'video';
  type: 'lesson'; // CRITICAL: để phân biệt với deck
}

export interface DeckItem {
  id: string;
  name: string;
  language: 'en' | 'de' | 'mixed';
  cardCount: number;
  /** Cards marked Done / total (persisted), same scale as lesson sidebar progress. */
  progress: number;
  type: 'deck'; // CRITICAL: để phân biệt với lesson
}

export interface TrashItem {
  id: string;
  name: string;
  originalType: 'lesson' | 'deck';
  language: string;
  trashedAt?: number;
}

// Expanded sections state
export type ExpandedSections = Record<string, boolean>;
