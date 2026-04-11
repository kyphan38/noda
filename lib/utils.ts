import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Sentence, SpokenResult } from '@/types';
import { PLAYBACK_SPEEDS } from '@/constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract letters from text (Unicode-aware)
 * Returns array of letters with their indices
 */
export const getLetters = (text: string) => {
  const letters = [];
  for (let i = 0; i < text.length; i++) {
    if (/[\p{L}\p{N}]/u.test(text[i])) {
      letters.push({ char: text[i], index: i });
    }
  }
  return letters;
};

/**
 * Format seconds to mm:ss format
 */
export const formatTime = (time: number): string => {
  if (isNaN(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Parse SRT transcript format to Sentence array
 */
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
      const timeMatch = lines[1].match(
        /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/
      );

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

        sentences.push({
          id: isNaN(id) ? sentences.length : id,
          start,
          end,
          text: textContent,
        });
      }
    }
  }
  return sentences;
};

/**
 * Compare spoken text with target text
 * Returns score (0-100) and word-by-word diff
 */
export const compareSentences = (target: string, spoken: string): SpokenResult => {
  const clean = (s: string) =>
    s.toLowerCase().replace(/[.,?!;:()]/g, '').trim();
  const targetWords = clean(target).split(/\s+/).filter((w) => w);
  const spokenWords = clean(spoken).split(/\s+/).filter((w) => w);

  let correctCount = 0;
  let spokenIndex = 0;

  const diff = targetWords.map((tw) => {
    let found = false;
    for (let i = spokenIndex; i < Math.min(spokenIndex + 3, spokenWords.length); i++) {
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

  const score =
    targetWords.length > 0 ? Math.round((correctCount / targetWords.length) * 100) : 0;
  return { score, diff, text: spoken };
};

/**
 * Get next playback speed
 */
export const getNextPlaybackSpeed = (current: number): number => {
  const currentIndex = PLAYBACK_SPEEDS.indexOf(current as any);
  const nextSpeed = PLAYBACK_SPEEDS[(currentIndex + 1) % PLAYBACK_SPEEDS.length];
  return nextSpeed;
};

/**
 * Generate IPA system instruction for Gemini
 */
export const getIPASystemInstruction = (language: string): string => {
  const lang = language === 'de-DE' ? 'German' : 'English';
  return `You are an IPA converter. Convert the user's text into ${lang} IPA. Output ONLY raw JSON. Do not add any greetings, explanations, or formatting.`;
};
