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
  name: string;
  language: string;
  progress: number;
  hasIpa: boolean;
  isTrashed: boolean;
  hasAudio: boolean;
};

// Lesson detail from DB
export type Lesson = {
  id: string;
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

// Expanded sections state
export type ExpandedSections = Record<string, boolean>;
