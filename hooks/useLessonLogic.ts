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

/** How many lessons the welcome screen offers under "Continue learning". */
const RECENT_LESSON_COUNT = 5;

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
  /** True between picking a lesson and its transcript/progress being in state. */
  const [isLessonLoading, setIsLessonLoading] = useState(false);
  /** Ids of the most recently opened lessons, newest first (the snapshot is ordered by lastAccessed). */
  const [recentLessonIds, setRecentLessonIds] = useState<string[]>([]);
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
            const recent = lessons.filter((l) => !l.isTrashed).slice(0, RECENT_LESSON_COUNT).map((l) => l.id);
            setRecentLessonIds((prev) => (prev.join() === recent.join() ? prev : recent));
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

  /**
   * Writes any debounced save that is still waiting, right now, for the lesson that is
   * loaded. Call before the loaded lesson changes: otherwise the effect cleanup cancels
   * the timer and the last edits (up to the debounce delay) are lost.
   */
  const flushPendingSaves = useCallback(() => {
    const lessonId = currentLessonIdRef.current;
    const progressPending = !!progressSaveTimeoutRef.current || !!dictationSaveTimeoutRef.current;
    const shadowingPending = !!shadowingSaveTimeoutRef.current;
    for (const ref of [progressSaveTimeoutRef, dictationSaveTimeoutRef, shadowingSaveTimeoutRef]) {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    }
    if (!lessonId) return;
    if (progressPending) {
      updateLessonProgressFirestore(lessonId, completedSentencesRef.current, {
        dictationInputs: dictationInputsRef.current,
      }).catch((error) => console.error('Failed to flush lesson progress', error));
    }
    if (shadowingPending) {
      updateShadowingProgressFirestore(lessonId, shadowingCompletedRef.current).catch((error) =>
        console.error('Failed to flush shadowing progress', error)
      );
    }
  }, []);

  // Leaving the page (tab close, app switch on mobile): best-effort flush.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushPendingSaves();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flushPendingSaves]);

  const handleLoadLesson = async (id: string) => {
    const myGen = ++lessonLoadGenerationRef.current;
    // Save the outgoing lesson, then stop all saving until the new lesson's state is in:
    // until then, state still holds the old lesson's progress.
    flushPendingSaves();
    setIsStarted(false);
    setIsLessonLoading(true);
    try {
      const lesson = await getLessonFirestore(id);
      if (myGen !== lessonLoadGenerationRef.current) return;
      if (lesson) {
        // Re-derive the download URL from `mediaPath` instead of trusting the
        // `mediaUrl` frozen in at upload time: that stored URL hardcodes the
        // bucket name and download token, both of which change when the app
        // moves to another Firebase project. See PLAN-project-split.md § 1.
        const hasMedia = !!(lesson.mediaPath || lesson.mediaUrl);
        const freshMediaUrl = hasMedia ? await resolveLessonMediaUrl(lesson) : null;
        if (myGen !== lessonLoadGenerationRef.current) return;
        // Everything below lands in one render, so no save effect ever sees the new
        // lesson id next to the previous lesson's progress.
        currentLessonIdRef.current = lesson.id;
        setCurrentLessonId(lesson.id);
        setMediaStoragePath(lesson.mediaPath ?? null);
        setLessonName(lesson.name);
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
        setIsLessonLoading(false);

        await touchLessonAccessedFirestore(lesson.id);
        if (myGen !== lessonLoadGenerationRef.current) return;
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }
    } catch (e) {
      console.error('Failed to load lesson', e);
    } finally {
      if (myGen === lessonLoadGenerationRef.current) setIsLessonLoading(false);
    }
  };

  const bumpLessonLoadGeneration = useCallback(() => {
    lessonLoadGenerationRef.current += 1;
  }, []);

  const handleNewLesson = () => {
    bumpLessonLoadGeneration();
    flushPendingSaves();
    setIsLessonLoading(false);
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
    if (currentLessonIdRef.current === id) {
      // Pending saves belong to the lesson being deleted; writing them would fail.
      for (const ref of [progressSaveTimeoutRef, dictationSaveTimeoutRef, shadowingSaveTimeoutRef]) {
        if (ref.current) {
          clearTimeout(ref.current);
          ref.current = null;
        }
      }
    }
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
    recentLessonIds,
    isListLoading,
    isLessonLoading,
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
  };
}
