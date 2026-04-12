'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AUTH_USERNAME, AUTH_PASSWORD, STORAGE_AUTH_KEY } from '@/constants';
import { normalizeDictationTarget } from '@/lib/utils';
import { AuthScreen } from '@/components/Auth';
import { Sidebar } from '@/components/Sidebar';
import { NewLessonModal } from '@/components/NewLessonModal';
import { NewDeckModal } from '@/components/NewDeckModal';
import { CleanupModal } from '@/components/CleanupModal';
import { AppHeader } from '@/components/AppHeader';
import { MobileUnsupported } from '@/components/MobileUnsupported';
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

  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    type: 'lesson' | 'deck';
    data: LessonItem | DeckItem;
  } | null>(null);

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
    isStarted, isGeneratingIPA, ipaData,
    lessonsList, isListLoading,
    isSidebarOpen, setIsSidebarOpen, lessonToDelete, setLessonToDelete,
    expandedSections, setExpandedSections,
    appModeRef, completedSentencesRef, transcript,
    handleLoadLesson, handleNewLesson, handleRenameLesson, handleDeletePermanently,
    handleModeChange,
    expandSidebarForItem,
    loadLessonsList, fetchIPA, prepareForLessonMediaClear, handleUpdateItemLanguage
  } = useLessonLogic(audioFile, setAudioFile, setAudioURL, recognitionLang, setRecognitionLang);

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
      const { ipaNote } = await handleUpdateItemLanguage(id, lang);
      if (ipaNote) {
        setToast({
          type: 'info',
          message: 'Language changed. IPA data remains from the original language.',
        });
      }
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
    fetchIPA,
    getTakenAudioLessonNames,
    getTakenFlashcardDeckNames,
    expandSidebarForItem
  );

  const handleNewLessonWrapper = () => {
    handleNewLesson();
    setSelectedItem(null);
  };

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

  const handleItemSelect = (item: LessonItem | DeckItem) => {
    expandSidebarForItem(item.type === 'lesson' ? 'audio' : 'flashcard', item.language);
    setSelectedItem({
      id: item.id,
      type: item.type,
      data: item
    });
    void handleLoadLesson(item.id);
    if (item.type === 'lesson') {
      void handleModeChange('normal');
    }
  };

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

  /** Dictation/shadowing pause at sentence end leaves currentTime on the boundary; play() would be immediately paused again by the rAF loop unless we seek back first. */
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

  useGlobalPlaybackShortcuts(
    selectedItem?.type,
    appMode,
    selectedItem?.type === 'lesson' ? () => setHideCaptions((v) => !v) : undefined,
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUsername === AUTH_USERNAME && loginPassword === AUTH_PASSWORD) {
      setIsAuthenticated(true);
      localStorage.setItem(STORAGE_AUTH_KEY, 'true');
      setLoginError('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(STORAGE_AUTH_KEY);
    setLoginUsername('');
    setLoginPassword('');
  };

  if (!isMounted) {
    return null;
  }

  if (!viewport.decided) {
    return null;
  }

  if (viewport.isMobile) {
    return <MobileUnsupported />;
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
          onRenameLesson={handleRenameLesson}
          onChangeLanguage={onChangeItemLanguage}
          onDeleteLesson={(id) => setLessonToDelete(id)}
          onLogout={handleLogout}
          onToggleSection={(section, expanded) =>
            setExpandedSections((prev) => ({ ...prev, [section]: expanded }))
          }
        />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-y-auto relative">
        <div className="max-w-4xl mx-auto w-full p-4 md:p-8 flex flex-col min-h-full">
          <AppHeader
            isSidebarOpen={isSidebarOpen}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            selectedItem={selectedItem}
            appMode={appMode}
            onModeChange={handleModeChange}
            headerItemMenuOpen={headerItemMenuOpen}
            setHeaderItemMenuOpen={setHeaderItemMenuOpen}
            headerMenuRef={headerMenuRef}
            onRenameCurrent={handleHeaderRenameCurrent}
            onDeleteCurrent={() => {
              const id = selectedItem?.id;
              if (id) setLessonToDelete(id);
              setHeaderItemMenuOpen(false);
            }}
          />

          <div className="flex-1 flex flex-col min-h-0">
            {!selectedItem && uploadMode === 'idle' && (
              <WelcomeScreen onNewLesson={openNewLessonModal} onNewDeck={openNewDeckModal} />
            )}

            {uploadMode === 'lesson' && (
              <NewLessonModal
                onClose={closeUploadModal}
                onSubmit={handleLessonCreated}
                isGeneratingIPA={isGeneratingIPA}
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

            {(audioURL || selectedItem?.type === 'lesson') && (
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

            {selectedItem?.type === 'lesson' && (
              <div key={appMode} className="mode-content-fade flex flex-col flex-1 min-h-0">
                <LessonView
                  lesson={selectedItem.data as LessonItem}
                  mode={appMode}
                  isPlaying={isPlaying}
                  duration={duration}
                  currentTime={currentTime}
                  playbackRate={playbackRate}
                  loopMode={loopMode}
                  isGeneratingIPA={isGeneratingIPA}
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
                  ipaData={ipaData}
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
