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
  const currentIndex = PLAYBACK_SPEEDS.indexOf(currentSpeed as any);
  return PLAYBACK_SPEEDS[(currentIndex + 1) % PLAYBACK_SPEEDS.length];
};

/** Normalize lesson / speech-recognition codes for IPA prompt (de, de-DE → German; en, en-US → English). */
export const isGermanForIPA = (lang: string) =>
  lang === 'de' || lang === 'de-DE' || lang.startsWith('de');

export const getIPASystemInstruction = (recognitionLang: string) => {
  const label = isGermanForIPA(recognitionLang) ? 'German' : 'English';
  return `You are an IPA converter. The user message is a JSON array of objects with "id" (number) and "text" (string). For each object, output ${label} IPA for "text" only. Return a JSON array of the same length, same order, with objects {"id": <same id as input>, "ipa": "<IPA string without surrounding slashes>"}. Use every input id exactly once. Output ONLY that JSON array, no markdown or prose.`;
};

/** First top-level JSON array in a string (handles prose/markdown before/after). */
export function extractFirstJsonArray(raw: string): string | null {
  const start = raw.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\' && inString) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse model output that may be wrapped in extra text or markdown fences (already stripped). */
export function parseGeminiJsonArray(text: string): unknown[] {
  const trimmed = text.trim();
  const extracted = extractFirstJsonArray(trimmed);
  const candidates = extracted ? Array.from(new Set([trimmed, extracted])) : [trimmed];
  for (const c of candidates) {
    try {
      const v = JSON.parse(c);
      if (Array.isArray(v)) return v;
    } catch {
      /* try next */
    }
  }
  throw new Error('Could not parse a JSON array from model response');
}
