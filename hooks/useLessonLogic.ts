import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Sentence, AppMode, ExpandedSections } from '@/types';
import { DEFAULT_APP_MODE, SAVE_PROGRESS_DELAY_MS } from '@/constants';
import { parseTranscript, uniquifyName, flashcardDeckProgressPercent } from '@/lib/utils';
import {
  getAllLessons,
  getLesson,
  saveLesson,
  deleteLesson,
  updateLessonProgress,
  bumpLessonUpdatedAt,
  type LessonRecord,
} from '@/lib/db';

export function useLessonLogic(
  mediaFile: File | null,
  setMediaFile: (file: File | null) => void,
  setMediaURL: (url: string | null) => void,
  recognitionLang: string,
  setRecognitionLang: (lang: string) => void
) {
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [appMode, setAppMode] = useState<AppMode>(DEFAULT_APP_MODE);
  const [dictationInputs, setDictationInputs] = useState<Record<number, string>>({});
  const [completedSentences, setCompletedSentences] = useState<Record<number, boolean>>({});
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const currentLessonIdRef = useRef<string | null>(null);
  const lessonLoadGenerationRef = useRef(0);

  const [lessonsList, setLessonsList] = useState<
    Array<{
      id: string;
      name: string;
      language: string;
      progress: number;
      totalSentences: number;
      kind: 'audio' | 'flashcard';
      isTrashed: boolean;
      hasMedia: boolean;
      mediaType: 'audio' | 'video';
      trashedAt?: number;
    }>
  >([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [lessonName, setLessonName] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    'audio-en': true,
    'audio-de': false,
    'flashcard-en': true,
    'flashcard-de': false,
    trash: false,
  });

  const appModeRef = useRef<AppMode>(appMode);
  const completedSentencesRef = useRef<Record<number, boolean>>(completedSentences);

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    completedSentencesRef.current = completedSentences;
  }, [completedSentences]);

  const transcript = useMemo(() => parseTranscript(transcriptText), [transcriptText]);

  const loadLessonsList = useCallback(async (opts?: { trackLoading?: boolean }) => {
    const trackLoading = opts?.trackLoading === true;
    if (trackLoading) setIsListLoading(true);
    try {
      const dbLessons = await getAllLessons();
      const rows = dbLessons.map((l) => {
        const kind: 'audio' | 'flashcard' = l.type === 'flashcard' ? 'flashcard' : 'audio';
        const audioProgress =
          l.totalSentences > 0
            ? Math.round(
                (Object.values(l.completedSentences || {}).filter(Boolean).length / l.totalSentences) * 100
              )
            : 0;
        return {
          id: l.id,
          name: l.name,
          language: l.language,
          progress:
            kind === 'flashcard'
              ? flashcardDeckProgressPercent(l.flashcardData, l.totalSentences ?? 0)
              : audioProgress,
          totalSentences: l.totalSentences ?? 0,
          kind,
          isTrashed: !!l.isTrashed,
          hasMedia: !!l.mediaFile,
          mediaType: kind === 'flashcard' ? 'audio' : (l.mediaType ?? 'audio'),
          trashedAt: l.trashedAt,
        };
      });
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setLessonsList(rows);
    } catch (e) {
      console.error('Failed to load lessons', e);
    } finally {
      if (trackLoading) setIsListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLessonsList({ trackLoading: true });
  }, [loadLessonsList]);

  const progressSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentLessonId || !isStarted) {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
        progressSaveTimeoutRef.current = null;
      }
      return;
    }
    if (progressSaveTimeoutRef.current) {
      clearTimeout(progressSaveTimeoutRef.current);
      progressSaveTimeoutRef.current = null;
    }
    progressSaveTimeoutRef.current = setTimeout(() => {
      progressSaveTimeoutRef.current = null;
      updateLessonProgress(currentLessonId, completedSentencesRef.current).then(() => {
        loadLessonsList();
      });
    }, SAVE_PROGRESS_DELAY_MS);
    return () => {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
        progressSaveTimeoutRef.current = null;
      }
    };
  }, [completedSentences, currentLessonId, isStarted, loadLessonsList]);

  /** Cancel debounced progress save and persist latest progress so a later put cannot resurrect cleared audio. */
  const prepareForLessonMediaClear = useCallback(
    async (lessonId: string) => {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
        progressSaveTimeoutRef.current = null;
      }
      const active = currentLessonIdRef.current === lessonId || currentLessonId === lessonId;
      if (active && isStarted) {
        await updateLessonProgress(lessonId, completedSentencesRef.current);
        await loadLessonsList();
      }
    },
    [currentLessonId, isStarted, loadLessonsList]
  );

  const handleLoadLesson = async (id: string) => {
    const myGen = ++lessonLoadGenerationRef.current;
    try {
      const lesson = await getLesson(id);
      if (myGen !== lessonLoadGenerationRef.current) return;
      if (lesson) {
        currentLessonIdRef.current = lesson.id;
        setCurrentLessonId(lesson.id);
        setLessonName(lesson.name);
        setRecognitionLang(lesson.language);

        if (lesson.mediaFile) {
          setMediaFile(lesson.mediaFile);
          setMediaURL(URL.createObjectURL(lesson.mediaFile));
        } else {
          setMediaFile(null);
          setMediaURL(null);
        }

        setTranscriptText(lesson.transcriptText);
        setCompletedSentences(lesson.completedSentences || {});
        const hasTranscript = !!(lesson.transcriptText && lesson.transcriptText.trim());
        setIsStarted(!!lesson.mediaFile || hasTranscript);
        setAppMode('normal');

        lesson.lastAccessed = Date.now();
        await saveLesson(lesson);
        if (myGen !== lessonLoadGenerationRef.current) return;
        loadLessonsList();
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }
    } catch (e) {
      console.error('Failed to load lesson', e);
    }
  };

  const bumpLessonLoadGeneration = useCallback(() => {
    lessonLoadGenerationRef.current += 1;
  }, []);

  const handleNewLesson = () => {
    bumpLessonLoadGeneration();
    currentLessonIdRef.current = null;
    setCurrentLessonId(null);
    setLessonName('');
    setMediaFile(null);
    setMediaURL(null);
    setTranscriptText('');
    setCompletedSentences({});
    setIsStarted(false);
    setAppMode('normal');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleRenameLesson = async (id: string, newName: string) => {
    const lesson = await getLesson(id);
    if (lesson) {
      lesson.name = newName;
      bumpLessonUpdatedAt(lesson);
      await saveLesson(lesson);
      if (currentLessonId === id) {
        setLessonName(newName);
      }
      loadLessonsList();
    }
  };

  const handleUpdateItemLanguage = useCallback(
    async (id: string, language: 'en' | 'de'): Promise<void> => {
      const lesson = await getLesson(id);
      if (!lesson) return;
      if (lesson.language === language) return;
      lesson.language = language;
      bumpLessonUpdatedAt(lesson);
      await saveLesson(lesson);
      if (currentLessonId === id) {
        setRecognitionLang(language);
      }
      await loadLessonsList();
    },
    [currentLessonId, setRecognitionLang, loadLessonsList]
  );

  const handleDeletePermanently = async (id: string) => {
    await deleteLesson(id);
    if (currentLessonId === id) {
      handleNewLesson();
    }
    setLessonToDelete(null);
    await loadLessonsList();
  };

  const handleStartLearning = async () => {
    if (!mediaFile || !transcriptText) return;

    let lessonId = currentLessonId;
    const sentences = parseTranscript(transcriptText);
    const inferredMediaType: 'audio' | 'video' = mediaFile.type.startsWith('video/')
      ? 'video'
      : 'audio';

    if (!lessonId) {
      lessonId = Date.now().toString();
      const name = lessonName.trim() || mediaFile.name.replace(/\.[^/.]+$/, '');
      const now = Date.now();

      const newLesson: LessonRecord = {
        id: lessonId,
        type: 'audio',
        name,
        language: recognitionLang,
        mediaFile,
        mediaType: inferredMediaType,
        transcriptText,
        completedSentences: {},
        totalSentences: sentences.length,
        createdAt: now,
        lastAccessed: now,
        updatedAt: now,
      };

      await saveLesson(newLesson);
      currentLessonIdRef.current = lessonId;
      setCurrentLessonId(lessonId);
      setLessonName(name);
      loadLessonsList();
    } else {
      const existingLesson = await getLesson(lessonId);
      if (existingLesson) {
        existingLesson.mediaFile = mediaFile;
        existingLesson.mediaType = inferredMediaType;
        existingLesson.isTrashed = false;
        existingLesson.lastAccessed = Date.now();
        bumpLessonUpdatedAt(existingLesson);
        await saveLesson(existingLesson);
        loadLessonsList();
      }
    }

    setIsStarted(true);
  };

  const expandSidebarForItem = useCallback((kind: 'audio' | 'flashcard', language: string) => {
    const isDe = language === 'de';
    setExpandedSections((prev) => {
      if (kind === 'audio') {
        return {
          ...prev,
          lessons: true,
          'audio-en': !isDe,
          'audio-de': isDe,
        };
      }
      return {
        ...prev,
        decks: true,
        'flashcard-en': !isDe,
        'flashcard-de': isDe,
      };
    });
  }, []);

  const applyAppMode = async (mode: AppMode) => {
    appModeRef.current = mode;
    setAppMode(mode);
  };

  const handleTranscriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      setTranscriptText(text);
    }
  };

  const handleFlashcardUpload = async (text: string, name: string) => {
    if (!text.trim()) return;

    const all = await getAllLessons();
    const taken = all.filter((l) => l.type === 'flashcard' && !l.isTrashed).map((l) => l.name);
    const base = name.trim() || text.split('\n')[0].substring(0, 30) || 'Untitled deck';
    const finalName = uniquifyName(base, taken);

    const lessonId = Date.now().toString();
    const now = Date.now();

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const newLesson: LessonRecord = {
      id: lessonId,
      type: 'flashcard',
      name: finalName,
      language: recognitionLang,
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
        shuffledIndices: Array.from({ length: lines.length }, (_, i) => i),
      },
    };

    await saveLesson(newLesson);
    currentLessonIdRef.current = lessonId;
    setCurrentLessonId(lessonId);
    setLessonName(finalName);
    setAppMode('flashcard');
    setIsStarted(true);
    loadLessonsList();
  };

  return {
    transcriptText,
    setTranscriptText,
    appMode,
    setAppMode,
    dictationInputs,
    setDictationInputs,
    completedSentences,
    setCompletedSentences,
    isStarted,
    setIsStarted,
    lessonsList,
    isListLoading,
    currentLessonId,
    lessonName,
    setLessonName,
    isSidebarOpen,
    setIsSidebarOpen,
    lessonToDelete,
    setLessonToDelete,
    expandedSections,
    setExpandedSections,
    appModeRef,
    completedSentencesRef,
    transcript,
    handleLoadLesson,
    bumpLessonLoadGeneration,
    handleNewLesson,
    handleRenameLesson,
    handleDeletePermanently,
    handleStartLearning,
    handleModeChange: applyAppMode,
    expandSidebarForItem,
    handleTranscriptUpload,
    handleFlashcardUpload,
    loadLessonsList,
    prepareForLessonMediaClear,
    handleUpdateItemLanguage,
  };
}
