'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AUTH_USERNAME, AUTH_PASSWORD, STORAGE_AUTH_KEY } from '@/constants';
import { getLetters } from '@/lib/utils';
import { clearLessonMedia } from '@/lib/db';
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
    handleLoadLesson, handleNewLesson, handleRenameLesson, handleTrashLesson, handleDeletePermanently,
    handleModeChange,
    loadLessonsList, fetchIPA
  } = useLessonLogic(audioFile, setAudioFile, setAudioURL, recognitionLang, setRecognitionLang);

  const { handleLessonCreated, handleDeckCreated } = useLessonCreateFlow(
    setSelectedItem,
    handleLoadLesson,
    handleModeChange,
    setUploadMode,
    setToast,
    fetchIPA
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

  const handleHeaderTrashCurrent = () => {
    const id = selectedItem?.id;
    if (!id) return;
    setHeaderItemMenuOpen(false);
    void handleTrashLesson(id).then(() => {
      handleNewLessonWrapper();
    });
  };

  const activeSentenceRef = useRef<Sentence | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledIndexRef = useRef<number>(-1);

  const {
    showCleanupModal,
    setShowCleanupModal,
    cleanupModalVariant,
    setCleanupModalVariant,
  } = useDictationCompletionModal(selectedItem, isStarted, transcript.length, appMode, completedSentences);

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
    handleModeChange,
    togglePlayPause,
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
    setCompletedSentences((prev) => ({ ...prev, [sentence.id]: true }));
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
    setDictationInputs((prev) => ({ ...prev, [sentence.id]: val }));

    const targetL = getLetters(sentence.text);
    const inputL = getLetters(val);

    if (
      targetL.length > 0 &&
      targetL.length === inputL.length &&
      targetL.every((c, i) => c.char.toLowerCase() === inputL[i].char.toLowerCase())
    ) {
      setCompletedSentences((prev) => ({ ...prev, [sentence.id]: true }));

      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        isLoopDelayingRef.current = false;
      }

      if (audioRef.current) {
        audioRef.current.currentTime = sentence.end + 0.05;
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleDictationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sentence: Sentence) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const targetL = getLetters(sentence.text);
      const currentInput = dictationInputs[sentence.id] || '';
      const inputL = getLetters(currentInput);

      let firstWrongIdx = -1;
      for (let i = 0; i < targetL.length; i++) {
        if (!inputL[i] || inputL[i].char.toLowerCase() !== targetL[i].char.toLowerCase()) {
          firstWrongIdx = i;
          break;
        }
      }

      if (firstWrongIdx !== -1) {
        const nextChar = targetL[firstWrongIdx].char;
        let sliceEnd = currentInput.length;
        if (inputL[firstWrongIdx]) {
          sliceEnd = inputL[firstWrongIdx].index;
        }
        const newVal = currentInput.slice(0, sliceEnd) + nextChar;
        handleDictationChange(sentence, newVal);
      }
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
          onTrashLesson={(id) => {
            if (selectedItem?.id === id && !lessonsList.find((l) => l.id === id)?.isTrashed) {
              handleTrashLesson(id);
              handleNewLessonWrapper();
            } else {
              setLessonToDelete(id);
            }
          }}
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
            onTrashCurrent={handleHeaderTrashCurrent}
          />

          <div className="flex-1 flex flex-col min-h-0">
            {!selectedItem && uploadMode === 'idle' && (
              <WelcomeScreen onNewLesson={openNewLessonModal} onNewDeck={openNewDeckModal} />
            )}

            {uploadMode === 'lesson' && (
              <NewLessonModal onClose={closeUploadModal} onSubmit={handleLessonCreated} isGeneratingIPA={isGeneratingIPA} />
            )}

            {uploadMode === 'deck' && (
              <NewDeckModal onClose={closeUploadModal} onSubmit={handleDeckCreated} />
            )}

            {audioURL && (
              <audio
                ref={audioRef}
                src={audioURL}
                loop={loopMode === 'all'}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => {
                  if (loopMode !== 'all') {
                    setIsPlaying(false);
                  }
                }}
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
                  onPlayPause={togglePlayPause}
                  onSeek={handleSeek}
                  onSpeedChange={changeSpeed}
                  onModeChange={handleModeChange}
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
                  onToggleRecording={toggleRecording}
                  onSkip={handleSkip}
                  onSimulateSuccess={handleSimulateSuccess}
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
          onConfirmDelete={(id) => handleDeletePermanently(id)}
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
                if (audioURL) {
                  URL.revokeObjectURL(audioURL);
                }
                setAudioURL(null);
                setAudioFile(null);
                setIsPlaying(false);
                await clearLessonMedia(id);
                await handleLoadLesson(id);
                await loadLessonsList();
                setSelectedItem((prev) => {
                  if (!prev || prev.id !== id || prev.type !== 'lesson') return prev;
                  const d = prev.data as LessonItem;
                  return { ...prev, data: { ...d, hasAudio: false } };
                });
              }
            : undefined
        }
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={dismissToast} />}
    </div>
  );
}
