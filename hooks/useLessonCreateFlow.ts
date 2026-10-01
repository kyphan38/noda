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

export function useLessonCreateFlow(
  setSelectedItem: Dispatch<SetStateAction<Selected | null>>,
  handleLoadLesson: (id: string) => Promise<'loaded' | 'failed' | 'superseded'>,
  handleModeChange: (mode: AppMode) => void | Promise<void>,
  setUploadMode: (m: 'idle' | 'lesson') => void,
  setToast: SetToast,
  getTakenAudioLessonNames: () => string[],
  expandSidebarForItem: () => void
) {
  const handleLessonCreated = useCallback(
    async (data: {
      name: string;
      folderId: string | null;
      mediaFile: File;
      mediaType: 'audio' | 'video';
      transcriptFile: File | null;
    }, onUploadProgress?: (fraction: number) => void) => {
      // Failing before the lesson is saved throws, so the modal stays open with the
      // name, file and folder the user picked. Once saved, the modal closes either way.
      let lessonId: string;
      let uniqueName: string;
      try {
        let text = '';
        if (data.transcriptFile) {
          text = await data.transcriptFile.text();
        }

        const sentences = parseTranscript(text);
        lessonId = Date.now().toString();
        const baseName = data.name.trim() || 'Untitled lesson';
        uniqueName = uniquifyName(baseName, getTakenAudioLessonNames());
        const now = Date.now();
        const uploadedMedia = await uploadLessonMediaToFirebase(lessonId, data.mediaFile, onUploadProgress);

        const newLesson: LessonRecord = {
          id: lessonId,
          type: 'audio',
          name: uniqueName,
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
      } catch (error) {
        console.error('Could not create lesson', error);
        throw new Error('Could not upload or save the lesson. Check your connection and try again.');
      }

      setUploadMode('idle');
      const lessonItem: LessonItem = {
        id: lessonId,
        name: uniqueName,
        language: 'en',
        dictationProgress: 0,
        shadowingProgress: 0,
        hasMedia: true,
        mediaType: data.mediaType,
        type: 'lesson',
      };

      setSelectedItem({
        id: lessonId,
        type: 'lesson',
        data: lessonItem,
      });
      expandSidebarForItem();

      const loaded = await handleLoadLesson(lessonId);
      await handleModeChange('listen');
      setToast(
        loaded === 'failed'
          ? { message: 'Lesson created, but it could not be opened. Pick it from the sidebar.', type: 'error' }
          : { message: 'Lesson created.', type: 'success' }
      );
    },
    [
      setSelectedItem,
      handleLoadLesson,
      handleModeChange,
      setUploadMode,
      setToast,
      getTakenAudioLessonNames,
      expandSidebarForItem,
    ]
  );

  return { handleLessonCreated };
}
