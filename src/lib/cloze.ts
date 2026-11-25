// noda - Dictation gaps (smart cloze): only the hard-to-hear words are typed; the rest
// are filled in. Pure. Works on the normalized target (lowercase, no punctuation,
// single spaces) and the aligned input from alignDictationInput.
import { alignDictationInput } from './utils';

/**
 * Short words that are said fast and weak (to -> /tə/), joined to their neighbours,
 * so they are the ones learners miss. Written as normalizeDictationTarget writes them:
 * no apostrophes (don't -> dont).
 */
const WEAK = new Set(
  (
    'a an the to of for from at in on by with as and but or than that so if ' +
    'is are am was were be been being has have had do does did can could will would shall should must ' +
    'he him his her she they them their we us our you your it its me my ' +
    'there this these those some just then ' +
    'dont doesnt didnt cant couldnt wont wouldnt shouldnt isnt arent wasnt werent havent hasnt hadnt ' +
    'im ive ill id youre youve youll youd hes shes weve were well wed theyre theyve theyll theyd ' +
    'its thats theres whats lets gonna wanna gotta kinda'
  ).split(' '),
);

/** Which words of the sentence are hidden. Always at least one: the longest word when none is weak. */
export function clozeMask(targetNorm: string): boolean[] {
  const words = targetNorm.split(' ').filter(Boolean);
  const mask = words.map((w) => WEAK.has(w) || /\d/.test(w));
  if (words.length > 0 && !mask.some(Boolean)) {
    let longest = 0;
    words.forEach((w, i) => {
      if (w.length > words[longest].length) longest = i;
    });
    mask[longest] = true;
  }
  return mask;
}

/** Letter index where each word starts, plus the total letter count at the end. */
function wordStarts(words: string[]): number[] {
  const starts = [0];
  for (const w of words) starts.push(starts[starts.length - 1] + w.length);
  return starts;
}

const letters = (s: string) => s.replace(/ /g, '');

/**
 * Fills in shown words that come right after what was typed, so the caret always waits
 * on a hidden word. `aligned` is an aligned input; the result is one too.
 */
export function clozeFill(aligned: string, targetNorm: string, mask: readonly boolean[]): string {
  const words = targetNorm.split(' ').filter(Boolean);
  const starts = wordStarts(words);
  let typed = letters(aligned);
  let k = starts.indexOf(typed.length);
  if (k < 0 || k >= words.length || mask[k]) return aligned;
  while (k < words.length && !mask[k]) {
    typed += words[k];
    k++;
  }
  // The trailing space puts the caret on the next hidden word.
  return alignDictationInput(k < words.length ? `${typed} ` : typed, targetNorm);
}

/**
 * The input after one change in gaps mode. Shown words cannot be erased one letter at a
 * time: a backspace that reaches them skips over them and takes the last letter of the
 * hidden word before. Then shown words that follow are filled in.
 */
export function clozeChange(prevAligned: string, nextAligned: string, targetNorm: string, mask: readonly boolean[]): string {
  const words = targetNorm.split(' ').filter(Boolean);
  const starts = wordStarts(words);
  let typed = letters(nextAligned);
  const prevCount = letters(prevAligned).length;
  if (nextAligned.length < prevAligned.length && typed.length <= prevCount) {
    // Only a space went (the one put after shown words): count it as the letter before it.
    const erased = typed.length < prevCount ? typed.length : typed.length - 1;
    // The word holding the erased letter.
    let k = 0;
    while (k < words.length - 1 && starts[k + 1] <= erased) k++;
    if (erased >= 0 && !mask[k]) {
      while (k > 0 && !mask[k - 1]) k--;
      typed = typed.slice(0, Math.max(0, starts[k] - 1));
    }
  }
  return clozeFill(alignDictationInput(typed, targetNorm), targetNorm, mask);
}
