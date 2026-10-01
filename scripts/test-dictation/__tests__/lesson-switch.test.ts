// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { LessonRecord } from '@/lib/db';

/**
 * Switching lessons must never write one lesson's progress into another lesson's
 * doc, and must not drop edits that were still waiting on the save debounce.
 */

const lessons: Record<string, LessonRecord> = {
  A: lesson('A', { 1: true }, { 2: 'hel' }),
  B: lesson('B', { 3: true }, {}),
};

function lesson(id: string, completed: Record<number, boolean>, drafts: Record<number, string>): LessonRecord {
  return {
    id,
    type: 'audio',
    name: `Lesson ${id}`,
    language: 'en',
    mediaPath: `users/u1/media/${id}.mp3`,
    transcriptText: '1\n00:00:00,000 --> 00:00:01,000\nhello\n\n2\n00:00:01,000 --> 00:00:02,000\nhello there\n\n3\n00:00:02,000 --> 00:00:03,000\nbye',
    completedSentences: completed,
    dictationInputs: drafts,
    progress: {},
    totalSentences: 3,
    createdAt: 0,
    lastAccessed: 0,
    updatedAt: 0,
  };
}

let urlDelayMs = 0;
const progressWrites: Array<{ id: string; completed: Record<number, boolean>; drafts?: Record<number, string> }> = [];

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
}));
vi.mock('@/lib/auth/firebase-client', () => ({ getFirebaseAuth: () => ({}) }));
vi.mock('@/lib/db', () => ({
  getLessonFirestore: async (id: string) => structuredClone(lessons[id]),
  resolveLessonMediaUrl: (l: LessonRecord) =>
    new Promise((resolve) => setTimeout(() => resolve(`https://media/${l.id}`), urlDelayMs)),
  touchLessonAccessedFirestore: async () => {},
  subscribeLessonsFirestore: () => () => {},
  deleteLessonFirestore: async () => {},
  renameLessonFirestore: async () => {},
  updateLessonProgressFirestore: async (
    id: string,
    completed: Record<number, boolean>,
    options?: { dictationInputs?: Record<number, string> }
  ) => {
    progressWrites.push({ id, completed: { ...completed }, drafts: options?.dictationInputs && { ...options.dictationInputs } });
  },
  updateShadowingProgressFirestore: async () => {},
}));

const { useLessonLogic } = await import('@/hooks/useLessonLogic');

function setup() {
  return renderHook(() => useLessonLogic(() => {}, () => {}));
}

beforeEach(() => {
  vi.useFakeTimers();
  progressWrites.length = 0;
  urlDelayMs = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

async function load(result: ReturnType<typeof setup>['result'], id: string) {
  await act(async () => {
    const p = result.current.handleLoadLesson(id);
    await vi.advanceTimersByTimeAsync(urlDelayMs + 1);
    await p;
  });
}

describe('lesson switch', () => {
  it('never writes the previous lesson progress into the next lesson while it loads', async () => {
    const { result } = setup();
    await load(result, 'A');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    progressWrites.length = 0;

    urlDelayMs = 800; // media URL slower than every save debounce
    let pending: Promise<void> = Promise.resolve();
    await act(async () => {
      pending = result.current.handleLoadLesson('B');
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(result.current.isLessonLoading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await pending;
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const intoB = progressWrites.filter((w) => w.id === 'B');
    for (const w of intoB) expect(w.completed).toEqual({ 3: true });
    expect(result.current.currentLessonId).toBe('B');
    expect(result.current.completedSentences).toEqual({ 3: true });
    expect(result.current.isLessonLoading).toBe(false);
  });

  it('saves edits still waiting on the debounce before switching lessons', async () => {
    const { result } = setup();
    await load(result, 'A');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    progressWrites.length = 0;

    act(() => {
      result.current.setDictationInputs((prev) => ({ ...prev, 2: 'hello th' }));
    });
    // Switch before the 200ms dictation debounce fires.
    await load(result, 'B');

    const intoA = progressWrites.filter((w) => w.id === 'A');
    expect(intoA.at(-1)?.drafts).toEqual({ 2: 'hello th' });
  });

  it('saves pending edits when leaving the lesson for the welcome screen', async () => {
    const { result } = setup();
    await load(result, 'A');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    progressWrites.length = 0;

    act(() => {
      result.current.setDictationInputs((prev) => ({ ...prev, 2: 'hello the' }));
    });
    act(() => {
      result.current.handleNewLesson();
    });

    expect(progressWrites.filter((w) => w.id === 'A').at(-1)?.drafts).toEqual({ 2: 'hello the' });
  });
});
