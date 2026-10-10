import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { parseTranscript, uniquifyName } from '@/lib/utils';
import { saveLessonFirestore, type LessonRecord, uploadLessonMediaToFirebase } from '@/lib/db';
import type { AppMode, LessonItem } from '@/types';

type SetToast = (t: { message: string; type: 'success' | 'error' | 'info' } | null) => void;

type Selected = {
  id: string;
  type: 'lesson';
  data: LessonItem;
};

export interface NewLessonInput {
  name: string;
  folderId: string | null;
  mediaFile: File;
  mediaType: 'audio' | 'video';
  transcriptFile: File | null;
}

/** Uploads the media and saves the lesson; throws (nothing saved) on failure. */
async function createLessonRecord(
  data: NewLessonInput,
  takenNames: string[],
  onUploadProgress?: (fraction: number) => void
): Promise<{ lessonId: string; name: string }> {
  try {
    const text = data.transcriptFile ? await data.transcriptFile.text() : '';
    const sentences = parseTranscript(text);
    const lessonId = Date.now().toString();
    const name = uniquifyName(data.name.trim() || 'Untitled lesson', takenNames);
    const now = Date.now();
    const uploadedMedia = await uploadLessonMediaToFirebase(lessonId, data.mediaFile, onUploadProgress);

    const newLesson: LessonRecord = {
      id: lessonId,
      type: 'audio',
      name,
      language: 'en',
      folderId: data.folderId,
      sortKey: Date.now(),
      mediaFile: null,
      mediaPath: uploadedMedia.path,
      mediaUrl: uploadedMedia.downloadURL,
      mediaFileName: data.mediaFile.name ?? null,
      mediaMimeType: uploadedMedia.contentType ?? null,
      mediaSizeBytes: uploadedMedia.size,
      mediaType: data.mediaType,
      transcriptText: text,
      completedSentences: {},
      dictationInputs: {},
      totalSentences: sentences.length,
      createdAt: now,
      lastAccessed: now,
      updatedAt: now,
    };

    await saveLessonFirestore(newLesson);
    return { lessonId, name };
  } catch (error) {
    console.error('Could not create lesson', error);
    throw new Error('Could not upload or save the lesson. Check your connection and try again.');
  }
}

export function useLessonCreateFlow(
  setSelectedItem: Dispatch<SetStateAction<Selected | null>>,
  handleLoadLesson: (id: string) => Promise<'loaded' | 'failed' | 'superseded'>,
  handleModeChange: (mode: AppMode) => void | Promise<void>,
  setUploadMode: (m: 'idle' | 'lesson') => void,
  setToast: SetToast,
  getTakenAudioLessonNames: () => string[],
  expandSidebarForItem: () => void
) {
  /** Closes the modal and opens a just-created lesson. Returns whether it opened. */
  const openLesson = useCallback(
    async (lessonId: string, name: string, mediaType: 'audio' | 'video') => {
      setUploadMode('idle');
      const lessonItem: LessonItem = {
        id: lessonId,
        name,
        language: 'en',
        dictationProgress: 0,
        shadowingProgress: 0,
        hasMedia: true,
        mediaType,
        type: 'lesson',
      };
      setSelectedItem({ id: lessonId, type: 'lesson', data: lessonItem });
      expandSidebarForItem();
      const loaded = await handleLoadLesson(lessonId);
      await handleModeChange('listen');
      return loaded !== 'failed';
    },
    [setUploadMode, setSelectedItem, expandSidebarForItem, handleLoadLesson, handleModeChange]
  );

  const handleLessonCreated = useCallback(
    async (data: NewLessonInput, onUploadProgress?: (fraction: number) => void) => {
      // Failing before the lesson is saved throws, so the modal stays open with the
      // name, file and folder the user picked. Once saved, the modal closes either way.
      const { lessonId, name } = await createLessonRecord(data, getTakenAudioLessonNames(), onUploadProgress);
      const opened = await openLesson(lessonId, name, data.mediaType);
      setToast(
        opened
          ? { message: 'Lesson created.', type: 'success' }
          : { message: 'Lesson created, but it could not be opened. Pick it from the sidebar.', type: 'error' }
      );
    },
    [getTakenAudioLessonNames, openLesson, setToast]
  );

  /**
   * Creates several lessons one after another (files dropped together), then
   * opens the first. `onItemDone` lets the modal drop finished rows: when one
   * fails, this throws and the modal keeps only the rows not created yet.
   */
  const handleLessonsCreated = useCallback(
    async (
      items: NewLessonInput[],
      onUploadProgress: (index: number, fraction: number) => void,
      onItemDone: (index: number) => void
    ) => {
      const created: Array<{ lessonId: string; name: string; mediaType: 'audio' | 'video' }> = [];
      // Names made earlier in this batch are not in the lessons snapshot yet.
      const taken = getTakenAudioLessonNames();
      for (const [i, item] of items.entries()) {
        let result: { lessonId: string; name: string };
        try {
          result = await createLessonRecord(item, taken, (f) => onUploadProgress(i, f));
        } catch (error) {
          if (created.length === 0) throw error;
          throw new Error(
            `Created ${created.length} of ${items.length} lessons. ` +
              'Could not upload the rest. Check your connection and try again.'
          );
        }
        taken.push(result.name);
        created.push({ ...result, mediaType: item.mediaType });
        onItemDone(i);
      }

      const first = created[0];
      if (!first) return;
      const opened = await openLesson(first.lessonId, first.name, first.mediaType);
      setToast(
        opened
          ? { message: `${created.length} ${created.length === 1 ? 'lesson' : 'lessons'} created.`, type: 'success' }
          : { message: 'Lessons created, but the first could not be opened. Pick one from the sidebar.', type: 'error' }
      );
    },
    [getTakenAudioLessonNames, openLesson, setToast]
  );

  return { handleLessonCreated, handleLessonsCreated };
}
