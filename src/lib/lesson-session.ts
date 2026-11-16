// noda - Small stores shared by parts of the lesson screen that sit far apart in the tree.
// Not pure (they hold state), but no React and no Firebase.

type Listener = () => void;

function store<T>(initial: T) {
  let value = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => value,
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** The open lesson, for code that records misses. */
export const currentLessonStore = store<{ id: string; name: string; youtube: boolean } | null>(null);

const PAUSES_KEY = 'noda.listenPauses';

function readPauses(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(PAUSES_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Listen with pauses (N10): after each sentence, silence as long as it, to repeat it. Per device. */
export const listenPausesStore = (() => {
  const s = store<boolean>(readPauses());
  return {
    get: s.get,
    set(on: boolean) {
      s.set(on);
      try {
        localStorage.setItem(PAUSES_KEY, on ? 'on' : 'off');
      } catch {
        // private mode: the choice lasts this visit only
      }
    },
    subscribe: s.subscribe,
  };
})();

/** Sentence playing slower because it was hard (N4), or null. */
export const slowSentenceStore = store<number | null>(null);

let slowEnd: (() => void) | null = null;

/** The dictation handlers register how to put the speed back. */
export function setSlowEnd(fn: (() => void) | null): void {
  slowEnd = fn;
}

/** Back to the chosen speed (leaving Dictation, or another lesson). */
export function endSlowNow(): void {
  if (slowSentenceStore.get() !== null) slowEnd?.();
}

/** Paragraph dictation (N7): the stretch being played, outside the per-sentence rules. */
export const playRangeStore = store<{ start: number; end: number } | null>(null);

let rangePlayer: ((start: number, end: number) => void) | null = null;

/** The playback loop registers how to play a stretch of the media. */
export function setRangePlayer(fn: ((start: number, end: number) => void) | null): void {
  rangePlayer = fn;
}

/** Plays from `start` to `end`, then stops. */
export function playRange(start: number, end: number): void {
  rangePlayer?.(start, end);
}

const WORDS_KEY = 'noda.wordCards';

function readWordsOn(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(WORDS_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Word cards on double click (N3): off until turned on. Per device. */
export const wordCardsOnStore = (() => {
  const s = store<boolean>(readWordsOn());
  return {
    get: s.get,
    set(on: boolean) {
      s.set(on);
      try {
        localStorage.setItem(WORDS_KEY, on ? 'on' : 'off');
      } catch {
        // private mode: the choice lasts this visit only
      }
    },
    subscribe: s.subscribe,
  };
})();

/** The one word card open: its sentence and word index, or null. */
export const openWordStore = store<{ sentenceId: number; index: number } | null>(null);
