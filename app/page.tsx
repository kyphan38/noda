'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { normalizeDictationTarget } from '@/lib/utils';
import { trashLesson, restoreLesson } from '@/lib/db';
import { LoginView } from '@/components/auth/LoginView';
import { Sidebar } from '@/components/Sidebar';
import { NewLessonModal } from '@/components/NewLessonModal';
import { NewDeckModal } from '@/components/NewDeckModal';
import { CleanupModal } from '@/components/CleanupModal';
import { AppHeader } from '@/components/AppHeader';
import { DeleteLessonModal } from '@/components/DeleteLessonModal';
import { useMediaPlayer } from '@/hooks/useMediaPlayer';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useLessonLogic } from '@/hooks/useLessonLogic';
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

function pushItemHistoryState(id: string, type: 'lesson' | 'deck') {
  const url = new URL(window.location.href);
  if (url.searchParams.get('item') === id) return;
  window.history.pushState({ itemId: id, itemType: type }, '', `?item=${encodeURIComponent(id)}`);
}

export default function NodaApp() {
  const [isMounted, setIsMounted] = useState(false);
  const viewport = useMobileViewport();
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthorized'>('loading');

  const [uploadMode, setUploadMode] = useState<'idle' | 'lesson' | 'deck'>('idle');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const [headerItemMenuOpen, setHeaderItemMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const [hideCaptions, setHideCaptions] = useState(false);

  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    type: 'lesson' | 'deck';
    data: LessonItem | DeckItem;
  } | null>(null);

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
    loadLessonsList, prepareForLessonMediaClear, handleUpdateItemLanguage
  } = useLessonLogic(mediaFile, setMediaFile, setMediaURL, recognitionLang, setRecognitionLang);

  const selectedItemRef = useRef(selectedItem);
  selectedItemRef.current = selectedItem;

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
  lessonsListRef.current = lessonsList;

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
    handleNewLesson();
    setSelectedItem(null);
  }, [handleNewLesson]);

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
      },
      opts?: { pushHistory?: boolean }
    ) => {
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
        setSelectedItem({ id: row.id, type: 'deck', data: deck });
        void handleLoadLesson(row.id);
        if (pushHistory) pushItemHistoryState(row.id, 'deck');
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
      setSelectedItem({ id: row.id, type: 'lesson', data: lesson });

      void handleLoadLesson(row.id);
      void handleModeChange('normal');
      if (pushHistory) pushItemHistoryState(row.id, 'lesson');
    },
    [expandSidebarForItem, handleLoadLesson, handleModeChange]
  );

  const handleItemSelect = (item: LessonItem | DeckItem) => {
    const row = lessonsList.find((l) => l.id === item.id);
    if (!row || row.isTrashed) return;
    applySelectionFromRow(row, { pushHistory: true });
  };

  const handleTrashItem = async (id: string) => {
    try {
      await trashLesson(id);
      await loadLessonsList();
      if (selectedItem?.id === id) {
        handleNewLessonWrapper();
      }
    } catch {
      setToast({ message: 'Could not move item to trash.', type: 'error' });
    }
  };

  const handleRestoreItem = async (id: string) => {
    try {
      await restoreLesson(id);
      await loadLessonsList();
    } catch {
      setToast({ message: 'Could not restore item.', type: 'error' });
    }
  };

  // Revoke blob URLs whenever mediaURL changes or the app unmounts. handleLoadLesson / handleNewLesson
  // and other paths call setMediaURL without revoking the previous URL; handleMediaUpload revokes in its
  // setter — a second revoke on the same URL is harmless (no-op per spec).
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
    const id = new URLSearchParams(window.location.search).get('item');
    if (!id) return;
    const row = lessonsListRef.current.find((l) => l.id === id && !l.isTrashed);
    if (!row) return;
    applySelectionFromRow(row, { pushHistory: false });
    window.history.replaceState(
      { itemId: row.id, itemType: row.kind === 'flashcard' ? 'deck' : 'lesson' },
      '',
      `?item=${encodeURIComponent(row.id)}`
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
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
    activeSentenceRef
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
    activeSentenceRef
  );

  useAutoScrollActiveSentence(currentTime, transcript, scrollContainerRef, lastScrolledIndexRef);

  const handleSkip = (sentence: Sentence) => {
    setCompletedSentences((prev) => {
      const next = { ...prev, [sentence.id]: true };
      completedSentencesRef.current = next;
      return next;
    });
    if (mediaRef.current) {
      mediaRef.current.currentTime = sentence.end + 0.05;
      mediaRef.current.play().catch(() => {});
    }
  };

  const handleSentenceClick = (sentence: Sentence) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = sentence.start;
      setCurrentTime(sentence.start);
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

      const idx = transcript.findIndex((s) => s.id === sentence.id);
      const nextSentence = idx >= 0 && idx < transcript.length - 1 ? transcript[idx + 1] : null;

      if (mediaRef.current) {
        if (nextSentence) {
          mediaRef.current.currentTime = nextSentence.start;
          setCurrentTime(nextSentence.start);
          lastScrolledIndexRef.current = -1;
        } else {
          mediaRef.current.currentTime = sentence.end + 0.05;
          setCurrentTime(sentence.end + 0.05);
        }
        mediaRef.current.play().catch(() => {});
      }
    }
  };

  const handleDictationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sentence: Sentence) => {
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
          lessons={lessonsList}
          isListLoading={isListLoading}
          selectedItemId={selectedItem?.id}
          expandedSections={expandedSections}
          onItemSelect={handleItemSelect}
          onNewLesson={openNewLessonModal}
          onNewDeck={openNewDeckModal}
          onTrashItem={handleTrashItem}
          onRestoreItem={handleRestoreItem}
          onDeleteForever={setLessonToDelete}
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
                onNotify={(message, type) => setToast({ message, type })}
              />
            )}

            {uploadMode === 'deck' && (
              <NewDeckModal
                onClose={closeUploadModal}
                onSubmit={handleDeckCreated}
                getTakenFlashcardDeckNames={getTakenFlashcardDeckNames}
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
                deck={selectedItem.data as DeckItem}
                onComplete={() => {
                  setCleanupModalVariant('deck');
                  setShowCleanupModal(true);
                }}
                onDeckUpdated={() => loadLessonsList()}
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

      <CleanupModal
        isOpen={showCleanupModal}
        variant={cleanupModalVariant}
        onKeep={() => setShowCleanupModal(false)}
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
