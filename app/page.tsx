'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AUTH_USERNAME_HASH, AUTH_PASSWORD_HASH, STORAGE_AUTH_KEY } from '@/constants';
import { normalizeDictationTarget } from '@/lib/utils';
import { trashLesson, restoreLesson } from '@/lib/db';
import { pushToGist, pullFromGist, getLastSyncTime } from '@/lib/gistSync';
import { AuthScreen } from '@/components/Auth';
import { Sidebar, type GistSyncUiState } from '@/components/Sidebar';
import { NewLessonModal } from '@/components/NewLessonModal';
import { NewDeckModal } from '@/components/NewDeckModal';
import { CleanupModal } from '@/components/CleanupModal';
import { AppHeader } from '@/components/AppHeader';
import { DeleteLessonModal } from '@/components/DeleteLessonModal';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useLessonLogic } from '@/hooks/useLessonLogic';
import { useLessonCreateFlow } from '@/hooks/useLessonCreateFlow';
import { useDictationCompletionModal } from '@/hooks/useDictationCompletionModal';
import { useLessonPlaybackLoop } from '@/hooks/useLessonPlaybackLoop';
import { useAutoScrollActiveSentence } from '@/hooks/useAutoScrollActiveSentence';
import { useGlobalPlaybackShortcuts } from '@/hooks/useGlobalPlaybackShortcuts';
import { useHeaderItemMenuClickOutside } from '@/hooks/useHeaderItemMenu';
import { useMobileViewport } from '@/hooks/use-mobile';
import { LessonItem, DeckItem, Sentence } from '@/types';
import { LessonView } from '@/components/LessonView';
import { FlashcardViewer } from '@/components/FlashcardViewer';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { Toast } from '@/components/Toast';

async function sha256HexUtf8(value: string): Promise<string> {
  const buf = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function formatGistLastSync(d: Date | null): string | null {
  if (!d) return null;
  const diffS = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffS < 15) return 'Last synced: just now';
  if (diffS < 3600) return `Last synced: ${Math.floor(diffS / 60)}m ago`;
  if (diffS < 86400) return `Last synced: ${Math.floor(diffS / 3600)}h ago`;
  return `Last synced: ${d.toLocaleString()}`;
}

function pushItemHistoryState(id: string, type: 'lesson' | 'deck') {
  const url = new URL(window.location.href);
  if (url.searchParams.get('item') === id) return;
  window.history.pushState({ itemId: id, itemType: type }, '', `?item=${encodeURIComponent(id)}`);
}

export default function NodaApp() {
  const [isMounted, setIsMounted] = useState(false);
  const viewport = useMobileViewport();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [uploadMode, setUploadMode] = useState<'idle' | 'lesson' | 'deck'>('idle');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const [headerItemMenuOpen, setHeaderItemMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const [hideCaptions, setHideCaptions] = useState(false);

  const [gistSyncState, setGistSyncState] = useState<GistSyncUiState>('idle');
  const [gistLastSyncLabel, setGistLastSyncLabel] = useState<string | null>(() =>
    typeof window !== 'undefined' ? formatGistLastSync(getLastSyncTime()) : null
  );
  const [gistSyncErrorDetail, setGistSyncErrorDetail] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    type: 'lesson' | 'deck';
    data: LessonItem | DeckItem;
  } | null>(null);

  const urlHydratedRef = useRef(false);
  const mobileSidebarInitialCloseRef = useRef(false);

  const {
    audioFile, setAudioFile, audioURL, setAudioURL,
    duration, setDuration, currentTime, setCurrentTime,
    isPlaying, setIsPlaying, playbackRate, loopMode, setLoopMode,
    audioRef, loopTimeoutRef, isLoopDelayingRef, loopModeRef,
    togglePlayPause, handleSeek, changeSpeed, toggleLoopMode
  } = useAudioPlayer();

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
    handleModeChange,
    expandSidebarForItem,
    loadLessonsList, prepareForLessonMediaClear, handleUpdateItemLanguage
  } = useLessonLogic(audioFile, setAudioFile, setAudioURL, recognitionLang, setRecognitionLang);

  useEffect(() => {
    if (!viewport.decided || !viewport.isMobile || mobileSidebarInitialCloseRef.current) return;
    mobileSidebarInitialCloseRef.current = true;
    setIsSidebarOpen(false);
  }, [viewport.decided, viewport.isMobile, setIsSidebarOpen]);

  const lessonsListRef = useRef<typeof lessonsList>([]);
  useEffect(() => {
    lessonsListRef.current = lessonsList;
  });

  const getTakenAudioLessonNames = useCallback(
    () =>
      lessonsList
        .filter((l) => l.kind === 'audio' && !l.isTrashed)
        .map((l) => l.name),
    [lessonsList]
  );
  const getTakenFlashcardDeckNames = useCallback(
    () =>
      lessonsList
        .filter((l) => l.kind === 'flashcard' && !l.isTrashed)
        .map((l) => l.name),
    [lessonsList]
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
        hasAudio: boolean;
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
        hasAudio: row.hasAudio,
        type: 'lesson',
      };
      expandSidebarForItem('audio', row.language);
      setSelectedItem({ id: row.id, type: 'lesson', data: lesson });

      if (viewport.isMobile) {
        bumpLessonLoadGeneration();
        setAudioFile(null);
        setAudioURL(null);
        setIsPlaying(false);
        if (pushHistory) pushItemHistoryState(row.id, 'lesson');
        return;
      }

      void handleLoadLesson(row.id);
      void handleModeChange('normal');
      if (pushHistory) pushItemHistoryState(row.id, 'lesson');
    },
    [
      bumpLessonLoadGeneration,
      expandSidebarForItem,
      handleLoadLesson,
      handleModeChange,
      setAudioFile,
      setAudioURL,
      setIsPlaying,
      viewport.isMobile,
    ]
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

  const handleGistPush = async () => {
    setGistSyncState('loading');
    setGistSyncErrorDetail(null);
    try {
      await pushToGist();
      setGistSyncState('success');
      setGistLastSyncLabel(formatGistLastSync(getLastSyncTime()));
      setGistSyncErrorDetail(null);
      await loadLessonsList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGistSyncErrorDetail(msg);
      setGistSyncState('error');
    }
  };

  const handleGistPull = async () => {
    setGistSyncState('loading');
    setGistSyncErrorDetail(null);
    try {
      await pullFromGist();
      setGistSyncState('success');
      setGistLastSyncLabel(formatGistLastSync(getLastSyncTime()));
      setGistSyncErrorDetail(null);
      await loadLessonsList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setGistSyncErrorDetail(msg);
      setGistSyncState('error');
    }
  };

  useEffect(() => {
    return () => {
      if (audioURL) URL.revokeObjectURL(audioURL);
    };
  }, [audioURL]);

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
    const audio = audioRef.current;
    if (!audio) return;
    const mode = appModeRef.current;
    if (
      audio.paused &&
      (mode === 'shadowing' || mode === 'dictation') &&
      activeSentenceRef.current
    ) {
      const s = activeSentenceRef.current;
      if (audio.currentTime >= s.end - 0.08) {
        audio.currentTime = s.start;
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
  }, [togglePlayPause, setCurrentTime, audioRef, appModeRef, activeSentenceRef, loopTimeoutRef, isLoopDelayingRef]);

  const {
    showCleanupModal,
    setShowCleanupModal,
    cleanupModalVariant,
    setCleanupModalVariant,
  } = useDictationCompletionModal(selectedItem, isStarted, transcript, appMode, completedSentences);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      if (localStorage.getItem(STORAGE_AUTH_KEY) === 'true') {
        setIsAuthenticated(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const isMobileLessonBlocked = viewport.isMobile && selectedItem?.type === 'lesson';

  useGlobalPlaybackShortcuts(
    isMobileLessonBlocked ? undefined : selectedItem?.type,
    appMode,
    selectedItem?.type === 'lesson' && !isMobileLessonBlocked
      ? () => setHideCaptions((v) => !v)
      : undefined,
    handleModeChange,
    togglePlayPauseLesson,
    toggleLoopMode,
    loopTimeoutRef,
    isLoopDelayingRef,
    audioRef,
    activeSentenceRef
  );

  useLessonPlaybackLoop(
    isPlaying,
    transcript,
    setCurrentTime,
    audioRef,
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
    if (audioRef.current) {
      audioRef.current.currentTime = sentence.end + 0.05;
      audioRef.current.play().catch(() => {});
    }
  };

  const handleSentenceClick = (sentence: Sentence) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sentence.start;
      setCurrentTime(sentence.start);
      lastScrolledIndexRef.current = -1;
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      isLoopDelayingRef.current = false;
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
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

      if (audioRef.current) {
        if (nextSentence) {
          audioRef.current.currentTime = nextSentence.start;
          setCurrentTime(nextSentence.start);
          lastScrolledIndexRef.current = -1;
        } else {
          audioRef.current.currentTime = sentence.end + 0.05;
          setCurrentTime(sentence.end + 0.05);
        }
        audioRef.current.play().catch(() => {});
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
      if (audioRef.current) {
        audioRef.current.currentTime = sentence.start;
        audioRef.current.play().catch(() => {});
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = AUTH_USERNAME_HASH.trim();
    const p = AUTH_PASSWORD_HASH.trim();
    if (!u || !p) {
      setLoginError('Auth is not configured (set NEXT_PUBLIC_AUTH_*_HASH).');
      return;
    }
    try {
      const uh = await sha256HexUtf8(loginUsername.trim());
      const ph = await sha256HexUtf8(loginPassword);
      if (uh.toLowerCase() === u.toLowerCase() && ph.toLowerCase() === p.toLowerCase()) {
        setIsAuthenticated(true);
        localStorage.setItem(STORAGE_AUTH_KEY, 'true');
        setLoginError('');
      } else {
        setLoginError('Invalid username or password');
      }
    } catch {
      setLoginError('Could not verify login.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_AUTH_KEY);
    setLoginUsername('');
    setLoginPassword('');
    window.history.replaceState({}, '', window.location.pathname);
  };

  const showLessonAudio =
    selectedItem?.type === 'lesson' && !viewport.isMobile && !isMobileLessonBlocked;

  if (!isMounted) {
    return null;
  }

  if (!viewport.decided) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        username={loginUsername}
        password={loginPassword}
        error={loginError}
        onUsernameChange={setLoginUsername}
        onPasswordChange={setLoginPassword}
        onSubmit={handleLogin}
      />
    );
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
          onLogout={handleLogout}
          onToggleSection={(section, expanded) =>
            setExpandedSections((prev) => ({ ...prev, [section]: expanded }))
          }
          isMobile={viewport.isMobile}
          gistSyncState={gistSyncState}
          gistLastSyncLabel={gistLastSyncLabel}
          gistSyncErrorDetail={gistSyncErrorDetail}
          onGistPush={handleGistPush}
          onGistPull={handleGistPull}
        />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-y-auto relative">
        <div className="max-w-4xl mx-auto w-full p-4 md:p-8 flex flex-col min-h-full">
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

          <div className="flex-1 flex flex-col min-h-0">
            {!selectedItem && uploadMode === 'idle' && (
              <WelcomeScreen
                onNewLesson={openNewLessonModal}
                onNewDeck={openNewDeckModal}
                hideAudio={viewport.isMobile}
              />
            )}

            {uploadMode === 'lesson' && (
              <NewLessonModal
                onClose={closeUploadModal}
                onSubmit={handleLessonCreated}
                getTakenAudioLessonNames={getTakenAudioLessonNames}
              />
            )}

            {uploadMode === 'deck' && (
              <NewDeckModal
                onClose={closeUploadModal}
                onSubmit={handleDeckCreated}
                getTakenFlashcardDeckNames={getTakenFlashcardDeckNames}
              />
            )}

            {(audioURL || showLessonAudio) && (
              <audio
                ref={audioRef}
                src={audioURL || undefined}
                loop={false}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            )}

            {isMobileLessonBlocked && (
              <div className="flex flex-col flex-1 min-h-0 items-center justify-center p-8 text-center border border-gray-800 rounded-2xl bg-gray-900/40">
                <p className="text-gray-300 text-lg font-medium max-w-md">
                  Audio lessons are not available on mobile — use a larger screen.
                </p>
                <p className="text-gray-500 text-sm mt-4 max-w-sm">
                  Flashcard decks work on this device. Create or open a deck from the sidebar.
                </p>
              </div>
            )}

            {selectedItem?.type === 'lesson' && !isMobileLessonBlocked && (
              <div key={appMode} className="mode-content-fade flex flex-col flex-1 min-h-0">
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
                  if (audioURL) {
                    URL.revokeObjectURL(audioURL);
                  }
                  setAudioURL(null);
                  setAudioFile(null);
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
