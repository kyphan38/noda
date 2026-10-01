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
  handleLoadLesson: (id: string) => Promise<void>,
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
    }) => {
      try {
        let text = '';
        if (data.transcriptFile) {
          text = await data.transcriptFile.text();
        }

        const sentences = parseTranscript(text);
        const lessonId = Date.now().toString();
        const baseName = data.name.trim() || 'Untitled lesson';
        const uniqueName = uniquifyName(baseName, getTakenAudioLessonNames());
        const now = Date.now();
        const uploadedMedia = await uploadLessonMediaToFirebase(lessonId, data.mediaFile);

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

        const lessonItem: LessonItem = {
          id: lessonId,
          name: uniqueName,
          language: 'en',
          progress: 0,
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

        await handleLoadLesson(lessonId);
        await handleModeChange('normal');
        setToast({ message: 'Lesson created.', type: 'success' });
      } catch {
        setToast({ message: 'Could not create lesson.', type: 'error' });
      } finally {
        setUploadMode('idle');
      }
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
