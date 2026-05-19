import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Sentence } from '@/types';
import { PLAYBACK_SPEEDS } from '@/constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const getLetters = (text: string) => {
  const letters = [];
  for (let i = 0; i < text.length; i++) {
    if (/[\p{L}\p{N}]/u.test(text[i])) {
      letters.push({ char: text[i], index: i });
    }
  }
  return letters;
};

/** Ensure `base` does not collide with existing names (case-insensitive); appends " (1)", " (2)", … */
/** True if `base` (trimmed) collides with any name in `existingNames`, case-insensitive - same rule as {@link uniquifyName}. */
export function isLessonNameTaken(base: string, existingNames: string[]): boolean {
  const t = base.trim();
  if (!t) return false;
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()).filter(Boolean));
  return taken.has(t.toLowerCase());
}

export function uniquifyName(base: string, existingNames: string[]): string {
  const t = base.trim();
  if (!t) return t;
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()).filter(Boolean));
  if (!taken.has(t.toLowerCase())) return t;
  let n = 1;
  let candidate = `${t} (${n})`;
  while (taken.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${t} (${n})`;
  }
  return candidate;
}

/** Lowercase, strip punctuation, collapse whitespace to single spaces (dictation target / input). */
export function normalizeDictationTarget(
  text: string,
  options?: { preserveTrailingSpace?: boolean }
): string {
  const lower = text.toLowerCase();
  let out = '';
  let lastWasSpace = false;
  for (const c of lower) {
    if (/\s/u.test(c)) {
      if (out.length > 0) lastWasSpace = true;
    } else if (/[\p{Lm}]/u.test(c)) {
      // Strip modifier letters (e.g. U+02BC ʼ) — they look like apostrophes
      // but are classified as Unicode letters; users can't type them.
    } else if (/[\p{L}\p{N}]/u.test(c)) {
      if (lastWasSpace) {
        out += ' ';
        lastWasSpace = false;
      }
      out += c;
    }
  }
  if (options?.preserveTrailingSpace && /\s$/u.test(lower) && out.length > 0 && !out.endsWith(' ')) {
    out += ' ';
  }
  return out;
}

/**
 * Align user input with the target sentence layout.
 * Extracts only letters/numbers from the input (ignoring spaces and
 * punctuation), clamps to the target's letter count, then maps those
 * letters onto the target's character positions — auto-inserting spaces
 * wherever the target has them.  This means users never need to manually
 * type spaces; they just type the letters they hear.
 */
export function alignDictationInput(rawInput: string, targetNorm: string): string {
  const norm = normalizeDictationTarget(rawInput);
  const inputLetters = norm.replace(/ /g, '');
  const targetLetters = targetNorm.replace(/ /g, '');
  const clamped = inputLetters.slice(0, targetLetters.length);

  let aligned = '';
  let li = 0;
  for (let i = 0; i < targetNorm.length; i++) {
    if (li >= clamped.length) break;
    if (targetNorm[i] === ' ') {
      if (li < clamped.length) aligned += ' ';
    } else {
      aligned += clamped[li];
      li++;
    }
  }
  return aligned;
}

/** Sidebar % for flashcard decks: matches session queue - permanently done cards / total lines. */
export function flashcardDeckProgressPercent(
  flashcardData: { lines?: string[]; ratings?: Record<number, string> } | undefined,
  totalSentences: number
): number {
  const linesLen =
    flashcardData?.lines && flashcardData.lines.length > 0
      ? flashcardData.lines.length
      : totalSentences;
  if (linesLen <= 0) return 0;
  const ratings = flashcardData?.ratings ?? {};
  let notDone = 0;
  for (let i = 0; i < linesLen; i++) {
    if (ratings[i] !== 'done') notDone += 1;
  }
  const done = linesLen - notDone;
  return Math.round(Math.min(100, (done / linesLen) * 100));
}

export const formatTime = (time: number) => {
  if (isNaN(time)) return "0:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const parseTranscript = (text: string): Sentence[] => {
  const sentences: Sentence[] = [];
  if (!text) return sentences;
  // Normalize line endings and split by double newline
  const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length >= 3) {
      const id = parseInt(lines[0], 10);
      // SRT time format: 00:00:01,000 --> 00:00:04,000
      const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      
      if (timeMatch) {
        const start = 
          parseInt(timeMatch[1], 10) * 3600 + 
          parseInt(timeMatch[2], 10) * 60 + 
          parseInt(timeMatch[3], 10) + 
          parseInt(timeMatch[4], 10) / 1000;
          
        const end = 
          parseInt(timeMatch[5], 10) * 3600 + 
          parseInt(timeMatch[6], 10) * 60 + 
          parseInt(timeMatch[7], 10) + 
          parseInt(timeMatch[8], 10) / 1000;
          
        const textContent = lines.slice(2).join('\n').trim();
        
        sentences.push({ id: isNaN(id) ? sentences.length : id, start, end, text: textContent });
      }
    }
  }
  return sentences;
};

export const compareSentences = (target: string, spoken: string) => {
  const clean = (s: string) => s.toLowerCase().replace(/[.,?!;:()]/g, '').trim();
  const targetWords = clean(target).split(/\s+/).filter(w => w);
  const spokenWords = clean(spoken).split(/\s+/).filter(w => w);

  let correctCount = 0;
  let spokenIndex = 0;
  
  const diff = targetWords.map(tw => {
    let found = false;
    for(let i = spokenIndex; i < Math.min(spokenIndex + 3, spokenWords.length); i++) {
        if (spokenWords[i] === tw) {
            found = true;
            spokenIndex = i + 1;
            break;
        }
    }
    
    if (found) {
        correctCount++;
        return { word: tw, status: 'correct' };
    } else {
        return { word: tw, status: 'incorrect' };
    }
  });

  const score = targetWords.length > 0 ? Math.round((correctCount / targetWords.length) * 100) : 0;
  return { score, diff, text: spoken };
};

export const getNextPlaybackSpeed = (currentSpeed: number) => {
  const speeds = PLAYBACK_SPEEDS as readonly number[];
  let idx = speeds.indexOf(currentSpeed);
  if (idx < 0) idx = 0;
  return PLAYBACK_SPEEDS[(idx + 1) % PLAYBACK_SPEEDS.length];
};
