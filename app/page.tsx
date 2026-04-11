'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PanelLeft, Trash2, Plus } from 'lucide-react';
import { AUTH_USERNAME, AUTH_PASSWORD, STORAGE_AUTH_KEY } from '@/constants';
import { getLetters, parseTranscript } from '@/lib/utils';
import { saveLesson } from '@/lib/db';
import { AuthScreen } from '@/components/Auth';
import { Sidebar } from '@/components/Sidebar';
import { SidebarSection } from '@/components/SidebarSection';
import { Player } from '@/components/Player';
import { Transcript } from '@/components/Transcript';
import { NewLessonModal } from '@/components/NewLessonModal';
import { NewDeckModal } from '@/components/NewDeckModal';
import { CleanupModal } from '@/components/CleanupModal';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useLessonLogic } from '@/hooks/useLessonLogic';
import { Sentence, AppMode, AppTab } from '@/types';

export default function NodaApp() {
  // Authentication State
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Mobile Tab State
  const [activeTab, setActiveTab] = useState<AppTab>('Lessons');
  
  const [uploadMode, setUploadMode] = useState<'idle' | 'lesson' | 'deck'>('idle');

  const openNewLessonModal = () => {
    handleNewLesson();
    setUploadMode('lesson');
  };

  const openNewDeckModal = () => {
    handleNewLesson();
    setUploadMode('deck');
  };

  const closeUploadModal = () => {
    setUploadMode('idle');
  };

  const handleLessonCreated = async (data: {
    name: string;
    language: 'en' | 'de';
    audioFile: File;
    transcriptFile: File | null;
  }) => {
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
      lastAccessed: Date.now()
    };
    
    await saveLesson(newLesson);
    
    // We need to reload the list and select the new lesson
    // We can do this by setting the state and then calling handleLoadLesson
    // But handleLoadLesson is from the hook. We can just call handleLoadLesson(lessonId)
    // Wait, handleLoadLesson will fetch from DB. But we need to update the list first.
    // The hook doesn't expose loadLessonsList, but handleLoadLesson might trigger it, or we can just let it be.
    // Actually, handleLoadLesson sets currentLessonId, which triggers useEffect in the hook to load the lesson.
    // Let's just call handleLoadLesson. Wait, the hook's handleLoadLesson doesn't refresh the list.
    // But we can just call handleLoadLesson(lessonId) and it will load the lesson.
    handleLoadLesson(lessonId);
    setUploadMode('idle');
  };

  const handleDeckCreated = async (deckData: {
    name: string;
    language: 'en' | 'de';
    content: string;
  }) => {
    const lines = deckData.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
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
        shuffledIndices: []
      }
    };
    
    await saveLesson(newLesson);
    handleLoadLesson(lessonId);
    setUploadMode('idle');
  };

  const {
    audioFile, setAudioFile, audioURL, setAudioURL,
    duration, setDuration, currentTime, setCurrentTime,
    isPlaying, setIsPlaying, playbackRate, loopMode, setLoopMode,
    audioRef, loopTimeoutRef, isLoopDelayingRef, loopModeRef,
    handleAudioUpload, togglePlayPause, handleSeek, changeSpeed, toggleLoopMode
  } = useAudioPlayer();

  const {
    isRecording, recognitionLang, setRecognitionLang,
    spokenResults, recognitionErrors, toggleRecording, handleSimulateSuccess
  } = useSpeechRecognition();

  const {
    transcriptText, setTranscriptText, appMode, setAppMode,
    dictationInputs, setDictationInputs, completedSentences, setCompletedSentences,
    isStarted, isGeneratingIPA, ipaData, lessonsList,
    currentLessonId, lessonName, setLessonName,
    isSidebarOpen, setIsSidebarOpen, lessonToDelete, setLessonToDelete,
    expandedSections, setExpandedSections,
    appModeRef, completedSentencesRef, transcript,
    handleLoadLesson, handleNewLesson, handleRenameLesson, handleTrashLesson, handleDeletePermanently,
    handleStartLearning, handleModeChange, handleTranscriptUpload, handleFlashcardUpload
  } = useLessonLogic(audioFile, setAudioFile, setAudioURL, recognitionLang, setRecognitionLang);

  const activeSentenceRef = useRef<Sentence | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledIndexRef = useRef<number>(-1);
  
  // Cleanup Modal State
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const prevCompletedCountRef = useRef<number>(-1);

  useEffect(() => {
    if (isStarted && transcript.length > 0 && currentLessonId) {
      const currentCount = Object.keys(completedSentences).length;
      const total = transcript.length;
      
      if (prevCompletedCountRef.current !== -1 && prevCompletedCountRef.current < total && currentCount === total) {
        setShowCleanupModal(true);
      }
      
      prevCompletedCountRef.current = currentCount;
    }
  }, [completedSentences, transcript, isStarted, currentLessonId]);

  useEffect(() => {
    prevCompletedCountRef.current = -1;
  }, [currentLessonId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
      if (localStorage.getItem(STORAGE_AUTH_KEY) === 'true') {
        setIsAuthenticated(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'KeyL' || e.code === 'KeyR') {
        e.preventDefault();
        toggleLoopMode();
      } else if (e.key === 'Control') {
        e.preventDefault();
        if (loopTimeoutRef.current) {
          clearTimeout(loopTimeoutRef.current);
          isLoopDelayingRef.current = false;
        }
        if (audioRef.current && activeSentenceRef.current) {
          audioRef.current.currentTime = activeSentenceRef.current.start;
          audioRef.current.play().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [togglePlayPause, toggleLoopMode, loopTimeoutRef, isLoopDelayingRef, audioRef]);

  const handleSkip = (sentence: Sentence) => {
    setCompletedSentences(prev => ({ ...prev, [sentence.id]: true }));
    if (audioRef.current) {
      audioRef.current.currentTime = sentence.end + 0.05;
      audioRef.current.play().catch(() => {});
    }
  };

  // Audio Playback Loop & Progress
  useEffect(() => {
    let animationFrameId: number;

    const updateProgress = () => {
      if (audioRef.current) {
        const time = audioRef.current.currentTime;
        setCurrentTime(time);

        // Find active sentence
        const currentSentence = transcript.find(s => time >= s.start && time < s.end);
        if (currentSentence) {
          activeSentenceRef.current = currentSentence;
        } else {
          activeSentenceRef.current = null;
        }

        // Handle Dictation and Looping
        if (activeSentenceRef.current) {
          const isCompleted = completedSentencesRef.current[activeSentenceRef.current.id];
          
          if (time >= activeSentenceRef.current.end - 0.05) {
            if (loopModeRef.current === 'one') {
              if (!isLoopDelayingRef.current) {
                isLoopDelayingRef.current = true;
                audioRef.current.pause();
                loopTimeoutRef.current = setTimeout(() => {
                  if (audioRef.current && loopModeRef.current === 'one' && activeSentenceRef.current) {
                    audioRef.current.currentTime = activeSentenceRef.current.start;
                    audioRef.current.play().catch(() => {});
                  }
                  isLoopDelayingRef.current = false;
                }, 500); // LOOP_DELAY_MS
              }
            } else if ((appModeRef.current === 'dictation' || appModeRef.current === 'shadowing') && !isCompleted) {
              audioRef.current.pause();
              audioRef.current.currentTime = activeSentenceRef.current.end - 0.05;
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(updateProgress);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, transcript, setCurrentTime, loopTimeoutRef, isLoopDelayingRef, loopModeRef, appModeRef, completedSentencesRef, audioRef]);

  // Auto-scroll to active sentence
  useEffect(() => {
    const activeIndex = transcript.findIndex(s => currentTime >= s.start && currentTime < s.end);
    if (activeIndex !== -1 && activeIndex !== lastScrolledIndexRef.current && scrollContainerRef.current) {
      const activeElement = scrollContainerRef.current.querySelector(`[data-index="${activeIndex}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lastScrolledIndexRef.current = activeIndex;
      }
    }
  }, [currentTime, transcript]);

  const handleSentenceClick = (sentence: Sentence) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sentence.start;
      setCurrentTime(sentence.start);
      lastScrolledIndexRef.current = -1; // Force scroll on click
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      isLoopDelayingRef.current = false;
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleDictationChange = (sentence: Sentence, val: string) => {
    setDictationInputs(prev => ({ ...prev, [sentence.id]: val }));
    
    const targetL = getLetters(sentence.text);
    const inputL = getLetters(val);
    
    if (targetL.length > 0 && targetL.length === inputL.length && targetL.every((t, i) => t.char.toLowerCase() === inputL[i].char.toLowerCase())) {
      setCompletedSentences(prev => ({ ...prev, [sentence.id]: true }));
      
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
      
      {/* Sidebar (Desktop Only) */}
      <div className="hidden md:block">
        <Sidebar
          isOpen={isSidebarOpen}
          onToggle={setIsSidebarOpen}
          lessons={lessonsList}
          currentLessonId={currentLessonId}
          expandedSections={expandedSections}
          onLoadLesson={handleLoadLesson}
          onNewLesson={openNewLessonModal}
          onNewDeck={openNewDeckModal}
          onRenameLesson={handleRenameLesson}
          onTrashLesson={(id) => {
            if (currentLessonId === id && !lessonsList.find(l => l.id === id)?.isTrashed) {
              handleTrashLesson(id);
            } else {
              setLessonToDelete(id);
            }
          }}
          onLogout={handleLogout}
          onToggleSection={(section, expanded) => setExpandedSections(prev => ({ ...prev, [section]: expanded }))}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto relative pb-16 md:pb-0">
        <div className="max-w-4xl mx-auto w-full p-4 md:p-8 flex flex-col min-h-full">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between py-6 mb-4 border-b border-gray-800 shrink-0 gap-4">
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="hidden md:block p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors" title="Open Sidebar">
                  <PanelLeft size={24} />
                </button>
              )}
              {currentLessonId && (
                <button 
                  onClick={handleNewLesson} 
                  className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors" 
                  title="Back to List"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
              )}
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-white">
                <span className="text-emerald-400">🎧</span> Noda.
              </h1>
            </div>

            {/* Tabs */}
            {isStarted && (
              <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700 overflow-x-auto">
                <button
                  onClick={() => handleModeChange('normal')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    appMode === 'normal'
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Normal (Listen)
                </button>
                <button
                  onClick={() => handleModeChange('dictation')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    appMode === 'dictation'
                      ? 'bg-purple-500/40 text-purple-100'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Dictation
                </button>
                <button
                  onClick={() => handleModeChange('shadowing')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                    appMode === 'shadowing'
                      ? 'bg-green-500/40 text-green-100'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {isGeneratingIPA && appMode === 'shadowing' && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  Shadowing
                </button>
                <button
                  onClick={() => handleModeChange('flashcard' as AppMode)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    appMode === 'flashcard' as AppMode
                      ? 'bg-blue-500/40 text-blue-100'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Flashcard
                </button>
              </div>
            )}
          </header>

          {/* Mobile Views (Only visible on mobile when no lesson is selected) */}
          <div className="md:hidden flex-1 overflow-y-auto">
            {!currentLessonId && activeTab === 'Lessons' && (
              <div className="space-y-6">
                <button
                  onClick={openNewLessonModal}
                  className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-xl border border-emerald-500/30 flex items-center justify-center gap-2 font-medium transition-colors mb-4"
                >
                  <Plus size={20} /> New Activity
                </button>
                <SidebarSection
                  type="lessons"
                  title="LESSONS"
                  items={lessonsList.filter(l => !l.isTrashed && l.hasAudio).map(l => ({
                    id: l.id,
                    name: l.name,
                    language: l.language as 'en' | 'de',
                    progress: l.progress,
                    hasAudio: l.hasAudio,
                    hasIpa: l.hasIpa,
                    type: 'lesson',
                  }))}
                  currentLessonId={currentLessonId}
                  expandedSections={expandedSections}
                  onToggleSection={(section, expanded) => setExpandedSections(prev => ({ ...prev, [section]: expanded }))}
                  onLoadLesson={handleLoadLesson}
                  onTrashLesson={(id) => {
                    if (currentLessonId === id && !lessonsList.find(l => l.id === id)?.isTrashed) {
                      handleTrashLesson(id);
                    } else {
                      setLessonToDelete(id);
                    }
                  }}
                  activeMenu={null}
                  setActiveMenu={() => {}}
                />
              </div>
            )}

            {!currentLessonId && activeTab === 'Flashcards' && (
              <div className="space-y-6">
                <button
                  onClick={openNewDeckModal}
                  className="w-full py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl border border-blue-500/30 flex items-center justify-center gap-2 font-medium transition-colors mb-4"
                >
                  <Plus size={20} /> New Deck
                </button>
                <SidebarSection
                  type="decks"
                  title="DECKS"
                  items={lessonsList.filter(l => !l.isTrashed && !l.hasAudio).map(l => ({
                    id: l.id,
                    name: l.name,
                    language: l.language as 'en' | 'de' | 'mixed',
                    cardCount: l.progress,
                    type: 'deck',
                  }))}
                  currentLessonId={currentLessonId}
                  expandedSections={expandedSections}
                  onToggleSection={(section, expanded) => setExpandedSections(prev => ({ ...prev, [section]: expanded }))}
                  onLoadLesson={handleLoadLesson}
                  onTrashLesson={(id) => {
                    if (currentLessonId === id && !lessonsList.find(l => l.id === id)?.isTrashed) {
                      handleTrashLesson(id);
                    } else {
                      setLessonToDelete(id);
                    }
                  }}
                  activeMenu={null}
                  setActiveMenu={() => {}}
                  emptyMessage="No flashcard decks yet."
                />
              </div>
            )}

            {!currentLessonId && activeTab === 'Stats' && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
                <div className="text-6xl">📊</div>
                <h2 className="text-xl font-bold text-white">Stats</h2>
                <p>Your learning statistics will appear here.</p>
              </div>
            )}
          </div>

          {/* Desktop & Active Lesson View */}
          <div className={`flex-1 flex flex-col min-h-0 ${!currentLessonId ? 'hidden md:flex' : 'flex'}`}>
            {/* Upload Section (Hidden when ready) */}
            {!isStarted && !currentLessonId && (
              <div className="flex-1 flex items-center justify-center bg-gray-900 rounded-2xl border border-gray-800 p-8">
                <div className="text-center space-y-4">
                  <div className="text-6xl">🎧</div>
                  <h2 className="text-2xl font-bold text-white">Select or Create a Lesson</h2>
                  <p className="text-gray-400 max-w-md mx-auto">
                    Choose a lesson from the sidebar or create a new one to start learning.
                  </p>
                </div>
              </div>
            )}
            
            {uploadMode === 'lesson' && (
              <NewLessonModal 
                onClose={closeUploadModal}
                onSubmit={handleLessonCreated}
              />
            )}

            {uploadMode === 'deck' && (
              <NewDeckModal
                onClose={closeUploadModal}
                onSubmit={handleDeckCreated}
              />
            )}

            {/* Hidden Audio Element */}
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

            {/* Player & Transcript Section */}
            {isStarted && appMode !== 'flashcard' && (
              <div className="flex flex-col flex-1 min-h-0 gap-6">
              
              <Player
                isPlaying={isPlaying}
                duration={duration}
                currentTime={currentTime}
                playbackRate={playbackRate}
                appMode={appMode}
                loopMode={loopMode}
                isGeneratingIPA={isGeneratingIPA}
                onPlayPause={togglePlayPause}
                onSeek={handleSeek}
                onSpeedChange={changeSpeed}
                onModeChange={handleModeChange}
                onLoopModeChange={toggleLoopMode}
              />

              <Transcript
                transcript={transcript}
                currentTime={currentTime}
                appMode={appMode}
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

            {/* Flashcard Placeholder */}
            {isStarted && appMode === 'flashcard' && (
              <div className="flex-1 flex items-center justify-center bg-gray-900 rounded-2xl border border-gray-800 p-8">
                <div className="text-center space-y-4">
                  <div className="text-6xl">🎴</div>
                  <h2 className="text-2xl font-bold text-white">Flashcard Placeholder</h2>
                  <p className="text-gray-400 max-w-md mx-auto">
                    This section will contain the flashcard UI for reviewing vocabulary and sentences.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {lessonToDelete && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Delete Lesson?</h3>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">Are you sure you want to delete this lesson? All your progress, audio files, and transcripts will be permanently removed.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setLessonToDelete(null)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 font-medium transition-colors">Cancel</button>
              <button onClick={() => handleDeletePermanently(lessonToDelete)} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Modal */}
      <CleanupModal
        isOpen={showCleanupModal}
        onKeep={() => setShowCleanupModal(false)}
        onCleanup={() => {
          setShowCleanupModal(false);
          if (currentLessonId) {
            handleTrashLesson(currentLessonId);
          }
        }}
      />

      {/* Mobile Bottom Tab Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex items-center justify-around p-2 z-40 pb-safe">
        <button
          onClick={() => setActiveTab('Lessons')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            activeTab === 'Lessons' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="text-xl">🎧</span>
          <span className="text-[10px] font-medium">Lessons</span>
        </button>
        <button
          onClick={() => setActiveTab('Flashcards')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            activeTab === 'Flashcards' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="text-xl">🎴</span>
          <span className="text-[10px] font-medium">Flashcards</span>
        </button>
        <button
          onClick={() => setActiveTab('Stats')}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
            activeTab === 'Stats' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span className="text-xl">📊</span>
          <span className="text-[10px] font-medium">Stats</span>
        </button>
      </div>
    </div>
  );
}
