'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { normalizeDictationTarget } from '@/lib/utils';
import { patchFlashcardCompletionModalShownFirestore, restoreLessonFirestore, trashLessonFirestore } from '@/lib/db';
import { LoginView } from '@/components/auth/LoginView';
import { Sidebar } from '@/components/Sidebar';
import { NewLessonModal } from '@/components/NewLessonModal';
import { NewDeckModal } from '@/components/NewDeckModal';
import { CleanupModal } from '@/components/CleanupModal';
import { AppHeader } from '@/components/AppHeader';
import { DeleteLessonModal } from '@/components/DeleteLessonModal';
import { DeleteManyModal } from '@/components/DeleteManyModal';
import { useMediaPlayer } from '@/hooks/useMediaPlayer';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useLessonLogic } from '@/hooks/useLessonLogic';
import { useFolders } from '@/hooks/useFolders';
import { useLessonCreateFlow } from '@/hooks/useLessonCreateFlow';
import { useDictationCompletionModal } from '@/hooks/useDictationCompletionModal';
import { useLessonPlaybackLoop } from '@/hooks/useLessonPlaybackLoop';
import { useAutoScrollActiveSentence } from '@/hooks/useAutoScrollActiveSentence';
import { useGlobalPlaybackShortcuts } from '@/hooks/useGlobalPlaybackShortcuts';
import { useHeaderItemMenuClickOutside } from '@/hooks/useHeaderItemMenu';
import { useMobileViewport } from '@/hooks/use-mobile';
import { LessonItem, DeckItem, Sentence, type AppMode } from '@/types';
import { LessonView } from '@/components/LessonView';
import { FlashcardViewer } from '@/components/FlashcardViewer';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { Toast } from '@/components/Toast';
import { getFirebaseAuth } from '@/lib/auth/firebase-client';
import { hasAllowlistConfig, isAllowedUser } from '@/lib/auth/allowed-user';
import { buildItemSearchString, parseItemFromSearch } from '@/lib/item-url';
import { SENTENCE_PRE_ROLL_SECONDS } from '@/constants';

function pushItemHistoryState(
  row: {
    id: string;
    name: string;
    kind: 'audio' | 'flashcard';
  }
) {
  const qs = buildItemSearchString(row);
  const url = new URL(window.location.href);
  const cur = url.search.startsWith('?') ? url.search.slice(1) : url.search;
  if (cur === qs) return;
  const itemType = row.kind === 'flashcard' ? 'deck' : 'lesson';
  window.history.pushState({ itemId: row.id, itemType }, '', `${url.pathname}?${qs}`);
}

export default function NodaApp() {
  const [isMounted, setIsMounted] = useState(false);
  const viewport = useMobileViewport();
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthorized'>('loading');

  const [uploadMode, setUploadMode] = useState<'idle' | 'lesson' | 'deck'>('idle');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const [trashDeleteIds, setTrashDeleteIds] = useState<string[] | null>(null);

  const [headerItemMenuOpen, setHeaderItemMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const [hideCaptions, setHideCaptions] = useState(false);

  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    type: 'lesson' | 'deck';
    data: LessonItem | DeckItem;
  } | null>(null);

  /** Bumps when a flashcard row is selected so reopening the same deck remounts the viewer (cleanup modal can show again). */
  const [deckOpenGeneration, setDeckOpenGeneration] = useState(0);
  /** Bumps after persisting deck-only metadata so FlashcardViewer reloads hydrate (e.g. completionModalShown). */
  const [deckHydrateBump, setDeckHydrateBump] = useState(0);

  const urlHydratedRef = useRef(false);
  const mobileSidebarInitialCloseRef = useRef(false);

  const {
    mediaFile, setMediaFile, mediaURL, setMediaURL,
    duration, setDuration, currentTime, setCurrentTime,
    isPlaying, setIsPlaying, playbackRate, loopMode, setLoopMode,
    mediaRef, loopTimeoutRef, isLoopDelayingRef, loopModeRef,
    togglePlayPause, handleSeek, changeSpeed, toggleLoopMode
  } = useMediaPlayer();

  const {
    isRecording, recognitionLang, setRecognitionLang,
    spokenResults, recognitionErrors, toggleRecording, handleSimulateSuccess
  } = useSpeechRecognition();

  const {
    appMode,
    dictationInputs, setDictationInputs, completedSentences, setCompletedSentences,
    isStarted,
    lessonsList, isListLoading,
    isSidebarOpen, setIsSidebarOpen, lessonToDelete, setLessonToDelete,
    expandedSections, setExpandedSections,
    appModeRef, completedSentencesRef, transcript,
    handleLoadLesson, bumpLessonLoadGeneration, handleNewLesson, handleRenameLesson, handleDeletePermanently,
    handleModeChange: applyLessonAppMode,
    expandSidebarForItem,
    prepareForLessonMediaClear, handleUpdateItemLanguage
  } = useLessonLogic(mediaFile, setMediaFile, setMediaURL, recognitionLang, setRecognitionLang);

  const {
    folders,
    localOverrides,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    reorderFolder,
    moveItem,
    reorderItem,
  } = useFolders();

  const effectiveFolders = useMemo(() => {
    const existingIds = new Set(folders.map((f) => f.id));
    const merged = folders.map((f) => ({ ...f, ...(localOverrides.folders[f.id] ?? {}) }));
    for (const [id, ov] of Object.entries(localOverrides.folders)) {
      if (!existingIds.has(id) && ov.id) {
        merged.push(ov as import('@/types').SidebarFolder);
      }
    }
    return merged;
  }, [folders, localOverrides.folders]);

  const folderLabelById = useMemo(() => {
    const byId = new Map<string, { name: string; parentId: string | null; language: string }>();
    for (const f of effectiveFolders) {
      byId.set(f.id, { name: f.name, parentId: f.parentId ?? null, language: f.language });
    }
    const buildPath = (id: string): string => {
      const parts: string[] = [];
      let cur: string | null = id;
      let guard = 0;
      while (cur && guard < 4) {
        guard += 1;
        const node = byId.get(cur);
        if (!node) break;
        parts.push(node.name);
        cur = node.parentId;
      }
      parts.reverse();
      const lang = byId.get(id)?.language?.toUpperCase() ?? '??';
      return `${lang} . ${parts.join(' . ')}`;
    };
    const out = new Map<string, string>();
    for (const id of byId.keys()) out.set(id, buildPath(id));
    return out;
  }, [effectiveFolders]);

  const lessonsListEffective = useMemo(
    () => lessonsList.map((row) => ({ ...row, ...(localOverrides.items[row.id] ?? {}) })),
    [lessonsList, localOverrides.items]
  );

  const selectedItemRef = useRef(selectedItem);
  selectedItemRef.current = selectedItem;

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const transcriptScrollByItemIdRef = useRef<Map<string, number>>(new Map());
  const dictationReplayOnceRef = useRef<{ sentenceId: number; end: number } | null>(null);

  const saveTranscriptScrollForCurrentLesson = useCallback(() => {
    const cur = selectedItemRef.current;
    if (cur?.type === 'lesson' && scrollContainerRef.current) {
      transcriptScrollByItemIdRef.current.set(cur.id, scrollContainerRef.current.scrollTop);
    }
  }, []);

  const handleModeChange = useCallback(
    async (mode: AppMode) => {
      if (selectedItemRef.current?.type === 'lesson') {
        const el = mediaRef.current;
        if (el) {
          el.pause();
          el.currentTime = 0;
        }
        setCurrentTime(0);
        setIsPlaying(false);
      }
      await applyLessonAppMode(mode);
    },
    [applyLessonAppMode, mediaRef, setCurrentTime, setIsPlaying]
  );

  useEffect(() => {
    if (!viewport.decided || !viewport.isMobile || mobileSidebarInitialCloseRef.current) return;
    mobileSidebarInitialCloseRef.current = true;
    setIsSidebarOpen(false);
  }, [viewport.decided, viewport.isMobile, setIsSidebarOpen]);

  const lessonsListRef = useRef<typeof lessonsList>([]);
  lessonsListRef.current = lessonsListEffective;

  /** Read from ref so async callbacks (e.g. FileReader in modals) always see the latest list after delete/reload. */
  const getTakenAudioLessonNames = useCallback(
    () =>
      lessonsListRef.current
        .filter((l) => l.kind === 'audio' && !l.isTrashed)
        .map((l) => l.name),
    []
  );
  const getTakenFlashcardDeckNames = useCallback(
    () =>
      lessonsListRef.current
        .filter((l) => l.kind === 'flashcard' && !l.isTrashed)
        .map((l) => l.name),
    []
  );

  const onChangeItemLanguage = useCallback(
    async (id: string, lang: 'en' | 'de') => {
      await handleUpdateItemLanguage(id, lang);
      setSelectedItem((prev) => {
        if (!prev || prev.id !== id) return prev;
        if (prev.type === 'lesson') {
          return { ...prev, data: { ...(prev.data as LessonItem), language: lang } };
        }
        return { ...prev, data: { ...(prev.data as DeckItem), language: lang } };
      });
    },
    [handleUpdateItemLanguage]
  );

  const { handleLessonCreated, handleDeckCreated } = useLessonCreateFlow(
    setSelectedItem,
    handleLoadLesson,
    handleModeChange,
    setUploadMode,
    setToast,
    getTakenAudioLessonNames,
    getTakenFlashcardDeckNames,
    expandSidebarForItem
  );

  const handleNewLessonWrapper = useCallback(() => {
    saveTranscriptScrollForCurrentLesson();
    handleNewLesson();
    setSelectedItem(null);
  }, [handleNewLesson, saveTranscriptScrollForCurrentLesson]);

  const openNewLessonModal = () => {
    handleNewLessonWrapper();
    setUploadMode('lesson');
  };

  const openNewDeckModal = () => {
    handleNewLessonWrapper();
    setUploadMode('deck');
  };

  const closeUploadModal = () => {
    setUploadMode('idle');
  };

  const applySelectionFromRow = useCallback(
    (
      row: {
        id: string;
        name: string;
        language: string;
        kind: 'audio' | 'flashcard';
        progress: number;
        totalSentences: number;
        hasMedia: boolean;
        mediaType: 'audio' | 'video';
        folderId?: string | null;
      },
      opts?: { pushHistory?: boolean }
    ) => {
      saveTranscriptScrollForCurrentLesson();
      const pushHistory = opts?.pushHistory !== false;
      if (row.kind === 'flashcard') {
        const deck: DeckItem = {
          id: row.id,
          name: row.name,
          language: row.language as 'en' | 'de' | 'mixed',
          cardCount: row.totalSentences,
          progress: row.progress,
          type: 'deck',
        };
        expandSidebarForItem('flashcard', row.language);
        if (row.folderId) {
          setExpandedSections((prev) => {
            const next = { ...prev, [`folder:${row.folderId}`]: true };
            const parentId = effectiveFolders.find((f) => f.id === row.folderId)?.parentId;
            if (parentId) next[`folder:${parentId}`] = true;
            return next;
          });
        }
        setDeckOpenGeneration((g) => g + 1);
        setSelectedItem({ id: row.id, type: 'deck', data: deck });
        void handleLoadLesson(row.id);
        if (pushHistory) pushItemHistoryState(row);
        return;
      }

      const lesson: LessonItem = {
        id: row.id,
        name: row.name,
        language: row.language as 'en' | 'de',
        progress: row.progress,
        hasMedia: row.hasMedia,
        mediaType: row.mediaType ?? 'audio',
        type: 'lesson',
      };
      expandSidebarForItem('audio', row.language);
      if (row.folderId) {
        setExpandedSections((prev) => {
          const next = { ...prev, [`folder:${row.folderId}`]: true };
          const parentId = effectiveFolders.find((f) => f.id === row.folderId)?.parentId;
          if (parentId) next[`folder:${parentId}`] = true;
          return next;
        });
      }
      setSelectedItem({ id: row.id, type: 'lesson', data: lesson });

      void handleLoadLesson(row.id);
      void handleModeChange('normal');
      if (pushHistory) pushItemHistoryState(row);
    },
    [
      expandSidebarForItem,
      handleLoadLesson,
      handleModeChange,
      saveTranscriptScrollForCurrentLesson,
      effectiveFolders,
      setExpandedSections,
    ]
  );

  const handleItemSelect = (item: LessonItem | DeckItem) => {
    const row = lessonsListEffective.find((l) => l.id === item.id);
    if (!row || row.isTrashed) return;
    applySelectionFromRow(row, { pushHistory: true });
  };

  const handleTrashItem = async (id: string) => {
    try {
      await trashLessonFirestore(id);
      if (selectedItem?.id === id) {
        handleNewLessonWrapper();
      }
    } catch {
      setToast({ message: 'Could not move item to trash.', type: 'error' });
    }
  };

  const handleRestoreItem = async (id: string) => {
    try {
      await restoreLessonFirestore(id);
    } catch {
      setToast({ message: 'Could not restore item.', type: 'error' });
    }
  };

  // Revoke blob URLs whenever mediaURL changes or the app unmounts. handleLoadLesson / handleNewLesson
  // and other paths call setMediaURL without revoking the previous URL; handleMediaUpload revokes in its
  // setter - a second revoke on the same URL is harmless (no-op per spec).
  useEffect(() => {
    return () => {
      if (mediaURL) URL.revokeObjectURL(mediaURL);
    };
  }, [mediaURL]);

  useEffect(() => {
    setHeaderItemMenuOpen(false);
  }, [selectedItem?.id]);

  useEffect(() => {
    setHideCaptions(false);
  }, [selectedItem?.id]);

  useEffect(() => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    isLoopDelayingRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loopTimeoutRef/isLoopDelayingRef are stable refs
  }, [appMode]);

  useEffect(() => {
    const id = selectedItem?.id;
    if (!id) return;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelector(`[data-sidebar-item="${id}"]`)?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedItem?.id, lessonsList]);

  useEffect(() => {
    if (isListLoading) return;
    if (urlHydratedRef.current) return;
    urlHydratedRef.current = true;
    const parsed = parseItemFromSearch(window.location.search);
    if (!parsed) return;
    const id = parsed.id;
    const row = lessonsListRef.current.find((l) => l.id === id && !l.isTrashed);
    if (!row) return;
    applySelectionFromRow(row, { pushHistory: false });
    const qs = buildItemSearchString(row);
    window.history.replaceState(
      { itemId: row.id, itemType: row.kind === 'flashcard' ? 'deck' : 'lesson' },
      '',
      `${window.location.pathname}?${qs}`
    );
  }, [isListLoading, lessonsList, applySelectionFromRow]);

  useEffect(() => {
    const onPop = () => {
      const st = window.history.state as { itemId?: string; itemType?: string } | null;
      const hid = st?.itemId;
      if (!hid) {
        handleNewLessonWrapper();
        setSelectedItem(null);
        return;
      }
      const row = lessonsListRef.current.find((l) => l.id === hid && !l.isTrashed);
      if (row) {
        applySelectionFromRow(row, { pushHistory: false });
      } else {
        handleNewLessonWrapper();
        setSelectedItem(null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applySelectionFromRow, handleNewLessonWrapper]);

  useHeaderItemMenuClickOutside(
    headerItemMenuOpen,
    setHeaderItemMenuOpen,
    headerMenuRef
  );

  const handleHeaderRenameCurrent = () => {
    if (!selectedItem) return;
    const cur = selectedItem.data.name;
    const next = window.prompt('Rename to:', cur);
    if (next == null) return;
    const t = next.trim();
    if (!t || t === cur) return;
    void handleRenameLesson(selectedItem.id, t);
    setSelectedItem((prev) =>
      prev && prev.id === selectedItem.id
        ? {
            ...prev,
            data:
              prev.type === 'lesson'
                ? { ...(prev.data as LessonItem), name: t }
                : { ...(prev.data as DeckItem), name: t },
          }
        : prev
    );
    setHeaderItemMenuOpen(false);
  };

  const activeSentenceRef = useRef<Sentence | null>(null);
  const lastScrolledIndexRef = useRef<number>(-1);

  const togglePlayPauseLesson = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    const mode = appModeRef.current;
    if (
      media.paused &&
      (mode === 'shadowing' || mode === 'dictation') &&
      activeSentenceRef.current
    ) {
      const s = activeSentenceRef.current;
      if (media.currentTime >= s.end - 0.08) {
        media.currentTime = s.start;
        setCurrentTime(s.start);
        lastScrolledIndexRef.current = -1;
        if (loopTimeoutRef.current) {
          clearTimeout(loopTimeoutRef.current);
          loopTimeoutRef.current = null;
        }
        isLoopDelayingRef.current = false;
      }
    }
    togglePlayPause();
  }, [togglePlayPause, setCurrentTime, mediaRef, appModeRef, activeSentenceRef, loopTimeoutRef, isLoopDelayingRef]);

  const {
    showCleanupModal,
    setShowCleanupModal,
    cleanupModalVariant,
    setCleanupModalVariant,
  } = useDictationCompletionModal(selectedItem, isStarted, transcript, appMode, completedSentences);

  const handleCleanupKeep = useCallback(async () => {
    if (cleanupModalVariant === 'deck' && selectedItem?.type === 'deck') {
      try {
        await patchFlashcardCompletionModalShownFirestore(selectedItem.id, true);
        setDeckHydrateBump((v) => v + 1);
      } catch {
        setToast({ message: 'Could not save deck preference.', type: 'error' });
      }
    }
    setShowCleanupModal(false);
  }, [cleanupModalVariant, selectedItem, setShowCleanupModal, setToast]);

  useEffect(() => {
    setIsMounted(true);
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!hasAllowlistConfig()) {
        setAuthState(user ? 'authenticated' : 'unauthorized');
        return;
      }
      if (!user) {
        setAuthState('unauthorized');
        return;
      }
      if (isAllowedUser(user)) {
        setAuthState('authenticated');
        return;
      }
      await signOut(auth);
      setAuthState('unauthorized');
    });
    return () => unsub();
  }, []);

  useGlobalPlaybackShortcuts(
    selectedItem?.type,
    appMode,
    selectedItem?.type === 'lesson' ? () => setHideCaptions((v) => !v) : undefined,
    handleModeChange,
    togglePlayPauseLesson,
    toggleLoopMode,
    loopTimeoutRef,
    isLoopDelayingRef,
    mediaRef,
    activeSentenceRef,
    dictationReplayOnceRef
  );

  useLessonPlaybackLoop(
    isPlaying,
    transcript,
    setCurrentTime,
    mediaRef,
    loopTimeoutRef,
    isLoopDelayingRef,
    loopModeRef,
    appModeRef,
    completedSentencesRef,
    activeSentenceRef,
    dictationReplayOnceRef
  );

  useAutoScrollActiveSentence(currentTime, transcript, scrollContainerRef, lastScrolledIndexRef);

  useLayoutEffect(() => {
    if (selectedItem?.type !== 'lesson' || transcript.length === 0) return;
    const id = selectedItem.id;
    const saved = transcriptScrollByItemIdRef.current.get(id);
    if (saved === undefined) return;
    lastScrolledIndexRef.current = -1;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = saved;
    }
  }, [selectedItem?.id, selectedItem?.type, transcript.length]);

  const handleSkip = (sentence: Sentence) => {
    setCompletedSentences((prev) => {
      const next = { ...prev, [sentence.id]: true };
      completedSentencesRef.current = next;
      return next;
    });
    if (mediaRef.current) {
      mediaRef.current.currentTime = sentence.end + 0.03;
      mediaRef.current.play().catch(() => {});
    }
  };

  const handleSentenceClick = (sentence: Sentence) => {
    if (mediaRef.current) {
      const seekTarget = Math.max(0, sentence.start - SENTENCE_PRE_ROLL_SECONDS);
      mediaRef.current.currentTime = seekTarget;
      setCurrentTime(seekTarget);
      lastScrolledIndexRef.current = -1;
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      isLoopDelayingRef.current = false;
      if (mediaRef.current.paused) {
        mediaRef.current.play().catch(() => {});
      }
    }
  };

  const handleDictationChange = (sentence: Sentence, val: string) => {
    const normalized = normalizeDictationTarget(val, { preserveTrailingSpace: true });
    setDictationInputs((prev) => ({ ...prev, [sentence.id]: normalized }));

    const targetNorm = normalizeDictationTarget(sentence.text);
    if (
      targetNorm.length > 0 &&
      normalized.length === targetNorm.length &&
      normalized === targetNorm
    ) {
      setCompletedSentences((prev) => {
        const next = { ...prev, [sentence.id]: true };
        completedSentencesRef.current = next;
        return next;
      });

      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        isLoopDelayingRef.current = false;
      }
      // After completion, stay on the current sentence. Advancing happens only on Enter.
    }
  };

  const handleDictationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sentence: Sentence) => {
    if (e.key === 'Enter') {
      const isCompleted = !!completedSentencesRef.current[sentence.id];
      if (!isCompleted) return;
      e.preventDefault();

      const idx = transcript.findIndex((s) => s.id === sentence.id);
      const nextSentence = idx >= 0 && idx < transcript.length - 1 ? transcript[idx + 1] : null;

      if (mediaRef.current) {
        if (nextSentence) {
          mediaRef.current.currentTime = nextSentence.start;
          setCurrentTime(nextSentence.start);
          lastScrolledIndexRef.current = -1;
          mediaRef.current.play().catch(() => {});
        } else {
          // last sentence: park at end
          mediaRef.current.currentTime = sentence.end + 0.03;
          setCurrentTime(sentence.end + 0.05);
          mediaRef.current.pause();
          setIsPlaying(false);
        }
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const t = normalizeDictationTarget(sentence.text);
      const cur = normalizeDictationTarget(dictationInputs[sentence.id] || '', {
        preserveTrailingSpace: true,
      });
      let i = 0;
      while (i < cur.length && i < t.length && cur[i] === t[i]) i++;
      if (i >= t.length) return;
      const newVal = t.slice(0, i + 1);
      handleDictationChange(sentence, newVal);
    } else if (e.key === 'Control') {
      e.preventDefault();
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        isLoopDelayingRef.current = false;
      }
      if (mediaRef.current) {
        // Dictation: replay just this sentence (even if already completed).
        dictationReplayOnceRef.current = { sentenceId: sentence.id, end: sentence.end };
        mediaRef.current.currentTime = sentence.start;
        mediaRef.current.play().catch(() => {});
      }
    }
  };

  const handleDictationRetry = (sentence: Sentence) => {
    setCompletedSentences((prev) => {
      const next = { ...prev };
      delete next[sentence.id];
      return next;
    });
    setDictationInputs((prev) => {
      const next = { ...prev };
      delete next[sentence.id];
      return next;
    });
  };

  const handleResetDictationProgress = () => {
    setDictationInputs({});
    setCompletedSentences({});
    completedSentencesRef.current = {};
  };

  const handleLogout = async () => {
    await signOut(getFirebaseAuth());
    setAuthState('unauthorized');
    window.history.replaceState({}, '', window.location.pathname);
  };

  if (!isMounted) {
    return null;
  }

  if (!viewport.decided) {
    return null;
  }

  if (authState === 'loading') {
    return null;
  }

  if (authState !== 'authenticated') {
    return <LoginView appName="noda" subtitle="Dictation, listening, and shadowing" />;
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden selection:bg-emerald-500/30">
      <div>
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={setIsSidebarOpen}
          lessons={lessonsListEffective}
          folders={effectiveFolders}
          folderActions={{
            createFolder,
            renameFolder,
            deleteFolder,
            moveFolder,
            reorderFolder,
            moveItem,
            reorderItem,
          }}
          isListLoading={isListLoading}
          selectedItemId={selectedItem?.id}
          expandedSections={expandedSections}
          onItemSelect={handleItemSelect}
          onNewLesson={openNewLessonModal}
          onNewDeck={openNewDeckModal}
          onTrashItem={handleTrashItem}
          onRestoreItem={handleRestoreItem}
          onDeleteForever={setLessonToDelete}
          onDeleteForeverMany={(ids) => setTrashDeleteIds(ids)}
          onRenameLesson={handleRenameLesson}
          onChangeLanguage={onChangeItemLanguage}
          onLogout={() => void handleLogout()}
          onToggleSection={(section, expanded) =>
            setExpandedSections((prev) => ({ ...prev, [section]: expanded }))
          }
          isMobile={viewport.isMobile}
        />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="max-w-4xl mx-auto w-full p-3 md:p-4 flex flex-col h-full min-h-0">
          <AppHeader
            isSidebarOpen={isSidebarOpen}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            isMobile={viewport.isMobile}
            selectedItem={selectedItem}
            appMode={appMode}
            onModeChange={handleModeChange}
            headerItemMenuOpen={headerItemMenuOpen}
            setHeaderItemMenuOpen={setHeaderItemMenuOpen}
            headerMenuRef={headerMenuRef}
            onRenameCurrent={handleHeaderRenameCurrent}
            onDeleteCurrent={() => {
              const id = selectedItem?.id;
              if (id) void handleTrashItem(id);
              setHeaderItemMenuOpen(false);
            }}
          />

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {!selectedItem && uploadMode === 'idle' && (
              <WelcomeScreen onNewLesson={openNewLessonModal} onNewDeck={openNewDeckModal} />
            )}

            {uploadMode === 'lesson' && (
              <NewLessonModal
                onClose={closeUploadModal}
                onSubmit={handleLessonCreated}
                getTakenAudioLessonNames={getTakenAudioLessonNames}
                folders={effectiveFolders
                  .filter((f) => f.kind === 'audio')
                  .filter((f) => f.language === 'de' || f.language === 'en')
                  .map((f) => ({ id: f.id, name: folderLabelById.get(f.id) ?? `${f.language.toUpperCase()} . ${f.name}` }))}
                onNotify={(message, type) => setToast({ message, type })}
              />
            )}

            {uploadMode === 'deck' && (
              <NewDeckModal
                onClose={closeUploadModal}
                onSubmit={handleDeckCreated}
                getTakenFlashcardDeckNames={getTakenFlashcardDeckNames}
                folders={effectiveFolders
                  .filter((f) => f.kind === 'flashcard')
                  .filter((f) => f.language === 'de' || f.language === 'en')
                  .map((f) => ({ id: f.id, name: folderLabelById.get(f.id) ?? `${f.language.toUpperCase()} . ${f.name}` }))}
              />
            )}

            {selectedItem?.type === 'lesson' && (
              <div key={`${selectedItem.id}-${appMode}`} className="mode-content-fade flex flex-col flex-1 min-h-0">
                <LessonView
                  lesson={selectedItem.data as LessonItem}
                  mode={appMode}
                  isPlaying={isPlaying}
                  duration={duration}
                  currentTime={currentTime}
                  playbackRate={playbackRate}
                  loopMode={loopMode}
                  onPlayPause={togglePlayPauseLesson}
                  onSeek={handleSeek}
                  onSpeedChange={changeSpeed}
                  onLoopModeChange={toggleLoopMode}
                  transcript={transcript}
                  dictationInputs={dictationInputs}
                  completedSentences={completedSentences}
                  isRecording={isRecording}
                  spokenResults={spokenResults}
                  recognitionErrors={recognitionErrors}
                  scrollContainerRef={scrollContainerRef}
                  onSentenceClick={handleSentenceClick}
                  onDictationChange={handleDictationChange}
                  onDictationKeyDown={handleDictationKeyDown}
                  onDictationRetry={handleDictationRetry}
                  onToggleRecording={toggleRecording}
                  onSkip={handleSkip}
                  onSimulateSuccess={handleSimulateSuccess}
                  onResetDictation={handleResetDictationProgress}
                  hideCaptions={hideCaptions}
                  onToggleHideCaptions={() => setHideCaptions((v) => !v)}
                  mediaRef={mediaRef}
                  mediaURL={mediaURL}
                  isMobile={viewport.isMobile}
                  setDuration={setDuration}
                  setIsPlaying={setIsPlaying}
                />
              </div>
            )}

            {selectedItem?.type === 'deck' && (
              <FlashcardViewer
                key={`${selectedItem.id}-${deckOpenGeneration}`}
                deck={selectedItem.data as DeckItem}
                deckHydrateBump={deckHydrateBump}
                onComplete={() => {
                  setCleanupModalVariant('deck');
                  setShowCleanupModal(true);
                }}
                onPersistError={(message) => setToast({ message, type: 'error' })}
              />
            )}
          </div>
        </div>
      </div>

      {lessonToDelete && (
        <DeleteLessonModal
          lessonId={lessonToDelete}
          onCancel={() => setLessonToDelete(null)}
          onConfirmDelete={async (id) => {
            try {
              await handleDeletePermanently(id);
              if (selectedItem?.id === id) handleNewLessonWrapper();
            } catch {
              setToast({
                message: 'Could not delete this item. IndexedDB may be unavailable (e.g. private browsing).',
                type: 'error',
              });
              setLessonToDelete(null);
            }
          }}
        />
      )}

      {trashDeleteIds && trashDeleteIds.length > 0 && (
        <DeleteManyModal
          count={trashDeleteIds.length}
          onCancel={() => setTrashDeleteIds(null)}
          onConfirm={async () => {
            const ids = trashDeleteIds;
            const results = await Promise.allSettled(ids.map((id) => handleDeletePermanently(id)));
            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            const failed = results.length - succeeded;
            if (selectedItem && ids.includes(selectedItem.id)) handleNewLessonWrapper();
            setTrashDeleteIds(null);
            if (failed === 0) {
              setToast({ message: `Deleted ${succeeded} ${succeeded === 1 ? 'item' : 'items'}.`, type: 'success' });
            } else {
              setToast({ message: `Deleted ${succeeded} items; ${failed} failed.`, type: 'error' });
            }
          }}
        />
      )}

      <CleanupModal
        isOpen={showCleanupModal}
        variant={cleanupModalVariant}
        onKeep={() => void handleCleanupKeep()}
        onDismiss={cleanupModalVariant === 'deck' ? () => setShowCleanupModal(false) : undefined}
        onRemoveAudio={
          cleanupModalVariant === 'lesson'
            ? async () => {
                const id = selectedItem?.id;
                if (!id || selectedItem?.type !== 'lesson') return;
                setShowCleanupModal(false);
                try {
                  if (mediaURL) {
                    URL.revokeObjectURL(mediaURL);
                  }
                  setMediaURL(null);
                  setMediaFile(null);
                  setIsPlaying(false);
                  await prepareForLessonMediaClear(id);
                  await handleDeletePermanently(id);
                  handleNewLessonWrapper();
                } catch {
                  setToast({
                    message: 'Could not remove this lesson. IndexedDB may be unavailable (e.g. private browsing).',
                    type: 'error',
                  });
                }
              }
            : undefined
        }
        onDeleteDeck={
          cleanupModalVariant === 'deck'
            ? async () => {
                const id = selectedItem?.id;
                if (!id || selectedItem?.type !== 'deck') return;
                setShowCleanupModal(false);
                await handleDeletePermanently(id);
                handleNewLessonWrapper();
              }
            : undefined
        }
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}
    </div>
  );
}
