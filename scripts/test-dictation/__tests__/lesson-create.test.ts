// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

/** A failed upload must keep the new-lesson modal open (nothing the user picked is lost). */

const upload = vi.fn();
vi.mock('@/lib/db', () => ({
  uploadLessonMediaToFirebase: (...args: unknown[]) => upload(...args),
  saveLessonFirestore: async () => {},
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

