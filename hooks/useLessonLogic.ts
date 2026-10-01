import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/auth/firebase-client';
import { AppMode, ExpandedSections } from '@/types';
import { DEFAULT_APP_MODE, DICTATION_SAVE_DEBOUNCE_MS, SAVE_PROGRESS_DELAY_MS } from '@/constants';
import { parseTranscript } from '@/lib/utils';
import { completionPercent, type LessonProgressRecord } from '@/lib/progress';
import {
  deleteLessonFirestore,
  getLessonFirestore,
  renameLessonFirestore,
  resolveLessonMediaUrl,
  subscribeLessonsFirestore,
  touchLessonAccessedFirestore,
  updateLessonProgressFirestore,
  updateShadowingProgressFirestore,
  type LessonRecord,
} from '@/lib/db';

const LESSON_ROW_COMPARE_KEYS = [
  'id',
  'name',
  'language',
  'folderId',
  'sortKey',
  'dictationProgress',
  'shadowingProgress',
  'totalSentences',
  'isTrashed',
  'hasMedia',
  'mediaType',
  'trashedAt',
] as const;

function lessonRowsShallowEqual(
  a: readonly Record<string, unknown>[],
  b: readonly Record<string, unknown>[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    for (const key of LESSON_ROW_COMPARE_KEYS) {
      if (x[key] !== y[key]) return false;
    }
  }
  return true;
}

export function useLessonLogic(
  setMediaFile: (file: File | null) => void,
  setMediaURL: (url: string | null) => void
) {
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [appMode, setAppMode] = useState<AppMode>(DEFAULT_APP_MODE);
  const [dictationInputs, setDictationInputs] = useState<Record<number, string>>({});
  const [completedSentences, setCompletedSentences] = useState<Record<number, boolean>>({});
  const [shadowingCompleted, setShadowingCompleted] = useState<Record<number, boolean>>({});
  /** Saved progress + last tab of the loaded lesson, as read at load time (for "Continue"). */
  const [loadedProgress, setLoadedProgress] = useState<{
    lessonId: string;
    progress: LessonProgressRecord;
    lastMode?: AppMode;
  } | null>(null);
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const currentLessonIdRef = useRef<string | null>(null);
  const lessonLoadGenerationRef = useRef(0);

  const [lessonsList, setLessonsList] = useState<
    Array<{
      id: string;
      name: string;
      language: string;
      dictationProgress: number;
      shadowingProgress: number;
      totalSentences: number;
      isTrashed: boolean;
      hasMedia: boolean;
      mediaType: 'audio' | 'video';
      trashedAt?: number;
    }>
  >([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  /** Firebase Storage path of the loaded lesson's media (for the shadowing-pattern Cloud Function). */
  const [mediaStoragePath, setMediaStoragePath] = useState<string | null>(null);
  const [lessonName, setLessonName] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    lessons: true,
    trash: false,
  });

  const appModeRef = useRef<AppMode>(appMode);
  const completedSentencesRef = useRef<Record<number, boolean>>(completedSentences);
  const dictationInputsRef = useRef<Record<number, string>>({});
  const shadowingCompletedRef = useRef<Record<number, boolean>>({});

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    completedSentencesRef.current = completedSentences;
  }, [completedSentences]);

  useEffect(() => {
    dictationInputsRef.current = dictationInputs;
  }, [dictationInputs]);

  useEffect(() => {
    shadowingCompletedRef.current = shadowingCompleted;
  }, [shadowingCompleted]);

  const transcript = useMemo(() => parseTranscript(transcriptText), [transcriptText]);

  const mapLessonsToRows = useCallback((lessons: LessonRecord[]) => {
    const rows = lessons.map((l) => {
      return {
        id: l.id,
        name: l.name,
        language: 'en',
        folderId: l.folderId ?? null,
        sortKey: l.sortKey,
        dictationProgress: completionPercent(l.completedSentences, l.totalSentences),
        shadowingProgress: completionPercent(l.progress?.shadowing?.completed, l.totalSentences),
        totalSentences: l.totalSentences ?? 0,
        isTrashed: !!l.isTrashed,
        hasMedia: !!(l.mediaUrl || l.mediaPath || l.mediaFile),
        mediaType: l.mediaType ?? 'audio',
        trashedAt: l.trashedAt,
      };
    });
    rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return rows;
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let listUnsubscribe: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      listUnsubscribe?.();
      listUnsubscribe = null;

      if (!user) {
        setLessonsList([]);
        setIsListLoading(false);
        return;
      }

      setIsListLoading(true);
      let didReceiveFirstSnapshot = false;
      try {
        listUnsubscribe = subscribeLessonsFirestore(
          (lessons) => {
            const next = mapLessonsToRows(lessons);
            setLessonsList((prev) => (lessonRowsShallowEqual(prev, next) ? prev : next));
            if (!didReceiveFirstSnapshot) {
              didReceiveFirstSnapshot = true;
              setIsListLoading(false);
            }
          },
          (error) => {
            console.error('Failed to subscribe lessons', error);
            if (!didReceiveFirstSnapshot) {
              didReceiveFirstSnapshot = true;
              setIsListLoading(false);
            }
          }
        );
      } catch (error) {
        console.error('Failed to initialize lessons subscription', error);
        setIsListLoading(false);
      }
    });

    return () => {
      unsubAuth();
      listUnsubscribe?.();
    };
  }, [mapLessonsToRows]);

  const progressSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dictationSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      updateLessonProgressFirestore(currentLessonId, completedSentencesRef.current).catch((error) => {
        console.error('Failed to persist lesson progress', error);
      });
    }, SAVE_PROGRESS_DELAY_MS);
    return () => {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
        progressSaveTimeoutRef.current = null;
      }
    };
  }, [completedSentences, currentLessonId, isStarted]);

  useEffect(() => {
    if (!currentLessonId || !isStarted) {
      if (dictationSaveTimeoutRef.current) {
        clearTimeout(dictationSaveTimeoutRef.current);
        dictationSaveTimeoutRef.current = null;
      }
      return;
    }
    if (dictationSaveTimeoutRef.current) {
      clearTimeout(dictationSaveTimeoutRef.current);
      dictationSaveTimeoutRef.current = null;
    }
    dictationSaveTimeoutRef.current = setTimeout(() => {
      dictationSaveTimeoutRef.current = null;
      updateLessonProgressFirestore(currentLessonId, completedSentencesRef.current, {
        dictationInputs: dictationInputsRef.current,
      }).catch((error) => {
        console.error('Failed to persist dictation draft', error);
      });
    }, DICTATION_SAVE_DEBOUNCE_MS);
    return () => {
      if (dictationSaveTimeoutRef.current) {
        clearTimeout(dictationSaveTimeoutRef.current);
        dictationSaveTimeoutRef.current = null;
      }
    };
  }, [dictationInputs, currentLessonId, isStarted]);

  const shadowingSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (shadowingSaveTimeoutRef.current) {
      clearTimeout(shadowingSaveTimeoutRef.current);
      shadowingSaveTimeoutRef.current = null;
    }
    if (!currentLessonId || !isStarted) return;
    shadowingSaveTimeoutRef.current = setTimeout(() => {
      shadowingSaveTimeoutRef.current = null;
      updateShadowingProgressFirestore(currentLessonId, shadowingCompletedRef.current).catch((error) => {
        console.error('Failed to persist shadowing progress', error);
      });
    }, SAVE_PROGRESS_DELAY_MS);
    return () => {
      if (shadowingSaveTimeoutRef.current) {
        clearTimeout(shadowingSaveTimeoutRef.current);
        shadowingSaveTimeoutRef.current = null;
      }
    };
  }, [shadowingCompleted, currentLessonId, isStarted]);

  /** Cancel debounced progress save and persist latest progress so a later put cannot resurrect cleared audio. */
  const prepareForLessonMediaClear = useCallback(
    async (lessonId: string) => {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
        progressSaveTimeoutRef.current = null;
      }
      if (dictationSaveTimeoutRef.current) {
        clearTimeout(dictationSaveTimeoutRef.current);
        dictationSaveTimeoutRef.current = null;
      }
      if (shadowingSaveTimeoutRef.current) {
        clearTimeout(shadowingSaveTimeoutRef.current);
        shadowingSaveTimeoutRef.current = null;
      }
      const active = currentLessonIdRef.current === lessonId || currentLessonId === lessonId;
      if (active && isStarted) {
        await updateLessonProgressFirestore(lessonId, completedSentencesRef.current, {
          dictationInputs: dictationInputsRef.current,
        });
      }
    },
    [currentLessonId, isStarted]
  );

  const handleLoadLesson = async (id: string) => {
    const myGen = ++lessonLoadGenerationRef.current;
    try {
      const lesson = await getLessonFirestore(id);
      if (myGen !== lessonLoadGenerationRef.current) return;
      if (lesson) {
        currentLessonIdRef.current = lesson.id;
        setCurrentLessonId(lesson.id);
        setMediaStoragePath(lesson.mediaPath ?? null);
        setLessonName(lesson.name);
        // Re-derive the download URL from `mediaPath` instead of trusting the
        // `mediaUrl` frozen in at upload time: that stored URL hardcodes the
        // bucket name and download token, both of which change when the app
        // moves to another Firebase project. See PLAN-project-split.md § 1.
        const hasMedia = !!(lesson.mediaPath || lesson.mediaUrl);
        const freshMediaUrl = hasMedia ? await resolveLessonMediaUrl(lesson) : null;
        if (myGen !== lessonLoadGenerationRef.current) return;
        setMediaFile(null);
        setMediaURL(freshMediaUrl);

        setTranscriptText(lesson.transcriptText);
        setCompletedSentences(lesson.completedSentences || {});
        setShadowingCompleted(lesson.progress?.shadowing?.completed ?? {});
        setLoadedProgress({ lessonId: lesson.id, progress: lesson.progress ?? {}, lastMode: lesson.lastMode });
        const rawDraft = lesson.dictationInputs ?? {};
        setDictationInputs(
          Object.fromEntries(
            Object.entries(rawDraft).map(([k, v]) => [Number(k), v])
          ) as Record<number, string>
        );
        const hasTranscript = !!(lesson.transcriptText && lesson.transcriptText.trim());
        setIsStarted(!!freshMediaUrl || hasTranscript);
        setAppMode('listen');

        await touchLessonAccessedFirestore(lesson.id);
        if (myGen !== lessonLoadGenerationRef.current) return;
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
    setMediaStoragePath(null);
    setLessonName('');
    setMediaFile(null);
    setMediaURL(null);
    setTranscriptText('');
    setCompletedSentences({});
    setShadowingCompleted({});
    setLoadedProgress(null);
    setDictationInputs({});
    setIsStarted(false);
    setAppMode('listen');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleRenameLesson = async (id: string, newName: string) => {
    await renameLessonFirestore(id, newName);
    if (currentLessonId === id) {
      setLessonName(newName);
    }
  };

  const handleDeletePermanently = async (id: string) => {
    await deleteLessonFirestore(id);
    if (currentLessonId === id) {
      handleNewLesson();
    }
    setLessonToDelete(null);
  };

  const expandSidebarForItem = useCallback(() => {
    setExpandedSections((prev) => ({ ...prev, lessons: true }));
  }, []);

  const applyAppMode = async (mode: AppMode) => {
    appModeRef.current = mode;
    setAppMode(mode);
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
    shadowingCompleted,
    setShadowingCompleted,
    shadowingCompletedRef,
    loadedProgress,
    isStarted,
    setIsStarted,
    lessonsList,
    isListLoading,
    currentLessonId,
    mediaStoragePath,
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
    handleModeChange: applyAppMode,
    expandSidebarForItem,
    prepareForLessonMediaClear,
  };
}
