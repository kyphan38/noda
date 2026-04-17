import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { parseTranscript, uniquifyName } from '@/lib/utils';
import { saveLessonFirestore, type LessonRecord, uploadLessonMediaToFirebase } from '@/lib/db';
import type { AppMode, DeckItem, LessonItem } from '@/types';

type SetToast = (t: { message: string; type: 'success' | 'error' | 'info' } | null) => void;

type Selected = {
  id: string;
  type: 'lesson' | 'deck';
  data: LessonItem | DeckItem;
};

export function useLessonCreateFlow(
  setSelectedItem: Dispatch<SetStateAction<Selected | null>>,
  handleLoadLesson: (id: string) => Promise<void>,
  handleModeChange: (mode: AppMode) => void | Promise<void>,
  setUploadMode: (m: 'idle' | 'lesson' | 'deck') => void,
  setToast: SetToast,
  getTakenAudioLessonNames: () => string[],
  getTakenFlashcardDeckNames: () => string[],
  expandSidebarForItem: (kind: 'audio' | 'flashcard', language: string) => void
) {
  const handleLessonCreated = useCallback(
    async (data: {
      name: string;
      language: 'en' | 'de';
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
          language: data.language,
          mediaFile: null,
          mediaPath: uploadedMedia.path,
          mediaUrl: uploadedMedia.downloadURL,
          mediaFileName: data.mediaFile.name ?? null,
          mediaMimeType: uploadedMedia.contentType ?? null,
          mediaSizeBytes: uploadedMedia.size,
          mediaType: data.mediaType,
          transcriptText: text,
          completedSentences: {},
          totalSentences: sentences.length,
          createdAt: now,
          lastAccessed: now,
          updatedAt: now,
        };

        await saveLessonFirestore(newLesson);

        const lessonItem: LessonItem = {
          id: lessonId,
          name: uniqueName,
          language: data.language,
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
        expandSidebarForItem('audio', data.language);

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

  const handleDeckCreated = useCallback(
    async (deckData: { name: string; language: 'en' | 'de'; content: string }) => {
      try {
        const lines = deckData.content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        const lessonId = Date.now().toString();
        const baseName = deckData.name.trim() || 'Untitled deck';
        const uniqueName = uniquifyName(baseName, getTakenFlashcardDeckNames());
        const now = Date.now();

        const newLesson: LessonRecord = {
          id: lessonId,
          type: 'flashcard',
          name: uniqueName,
          language: deckData.language,
          transcriptText: '',
          completedSentences: {},
          totalSentences: lines.length,
          createdAt: now,
          lastAccessed: now,
          updatedAt: now,
          flashcardData: {
            lines,
            ratings: {},
            currentIndex: 0,
            isShuffled: false,
            shuffledIndices: [],
          },
        };

        await saveLessonFirestore(newLesson);

        const deckItem: DeckItem = {
          id: lessonId,
          name: uniqueName,
          language: deckData.language,
          cardCount: lines.length,
          progress: 0,
          type: 'deck',
        };

        setSelectedItem({
          id: lessonId,
          type: 'deck',
          data: deckItem,
        });
        expandSidebarForItem('flashcard', deckData.language);

        await handleLoadLesson(lessonId);
        setToast({ message: 'Deck created.', type: 'success' });
      } catch {
        setToast({ message: 'Could not create deck.', type: 'error' });
      } finally {
        setUploadMode('idle');
      }
    },
    [setSelectedItem, handleLoadLesson, setUploadMode, setToast, getTakenFlashcardDeckNames, expandSidebarForItem]
  );

  return { handleLessonCreated, handleDeckCreated };
}
