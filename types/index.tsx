// Sentence structure for transcript
export type Sentence = {
  id: number;
  text: string;
  start: number;
  end: number;
};

// Learning modes
export type LoopMode = 'none' | 'all' | 'one';
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
export type IPAData = Record<number, string>;

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
  hasIpa: boolean;
  isTrashed: boolean;
  hasAudio: boolean;
};

// Lesson detail from DB
export type Lesson = {
  id: string;
  type?: 'audio' | 'flashcard';
  name: string;
  language: string;
  audioFile?: File;
  transcriptText: string;
  ipaData: IPAData;
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
  hasAudio: boolean;
  hasIpa: boolean;
  type: 'lesson'; // CRITICAL: để phân biệt với deck
}

export interface DeckItem {
  id: string;
  name: string;
  language: 'en' | 'de' | 'mixed';
  cardCount: number;
  type: 'deck'; // CRITICAL: để phân biệt với lesson
}

export interface TrashItem {
  id: string;
  name: string;
  originalType: 'lesson' | 'deck';
  language: string;
}

// Expanded sections state
export type ExpandedSections = Record<string, boolean>;
