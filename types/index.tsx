// Sentence structure for transcript
export type Sentence = {
  id: number;
  text: string;
  start: number;
  end: number;
};

// Learning modes
export type LoopMode = 'none' | 'one';
export type RepeatCount = 1 | 2 | 3 | 'infinite';
export type AppMode = 'normal' | 'dictation' | 'flashcard';
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
  /** Sidebar folder membership (null/undefined = root). */
  folderId?: string | null;
  /** Sidebar ordering key within a container (client-side ordering). */
  sortKey?: number;
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
  language: 'en';
  progress: number; // 0-100
  hasMedia: boolean;
  mediaType: 'audio' | 'video';
  folderId?: string | null;
  sortKey?: number;
  type: 'lesson'; // CRITICAL: discriminant vs deck
}

export interface DeckItem {
  id: string;
  name: string;
  language: 'en';
  cardCount: number;
  /** Cards marked Done / total (persisted), same scale as lesson sidebar progress. */
  progress: number;
  folderId?: string | null;
  sortKey?: number;
  type: 'deck'; // CRITICAL: discriminant vs lesson
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

export type SidebarKind = 'audio' | 'flashcard';
/** Stored on folder docs; new folders use `en`. Legacy `de` may still exist in Firestore. */
export type SidebarLanguage = 'en' | 'de';

export type SidebarFolder = {
  id: string;
  name: string;
  kind: SidebarKind;
  language: SidebarLanguage;
  parentId: string | null;
  sortKey: number;
  createdAt: number;
  updatedAt: number;
};

// Shadowing pattern explanation (Gemini analysis, cached in Firestore per sentence)
export type ConnectedSpeechFeature = {
  type: 'linking' | 'reduction' | 'elision' | 'assimilation';
  example: string;
  explanation: string;
};

export type ShadowingPatternAnalysis = {
  stressRhythm: {
    summary: string;
    stressedWords: string[];
    notes?: string;
  };
  intonationPitch: {
    summary: string;
    pattern: 'rising' | 'falling' | 'fall-rise' | 'rise-fall' | 'flat';
    notes?: string;
  };
  connectedSpeech: {
    summary: string;
    features: ConnectedSpeechFeature[];
  };
  chunking: {
    summary: string;
    groups: string[];
    pauseNotes?: string;
  };
};

/** Cached doc at `users/{userId}/lessons/{lessonId}/shadowingAnalysis/{sentenceId}`. */
export type ShadowingPatternDoc = {
  sentenceId: number;
  startSec: number;
  endSec: number;
  sourceText: string;
  model: string;
  analysis: ShadowingPatternAnalysis;
  /** Firestore Timestamp on the wire; serialized to millis by the client read helper. */
  createdAt: number;
  generatedBy: string;
};
