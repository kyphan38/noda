import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { parseTranscript } from '@/lib/utils';
import { saveLesson } from '@/lib/db';
import type { AppMode, DeckItem, LessonItem, Sentence } from '@/types';

type SetToast = (t: { message: string; type: 'success' | 'error' | 'info' } | null) => void;

type Selected = {
  id: string;
  type: 'lesson' | 'deck';
  data: LessonItem | DeckItem;
};

type FetchIPA = (sentencesToUse?: Sentence[], langOverride?: string) => boolean | Promise<boolean>;

export function useLessonCreateFlow(
  setSelectedItem: Dispatch<SetStateAction<Selected | null>>,
  handleLoadLesson: (id: string) => Promise<void>,
  handleModeChange: (mode: AppMode) => void | Promise<void>,
  setUploadMode: (m: 'idle' | 'lesson' | 'deck') => void,
  setToast: SetToast,
  fetchIPA: FetchIPA
) {
  const handleLessonCreated = useCallback(
    async (data: {
      name: string;
      language: 'en' | 'de';
      audioFile: File;
      transcriptFile: File | null;
      generateIpa: boolean;
    }) => {
      try {
        let text = '';
        if (data.transcriptFile) {
          text = await data.transcriptFile.text();
        }

        const sentences = parseTranscript(text);
        const lessonId = Date.now().toString();

        const newLesson = {
          id: lessonId,
          type: 'audio' as const,
          name: data.name,
          language: data.language,
          audioFile: data.audioFile,
          transcriptText: text,
          ipaData: {},
          completedSentences: {},
          totalSentences: sentences.length,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
        };

        await saveLesson(newLesson);

        const lessonItem: LessonItem = {
          id: lessonId,
          name: data.name,
          language: data.language,
          progress: 0,
          hasAudio: true,
          hasIpa: false,
          type: 'lesson',
        };

        setSelectedItem({
          id: lessonId,
          type: 'lesson',
          data: lessonItem,
        });

        await handleLoadLesson(lessonId);
        await handleModeChange('normal');
        let ipaOk = true;
        if (data.generateIpa && sentences.length > 0) {
          ipaOk = await fetchIPA(sentences, data.language);
        }
        setUploadMode('idle');
        if (!ipaOk) {
          setToast({
            message:
              'Lesson created, but IPA generation failed. Set NEXT_PUBLIC_GEMINI_API_KEY in .env.local, restart dev server, and check the browser console.',
            type: 'error',
          });
        } else {
          setToast({ message: 'Lesson created successfully.', type: 'success' });
        }
      } catch {
        setToast({ message: 'Failed to create lesson.', type: 'error' });
      }
    },
    [setSelectedItem, handleLoadLesson, handleModeChange, setUploadMode, setToast, fetchIPA]
  );

  const handleDeckCreated = useCallback(
    async (deckData: { name: string; language: 'en' | 'de'; content: string }) => {
      try {
        const lines = deckData.content
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        const lessonId = Date.now().toString();

        const newLesson = {
          id: lessonId,
          type: 'flashcard' as const,
          name: deckData.name,
          language: deckData.language,
          transcriptText: '',
          ipaData: {},
          completedSentences: {},
          totalSentences: lines.length,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          flashcardData: {
            lines,
            ratings: {},
            currentIndex: 0,
            isShuffled: false,
            shuffledIndices: [],
          },
        };

        await saveLesson(newLesson);

        const deckItem: DeckItem = {
          id: lessonId,
          name: deckData.name,
          language: deckData.language,
          cardCount: lines.length,
          type: 'deck',
        };

        setSelectedItem({
          id: lessonId,
          type: 'deck',
          data: deckItem,
        });

        await handleLoadLesson(lessonId);
        setUploadMode('idle');
        setToast({ message: 'Deck created successfully.', type: 'success' });
      } catch {
        setToast({ message: 'Failed to create deck.', type: 'error' });
      }
    },
    [setSelectedItem, handleLoadLesson, setUploadMode, setToast]
  );

  return { handleLessonCreated, handleDeckCreated };
}
