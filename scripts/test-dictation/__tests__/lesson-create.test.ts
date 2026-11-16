// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/** A failed upload must keep the new-lesson modal open (nothing the user picked is lost). */

const upload = vi.fn();
// The test reads the saved lesson from save.mock.calls.
const save = vi.fn(async (lesson: unknown) => {
  void lesson;
});
vi.mock('@/lib/db', () => ({
  uploadLessonMediaToFirebase: (...args: unknown[]) => upload(...args),
  saveLessonFirestore: (lesson: unknown) => save(lesson),
}));

const { useLessonCreateFlow } = await import('@/hooks/useLessonCreateFlow');

function setup() {
  const calls = { uploadMode: [] as string[], toasts: [] as unknown[], selected: 0 };
  const hook = renderHook(() =>
    useLessonCreateFlow(
      () => {
        calls.selected += 1;
      },
      async () => 'loaded',
      async () => {},
      (m) => calls.uploadMode.push(m),
      (t) => calls.toasts.push(t),
      () => [],
      () => {}
    )
  );
  return { ...hook, calls };
}

const input = {
  name: 'Talk',
  folderId: null,
  mediaFile: new File(['x'], 'talk.mp3', { type: 'audio/mpeg' }),
  mediaType: 'audio' as const,
  transcriptFile: null,
};

describe('lesson create flow', () => {
  it('throws and keeps the modal open when the upload fails', async () => {
    upload.mockRejectedValueOnce(new Error('network'));
    const { result, calls } = setup();
    await expect(result.current.handleLessonCreated(input)).rejects.toThrow(/Check your connection/);
    expect(calls.uploadMode).toEqual([]);
    expect(calls.selected).toBe(0);
  });

  it('closes the modal and selects the lesson once it is saved', async () => {
    upload.mockResolvedValueOnce({ path: 'users/u/media/x.mp3', downloadURL: 'u', contentType: 'audio/mpeg', size: 1 });
    const { result, calls } = setup();
    await result.current.handleLessonCreated(input);
    expect(calls.uploadMode).toEqual(['idle']);
    expect(calls.selected).toBe(1);
    expect(calls.toasts.at(-1)).toMatchObject({ type: 'success' });
  });

  it('passes upload progress through to the caller', async () => {
    upload.mockImplementationOnce(async (_id: string, _file: File, onProgress?: (f: number) => void) => {
      onProgress?.(0.25);
      onProgress?.(1);
      return { path: 'users/u/media/x.mp3', downloadURL: 'u', contentType: 'audio/mpeg', size: 1 };
    });
    const { result } = setup();
    const seen: number[] = [];
    await result.current.handleLessonCreated(input, (f) => seen.push(f));
    expect(seen).toEqual([0.25, 1]);
  });
});

describe('batch lesson create', () => {
  const mp3 = (name: string) => ({ ...input, name, mediaFile: new File(['x'], `${name}.mp3`, { type: 'audio/mpeg' }) });

  it('creates every lesson in order, then opens the first', async () => {
    upload.mockResolvedValue({ path: 'users/u/media/x.mp3', downloadURL: 'u', contentType: 'audio/mpeg', size: 1 });
    const { result, calls } = setup();
    const done: number[] = [];
    await result.current.handleLessonsCreated([mp3('a'), mp3('b')], () => {}, (i) => done.push(i));
    expect(done).toEqual([0, 1]);
    expect(calls.uploadMode).toEqual(['idle']);
    expect(calls.selected).toBe(1);
    expect(calls.toasts.at(-1)).toMatchObject({ message: '2 lessons created.', type: 'success' });
    upload.mockReset();
  });

  it('stops at a failed upload and says how many were created', async () => {
    upload
      .mockResolvedValueOnce({ path: 'users/u/media/x.mp3', downloadURL: 'u', contentType: 'audio/mpeg', size: 1 })
      .mockRejectedValueOnce(new Error('network'));
    const { result, calls } = setup();
    const done: number[] = [];
    await expect(
      result.current.handleLessonsCreated([mp3('a'), mp3('b'), mp3('c')], () => {}, (i) => done.push(i))
    ).rejects.toThrow(/Created 1 of 3 lessons/);
    expect(done).toEqual([0]);
    expect(calls.uploadMode).toEqual([]);
  });

  it('reports progress per item', async () => {
    upload.mockImplementation(async (_id: string, _file: File, onProgress?: (f: number) => void) => {
      onProgress?.(1);
      return { path: 'users/u/media/x.mp3', downloadURL: 'u', contentType: 'audio/mpeg', size: 1 };
    });
    const { result } = setup();
    const seen: string[] = [];
    await result.current.handleLessonsCreated([mp3('a'), mp3('b')], (i, f) => seen.push(`${i}:${f}`), () => {});
    expect(seen).toEqual(['0:1', '1:1']);
    upload.mockReset();
  });
});

describe('youtube lesson create', () => {
  const srt = '1\n00:00:00,160 --> 00:00:01,020\nHi Georgie.\n\n2\n00:00:01,020 --> 00:00:01,880\nHi Phil.\n';
  const yt = {
    name: 'learning from different generations',
    folderId: 'f1',
    videoId: 'h-NZcQF7jgI',
    transcriptFile: new File([srt], 'subs.srt'),
  };

  it('saves a youtube lesson with no upload, then opens it', async () => {
    upload.mockReset();
    save.mockClear();
    const { result, calls } = setup();
    await result.current.handleYoutubeLessonCreated(yt);
    expect(upload).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({
      name: 'learning from different generations',
      folderId: 'f1',
      source: 'youtube',
      youtubeVideoId: 'h-NZcQF7jgI',
      mediaType: 'video',
      mediaPath: null,
      mediaUrl: null,
      transcriptText: srt,
      totalSentences: 2,
    });
    expect(calls.uploadMode).toEqual(['idle']);
    expect(calls.selected).toBe(1);
    expect(calls.toasts.at(-1)).toMatchObject({ type: 'success' });
  });

  it('throws and keeps the modal open when the save fails', async () => {
    save.mockRejectedValueOnce(new Error('offline'));
    const { result, calls } = setup();
    await expect(result.current.handleYoutubeLessonCreated(yt)).rejects.toThrow(/Check your connection/);
    expect(calls.uploadMode).toEqual([]);
    expect(calls.selected).toBe(0);
  });
});
