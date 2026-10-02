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
/** Lesson tabs. Only dictation and shadowing count toward progress; listen only remembers where you were. */
export type AppMode = 'listen' | 'dictation' | 'shadowing';
export type DictationInputs = Record<number, string>;
export type CompletedSentences = Record<number, boolean>;

// Lesson summary from DB
export type LessonSummary = {
  id: string;
  name: string;
  language: string;
  /** 0-100, share of sentences completed in each mode. */
  dictationProgress: number;
  shadowingProgress: number;
  totalSentences: number;
  isTrashed: boolean;
  /** Whether a media blob exists in IndexedDB (audio or video). */
  hasMedia: boolean;
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

export interface LessonItem {
  id: string;
  name: string;
  language: 'en';
  /** 0-100, share of sentences completed in each mode. */
  dictationProgress: number;
  shadowingProgress: number;
  hasMedia: boolean;
  mediaType: 'audio' | 'video';
  folderId?: string | null;
  sortKey?: number;
  type: 'lesson';
}

// Expanded sections state
export type ExpandedSections = Record<string, boolean>;

export type SidebarKind = 'audio';
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

// Shadowing pattern explanation (Gemini analysis, cached in Firestore per sentence).
//
// v2 replaced the original four independent sections (stress / intonation /
// connected speech / chunking) with one chunk-and-token structure, because three
// of those four described the same sentence from different angles and the panel
// had to show them on one annotated line instead of four tabs. Analysis docs are
// versioned (`SHADOWING_ANALYSIS_VERSION`) and v1 docs are not convertible - the
// v1 cache was deleted rather than migrated.
//
// v3 has the same shape as v2. It only forces a re-analysis: v2 docs could hold
// Vietnamese-style `sounds` ("li-đồ") from an ambiguous prompt. v3 also adds the
// optional `notes[].via`.

export const SHADOWING_ANALYSIS_VERSION = 3;

/** How audibly a token is pronounced. `weak` is only ever a function word. */
export type ShadowingStressLevel = 'strong' | 'normal' | 'weak';

export type ShadowingTone = 'rise' | 'fall' | 'fall-rise' | 'rise-fall' | 'flat';

export type ShadowingToken = {
  /** The word exactly as it appears in the transcript, punctuation included. */
  w: string;
  /**
   * Same characters as `w`; for `level: 'strong'` the stressed syllable is
   * uppercased (`manager` -> `MANager`). Server-validated to differ from `w`
   * by letter case only - a token whose letters drift is reset to `w`.
   */
  display: string;
  level: ShadowingStressLevel;
  /** True when this word takes part in one of the `notes` below. */
  linked?: boolean;
};

export type ShadowingChunk = {
  tokens: ShadowingToken[];
  tone: ShadowingTone;
  /** `weak` renders the arrow parenthesized - a slight continuation rise, not a committed move. */
  toneStrength: 'strong' | 'weak';
};

export type ShadowingNoteType = 'linking' | 'reduction' | 'elision' | 'assimilation' | 'rhythm';

export type ShadowingNote = {
  type: ShadowingNoteType;
  /** The words this note is about; empty for `rhythm` notes. */
  text: string;
  /** Intermediate spoken form of a multi-step change, e.g. `I'm gonna`. Absent when single-step. */
  via?: string;
  /** English-style respelling, stressed syllable in caps, e.g. `HAD-tuh`. Empty for `rhythm` notes. */
  sounds: string;
  /** Narrow IPA of what is actually heard. Empty for `rhythm` notes. */
  ipa: string;
  /** One short Vietnamese coaching instruction - what to do, not what the rule is. */
  why: string;
};

export type ShadowingPatternAnalysis = {
  /** Thought groups in transcript order; every transcript word appears exactly once. */
  chunks: ShadowingChunk[];
  /** At most `SHADOWING_MAX_NOTES`, most important first; may be empty. */
  notes: ShadowingNote[];
};

/** Cached doc at `users/{userId}/lessons/{lessonId}/shadowingAnalysis/{sentenceId}`. */
export type ShadowingPatternDoc = {
  sentenceId: number;
  startSec: number;
  endSec: number;
  sourceText: string;
  model: string;
  /** Always `SHADOWING_ANALYSIS_VERSION`; readers treat any other value as a cache miss. */
  version: number;
  analysis: ShadowingPatternAnalysis;
  /** Firestore Timestamp on the wire; serialized to millis by the client read helper. */
  createdAt: number;
  generatedBy: string;
};
