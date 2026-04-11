'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, FileText, Music, Play, Trash2, PanelLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { initDB, saveLesson, getLesson, getAllLessons, deleteLesson, updateLessonProgress } from '@/lib/db';
import { Sentence, LoopMode, AppMode, LessonSummary, ExpandedSections } from '@/types';
import {
  AUTH_USERNAME,
  AUTH_PASSWORD,
  DEFAULT_RECOGNITION_LANG,
  DEFAULT_LOOP_MODE,
  DEFAULT_APP_MODE,
  LOOP_DELAY_MS,
  SAVE_PROGRESS_DELAY_MS,
  GEMINI_MODEL,
  STORAGE_AUTH_KEY,
  PLAYBACK_SPEEDS,
  LEARNING_MODES,
} from '@/constants';
import { getLetters, formatTime, parseTranscript, compareSentences, getNextPlaybackSpeed, getIPASystemInstruction } from '@/lib/utils';
import { AuthScreen } from '@/components/Auth';
import { Sidebar } from '@/components/Sidebar';
import { Player } from '@/components/Player';
import { Transcript } from '@/components/Transcript';

export default function NodaApp() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState<string>('');
  
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  
  const [loopMode, setLoopMode] = useState<LoopMode>(DEFAULT_LOOP_MODE);
  
  const [appMode, setAppMode] = useState<AppMode>(DEFAULT_APP_MODE);
  
  const [dictationInputs, setDictationInputs] = useState<Record<number, string>>({});
  const [completedSentences, setCompletedSentences] = useState<Record<number, boolean>>({});
  
  const [isRecording, setIsRecording] = useState<number | null>(null);
  const [recognitionLang, setRecognitionLang] = useState<string>(DEFAULT_RECOGNITION_LANG);
  const [spokenResults, setSpokenResults] = useState<Record<number, { text: string, score: number, diff: {word: string, status: string}[] }>>({});
  const [recognitionErrors, setRecognitionErrors] = useState<Record<number, string>>({});
  
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [isGeneratingIPA, setIsGeneratingIPA] = useState<boolean>(false);

  const [flashcardText, setFlashcardText] = useState<string>('');
  const [flashcardData, setFlashcardData] = useState<any>(null);
  const [isFlashcardShuffled, setIsFlashcardShuffled] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [uploadTab, setUploadTab] = useState<'audio' | 'flashcard'>('audio');
  const [editingFlashcard, setEditingFlashcard] = useState(false);

  const [ipaData, setIpaData] = useState<Record<number, string>>({});

  const [lessonsList, setLessonsList] = useState<any[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [lessonName, setLessonName] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    'audio-en': true,
    'audio-de': false,
    'flashcard-en': true,
    'flashcard-de': false,
    'trash': true
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeSentenceRef = useRef<Sentence | null>(null);
  const loopModeRef = useRef<LoopMode>(loopMode);
  const appModeRef = useRef<AppMode>(appMode);
  const completedSentencesRef = useRef<Record<number, boolean>>(completedSentences);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrolledIndexRef = useRef<number>(-1);
  const isLoopDelayingRef = useRef<boolean>(false);
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  // Sync ref with state for the animation frame
  useEffect(() => {
    // Check auth on mount
    const auth = localStorage.getItem(STORAGE_AUTH_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setIsAuthChecking(false);
  }, []);

  useEffect(() => {
    loopModeRef.current = loopMode;
  }, [loopMode]);

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    completedSentencesRef.current = completedSentences;
  }, [completedSentences]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (audioRef.current) {
          if (audioRef.current.paused) {
            audioRef.current.play().catch(() => {});
          } else {
            audioRef.current.pause();
          }
        }
      } else if (e.code === 'KeyL' || e.code === 'KeyR') {
        e.preventDefault();
        setLoopMode(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none');
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
  }, []);



  const toggleRecording = (sentence: Sentence) => {
    if (isRecording === sentence.id) {
      recognitionRef.current?.stop();
      setIsRecording(null);
      return;
    }

    if (isRecording !== null) {
      recognitionRef.current?.stop();
    }

    setRecognitionErrors(prev => {
      const next = { ...prev };
      delete next[sentence.id];
      return next;
    });

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setRecognitionErrors(prev => ({ ...prev, [sentence.id]: "Trình duyệt của bạn không hỗ trợ Web Speech API. Vui lòng sử dụng Chrome hoặc Edge." }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = recognitionLang;
    recognition.interimResults = false; // Tắt kết quả tạm thời
    recognition.continuous = true; // Giữ mic mở cho đến khi user chủ động tắt
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => setIsRecording(sentence.id);
    
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' ';
      }
      finalTranscript = transcript.trim();
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      let errMsg = `Lỗi nhận diện (${event.error}).`;
      if (event.error === 'network') {
        errMsg = "Lỗi mạng (Network Error): Trình duyệt không thể kết nối đến dịch vụ nhận diện của Google. Hãy thử mở app ở Tab mới (Open in new tab) hoặc tắt chế độ ẩn danh.";
      } else if (event.error === 'not-allowed') {
        errMsg = "Lỗi quyền: Vui lòng cho phép sử dụng Microphone trên trình duyệt.";
      }
      setRecognitionErrors(prev => ({ ...prev, [sentence.id]: errMsg }));
      setIsRecording(null);
    };

    recognition.onend = () => {
      if (finalTranscript) {
        const result = compareSentences(sentence.text, finalTranscript);
        setSpokenResults(prev => ({ ...prev, [sentence.id]: result }));
      }
      setIsRecording(null);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition", err);
      setIsRecording(null);
    }
  };

  const handleSkip = (sentence: Sentence) => {
    setCompletedSentences(prev => ({ ...prev, [sentence.id]: true }));
    if (audioRef.current) {
      audioRef.current.currentTime = sentence.end + 0.05;
      audioRef.current.play().catch(() => {});
    }
  };

  const handleSimulateSuccess = (sentence: Sentence) => {
    const result = { score: 100, diff: [{word: "Simulated", status: "correct"}], text: "Simulated success" };
    setSpokenResults(prev => ({ ...prev, [sentence.id]: result }));
    setRecognitionErrors(prev => { const next = {...prev}; delete next[sentence.id]; return next; });
  };

  // Handle Audio Upload
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioFile(file);
      setAudioURL(url);
    }
  };

  // Handle Transcript Upload
  const handleTranscriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      setTranscriptText(text);
    }
  };



  const transcript = useMemo(() => parseTranscript(transcriptText), [transcriptText]);

  const loadLessonsList = async () => {
    try {
      const dbLessons = await getAllLessons();
      dbLessons.sort((a, b) => b.lastAccessed - a.lastAccessed);
      setLessonsList(dbLessons.map(l => ({
        id: l.id,
        name: l.name,
        language: l.language,
        progress: l.totalSentences > 0 ? Math.round((Object.keys(l.completedSentences || {}).length / l.totalSentences) * 100) : 0,
        hasIpa: Object.keys(l.ipaData || {}).length > 0,
        isTrashed: !!l.isTrashed,
        hasAudio: !!l.audioFile
      })));
    } catch (e) {
      console.error("Failed to load lessons", e);
    }
  };

  useEffect(() => {
    loadLessonsList();
  }, []);

  useEffect(() => {
    if (currentLessonId && isStarted) {
      const saveProgress = setTimeout(() => {
        updateLessonProgress(currentLessonId, completedSentences, ipaData).then(() => {
          loadLessonsList();
        });
      }, SAVE_PROGRESS_DELAY_MS);
      return () => clearTimeout(saveProgress);
    }
  }, [completedSentences, ipaData, currentLessonId, isStarted]);

  const handleLoadLesson = async (id: string) => {
    try {
      const lesson = await getLesson(id);
      if (lesson) {
        if (audioURL) URL.revokeObjectURL(audioURL);
        
        setCurrentLessonId(lesson.id);
        setLessonName(lesson.name);
        setRecognitionLang(lesson.language);
        
        if (lesson.audioFile) {
          setAudioFile(lesson.audioFile);
          setAudioURL(URL.createObjectURL(lesson.audioFile));
        } else {
          setAudioFile(null);
          setAudioURL(null);
        }
        
        setTranscriptText(lesson.transcriptText);
        setIpaData(lesson.ipaData || {});
        setCompletedSentences(lesson.completedSentences || {});
        setIsStarted(!!lesson.audioFile); // Only start if we have audio
        setAppMode('normal');
        
        lesson.lastAccessed = Date.now();
        await saveLesson(lesson);
        loadLessonsList();
        if (window.innerWidth < 768) setIsSidebarOpen(false);
      }
    } catch (e) {
      console.error("Failed to load lesson", e);
    }
  };

  const handleNewLesson = () => {
    if (audioURL) URL.revokeObjectURL(audioURL);
    setCurrentLessonId(null);
    setLessonName('');
    setAudioFile(null);
    setAudioURL(null);
    setTranscriptText('');
    setIpaData({});
    setCompletedSentences({});
    setIsStarted(false);
    setAppMode('normal');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleTrashLesson = async (id: string) => {
    import('@/lib/db').then(async ({ trashLesson }) => {
      await trashLesson(id);
      if (currentLessonId === id) {
        handleNewLesson();
      }
      setLessonToDelete(null);
      loadLessonsList();
    });
  };

  const handleDeletePermanently = async (id: string) => {
    await deleteLesson(id);
    if (currentLessonId === id) {
      handleNewLesson();
    }
    setLessonToDelete(null);
    loadLessonsList();
  };

  const fetchIPA = async (sentencesToUse = transcript) => {
    if (Object.keys(ipaData).length > 0) return;
    setIsGeneratingIPA(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      
      const sentencesToTranslate = sentencesToUse.map(s => ({ id: s.id, text: s.text }));
      
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: JSON.stringify(sentencesToTranslate),
        config: {
          systemInstruction: getIPASystemInstruction(recognitionLang),
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                ipa: { type: Type.STRING }
              },
              required: ["id", "ipa"]
            }
          }
        }
      });

      const jsonStr = response.text?.trim() || "[]";
      const parsed = JSON.parse(jsonStr);
      
      const newIpaData: Record<number, string> = {};
      parsed.forEach((item: any) => {
        newIpaData[item.id] = item.ipa;
      });
      
      setIpaData(newIpaData);
    } catch (error) {
      console.error("Failed to generate IPA", error);
    } finally {
      setIsGeneratingIPA(false);
    }
  };

  const handleStartLearning = async () => {
    if (!audioFile || !transcriptText) return;
    
    let lessonId = currentLessonId;
    const sentences = parseTranscript(transcriptText);
    
    if (!lessonId) {
      lessonId = Date.now().toString();
      const name = lessonName.trim() || audioFile.name.replace(/\.[^/.]+$/, "");
      
      const newLesson = {
        id: lessonId,
        name,
        language: recognitionLang,
        audioFile,
        transcriptText,
        ipaData: {},
        completedSentences: {},
        totalSentences: sentences.length,
        createdAt: Date.now(),
        lastAccessed: Date.now()
      };
      
      await saveLesson(newLesson);
      setCurrentLessonId(lessonId);
      setLessonName(name);
      loadLessonsList();
    } else {
      // Restore audio file for existing lesson
      const existingLesson = await getLesson(lessonId);
      if (existingLesson) {
        existingLesson.audioFile = audioFile;
        existingLesson.isTrashed = false;
        existingLesson.lastAccessed = Date.now();
        await saveLesson(existingLesson);
        loadLessonsList();
      }
    }
    
    if (appMode === 'shadowing') {
      await fetchIPA(sentences);
    }
    
    setIsStarted(true);
  };

  const handleModeChange = async (mode: AppMode) => {
    setAppMode(mode);
    if (mode === 'shadowing') {
      await fetchIPA();
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
                }, LOOP_DELAY_MS);
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
  }, [isPlaying, transcript]);

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

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      lastScrolledIndexRef.current = -1; // Force scroll on seek
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      isLoopDelayingRef.current = false;
    }
  };

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

  const changeSpeed = () => {
    const nextSpeed = getNextPlaybackSpeed(playbackRate);
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
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

  const isReady = isStarted;

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

  if (isAuthChecking) {
    return <div className="h-screen bg-gray-950 flex items-center justify-center text-emerald-500 font-mono">Loading...</div>;
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
      
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={setIsSidebarOpen}
        lessons={lessonsList}
        currentLessonId={currentLessonId}
        expandedSections={expandedSections}
        onLoadLesson={handleLoadLesson}
        onNewLesson={handleNewLesson}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto relative">
        <div className="max-w-4xl mx-auto w-full p-4 md:p-8 flex flex-col min-h-full">
          
          {/* Header */}
          <header className="flex items-center justify-between py-6 mb-4 border-b border-gray-800 shrink-0 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors" title="Open Sidebar">
                  <PanelLeft size={24} />
                </button>
              )}
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-white">
                <span className="text-emerald-400">🎧</span> Shadowing App
              </h1>
            </div>
          </header>

          {/* Upload Section (Hidden when ready) */}
          {!isStarted && (
            <div className="flex flex-col gap-6 mb-8 shrink-0">
              {/* Lesson Name Input */}
              <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg w-full max-w-md mx-auto">
                <label className="block text-sm font-medium text-gray-400 mb-2">Lesson Name (Optional)</label>
                <input 
                  type="text" 
                  value={lessonName}
                  onChange={(e) => setLessonName(e.target.value)}
                  placeholder={audioFile ? audioFile.name.replace(/\.[^/.]+$/, "") : "My awesome lesson"}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-3 outline-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
              {/* Audio Upload */}
              <div className={`p-6 rounded-xl border-2 border-dashed transition-colors ${audioFile ? 'border-green-500 bg-green-500/10' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'}`}>
                <label className="flex flex-col items-center justify-center cursor-pointer h-full min-h-[160px]">
                  {audioFile ? (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                      <span className="text-green-400 font-medium text-center">{audioFile.name}</span>
                    </>
                  ) : (
                    <>
                      {currentLessonId ? (
                        <AlertTriangle className="w-12 h-12 text-emerald-500 mb-3" />
                      ) : (
                        <Music className="w-12 h-12 text-gray-400 mb-3" />
                      )}
                      <span className="text-gray-300 font-medium text-center">
                        {currentLessonId ? "Audio file missing. Please re-upload to continue." : "Upload Audio File"}
                      </span>
                      <span className="text-gray-500 text-sm mt-1">MP3, WAV, M4A</span>
                    </>
                  )}
                  <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                </label>
              </div>

              {/* Transcript Upload */}
              <div className={`p-6 rounded-xl border-2 border-dashed transition-colors ${transcriptText ? 'border-green-500 bg-green-500/10' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'}`}>
                <label className="flex flex-col items-center justify-center cursor-pointer h-full min-h-[160px]">
                  {transcriptText ? (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                      <span className="text-green-400 font-medium text-center">Transcript Loaded</span>
                      <span className="text-green-500/70 text-sm mt-1">{transcriptText.split('\n').filter(s => s.trim()).length} sentences</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-12 h-12 text-gray-400 mb-3" />
                      <span className="text-gray-300 font-medium">Upload Transcript</span>
                      <span className="text-gray-500 text-sm mt-1">.srt file</span>
                    </>
                  )}
                  <input type="file" accept=".srt" className="hidden" onChange={handleTranscriptUpload} />
                </label>
              </div>
            </div>

            {/* Language Selection & Start Button */}
            <div className="flex flex-col items-center gap-6 bg-gray-900 p-8 rounded-xl border border-gray-800 shadow-lg">
               <div className="flex flex-col gap-4 w-full max-w-md">
                 <div className="flex items-center justify-between gap-4 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                   <div className="flex items-center gap-3">
                     <Upload className="w-5 h-5 text-gray-400" />
                     <span className="text-gray-300 font-medium">Language:</span>
                   </div>
                   <select 
                     value={recognitionLang} 
                     onChange={(e) => setRecognitionLang(e.target.value)}
                     className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 outline-none min-w-[140px]"
                   >
                     <option value="de-DE">German (de-DE)</option>
                     <option value="en-US">English (en-US)</option>
                   </select>
                 </div>

                 <div className="flex items-center justify-between gap-4 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                   <div className="flex items-center gap-3">
                     <Upload className="w-5 h-5 text-gray-400" />
                     <span className="text-gray-300 font-medium">Learning Mode:</span>
                   </div>
                   <select 
                     value={appMode} 
                     onChange={(e) => setAppMode(e.target.value as AppMode)}
                     className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2 outline-none min-w-[140px]"
                   >
                     {LEARNING_MODES.map(mode => (
                       <option key={mode.value} value={mode.value}>{mode.label}</option>
                     ))}
                   </select>
                 </div>
               </div>
               
               <button 
                 disabled={!audioFile || !transcriptText || isGeneratingIPA}
                 onClick={handleStartLearning}
                 className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg shadow-emerald-500/20 active:scale-95"
               >
                 {isGeneratingIPA ? (
                   <>
                     <div className="w-6 h-6 border-4 border-gray-950 border-t-transparent rounded-full animate-spin"></div>
                     Generating IPA & Starting...
                   </>
                 ) : (
                   <>{currentLessonId ? "Restore Lesson & Continue" : "Start Learning"} <Play className="w-6 h-6 fill-current" /></>
                 )}
               </button>
            </div>
          </div>
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
          {isReady && (
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
              onSeek={(time) => {
                if (audioRef.current) {
                  audioRef.current.currentTime = time;
                  setCurrentTime(time);
                  lastScrolledIndexRef.current = -1;
                  if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
                  isLoopDelayingRef.current = false;
                }
              }}
              onSpeedChange={changeSpeed}
              onModeChange={handleModeChange}
              onLoopModeChange={() => setLoopMode(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none')}
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
        </div>
      </div>

      {/* Delete Modal */}
      {lessonToDelete && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
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
    </div>
  );
}
