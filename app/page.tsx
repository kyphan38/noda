'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, FileText, Music, Play, Pause, Repeat, Repeat1, Gauge, CheckCircle2, Keyboard, Mic, MicOff, Globe, FastForward, Wand2, BookOpen, Trash2, Plus, Menu, X, FolderOpen, PanelLeft, Lock, User, LogOut, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { initDB, saveLesson, getLesson, getAllLessons, deleteLesson, updateLessonProgress } from '@/lib/db';

type Sentence = {
  id: number;
  text: string;
  start: number;
  end: number;
};

const AUTH_USERNAME = process.env.NEXT_PUBLIC_USERNAME || '';
const AUTH_PASSWORD = process.env.NEXT_PUBLIC_PASSWORD || '';

const getLetters = (text: string) => {
  const letters = [];
  for (let i = 0; i < text.length; i++) {
    if (/[\p{L}\p{N}]/u.test(text[i])) {
      letters.push({ char: text[i], index: i });
    }
  }
  return letters;
};

export default function ShadowingApp() {
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
  
  type LoopMode = 'none' | 'all' | 'one';
  const [loopMode, setLoopMode] = useState<LoopMode>('none');
  
  type AppMode = 'normal' | 'dictation' | 'shadowing';
  const [appMode, setAppMode] = useState<AppMode>('normal');
  
  const [dictationInputs, setDictationInputs] = useState<Record<number, string>>({});
  const [completedSentences, setCompletedSentences] = useState<Record<number, boolean>>({});
  
  const [isRecording, setIsRecording] = useState<number | null>(null);
  const [recognitionLang, setRecognitionLang] = useState<string>('de-DE');
  const [spokenResults, setSpokenResults] = useState<Record<number, { text: string, score: number, diff: {word: string, status: string}[] }>>({});
  const [recognitionErrors, setRecognitionErrors] = useState<Record<number, string>>({});
  
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [isGeneratingIPA, setIsGeneratingIPA] = useState<boolean>(false);
  const [ipaData, setIpaData] = useState<Record<number, string>>({});

  const [lessonsList, setLessonsList] = useState<any[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [lessonName, setLessonName] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);
  
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'en-US': true,
    'de-DE': true,
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
    const auth = localStorage.getItem('shadowing_auth');
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

  const compareSentences = (target: string, spoken: string) => {
    const clean = (s: string) => s.toLowerCase().replace(/[.,?!;:()]/g, '').trim();
    const targetWords = clean(target).split(/\s+/).filter(w => w);
    const spokenWords = clean(spoken).split(/\s+/).filter(w => w);

    let correctCount = 0;
    let spokenIndex = 0;
    
    const diff = targetWords.map(tw => {
      let found = false;
      for(let i = spokenIndex; i < Math.min(spokenIndex + 3, spokenWords.length); i++) {
          if (spokenWords[i] === tw) {
              found = true;
              spokenIndex = i + 1;
              break;
          }
      }
      
      if (found) {
          correctCount++;
          return { word: tw, status: 'correct' };
      } else {
          return { word: tw, status: 'incorrect' };
      }
    });

    const score = targetWords.length > 0 ? Math.round((correctCount / targetWords.length) * 100) : 0;
    return { score, diff, text: spoken };
  };

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

  // Generate Transcript with Timestamps from SRT
  const parseTranscript = (text: string): Sentence[] => {
    const sentences: Sentence[] = [];
    if (!text) return sentences;
    // Normalize line endings and split by double newline
    const blocks = text.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length >= 3) {
        const id = parseInt(lines[0], 10);
        // SRT time format: 00:00:01,000 --> 00:00:04,000
        const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        
        if (timeMatch) {
          const start = 
            parseInt(timeMatch[1], 10) * 3600 + 
            parseInt(timeMatch[2], 10) * 60 + 
            parseInt(timeMatch[3], 10) + 
            parseInt(timeMatch[4], 10) / 1000;
            
          const end = 
            parseInt(timeMatch[5], 10) * 3600 + 
            parseInt(timeMatch[6], 10) * 60 + 
            parseInt(timeMatch[7], 10) + 
            parseInt(timeMatch[8], 10) / 1000;
            
          const textContent = lines.slice(2).join('\n').trim();
          
          sentences.push({ id: isNaN(id) ? sentences.length : id, start, end, text: textContent });
        }
      }
    }
    return sentences;
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
      }, 1000);
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
        model: 'gemini-3-flash-preview',
        contents: JSON.stringify(sentencesToTranslate),
        config: {
          systemInstruction: `You are an IPA converter. Convert the user's text into ${recognitionLang === 'de-DE' ? 'German' : 'English'} IPA. Output ONLY raw JSON. Do not add any greetings, explanations, or formatting.`,
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
                }, 1500); // 1.5s delay
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

  // Format time (seconds to mm:ss)
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
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
      localStorage.setItem('shadowing_auth', 'true');
      setLoginError('');
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('shadowing_auth');
    setLoginUsername('');
    setLoginPassword('');
  };

  if (isAuthChecking) {
    return <div className="h-screen bg-gray-950 flex items-center justify-center text-yellow-500 font-mono">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 font-sans selection:bg-yellow-500/30">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4 border border-yellow-500/20">
              <Lock className="w-8 h-8 text-yellow-500" />
            </div>
            <h1 className="text-2xl font-bold text-white">Private Access</h1>
            <p className="text-gray-400 text-sm mt-2 text-center">This application is restricted to authorized users only.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-700 rounded-lg bg-gray-950 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-shadow"
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-700 rounded-lg bg-gray-950 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-shadow"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {loginError && (
              <div className="text-red-400 text-sm font-medium bg-red-400/10 border border-red-400/20 rounded-lg p-3">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-gray-950 bg-yellow-500 hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-gray-900 transition-colors mt-6"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans overflow-hidden selection:bg-yellow-500/30">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)} 
        />
      )}

      {/* Sidebar Container */}
      <div className={`shrink-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-72' : 'w-0'} relative z-50`}>
        <div className={`fixed inset-y-0 left-0 w-72 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2"><FolderOpen size={18} className="text-yellow-500"/> My Lessons</h2>
            <div className="flex items-center gap-1">
              <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-gray-800 transition-colors" title="Logout">
                <LogOut size={18}/>
              </button>
              <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors" title="Close Sidebar">
                <PanelLeft size={20}/>
              </button>
            </div>
          </div>
        
        <div className="p-4">
          <button onClick={handleNewLesson} className="w-full py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg border border-yellow-500/30 flex items-center justify-center gap-2 font-medium transition-colors mb-3">
            <Plus size={18} /> New Lesson
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-6">
          {['en-US', 'de-DE', 'trash'].map(section => {
            let sectionLessons = [];
            if (section === 'trash') {
              sectionLessons = lessonsList.filter(l => l.isTrashed);
            } else {
              sectionLessons = lessonsList.filter(l => l.language === section && !l.isTrashed);
            }
            
            if (sectionLessons.length === 0) return null;
            
            const isExpanded = expandedSections[section];
            const toggleSection = () => setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
            
            return (
              <div key={section} className="space-y-1">
                <button 
                  onClick={toggleSection}
                  className="w-full flex items-center justify-between px-3 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 hover:text-gray-300 transition-colors"
                >
                  <span>{section === 'en-US' ? 'English' : section === 'de-DE' ? 'German' : 'Trash'}</span>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                
                {isExpanded && sectionLessons.map(lesson => (
                  <div 
                    key={lesson.id} 
                    onClick={() => handleLoadLesson(lesson.id)} 
                    className={`p-3 rounded-lg cursor-pointer transition-colors group ${currentLessonId === lesson.id ? 'bg-gray-800 border border-gray-700' : 'hover:bg-gray-800/50 border border-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-200 text-sm truncate pr-2" title={lesson.name}>
                        {lesson.name}
                        {!lesson.hasAudio && <span title="Audio file missing"><AlertTriangle size={12} className="inline ml-1 text-yellow-500" /></span>}
                      </h4>
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (section === 'trash') {
                            setLessonToDelete(lesson.id); // Will permanently delete
                          } else {
                            handleTrashLesson(lesson.id);
                          }
                        }} 
                        className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title={section === 'trash' ? "Delete permanently" : "Move to trash"}
                      >
                        <Trash2 size={14}/>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={12} className={lesson.progress === 100 ? 'text-green-400' : ''}/> 
                        {lesson.progress}%
                      </span>
                      {lesson.hasIpa && (
                        <span className="flex items-center gap-1 text-purple-400" title="IPA Generated">
                          <Wand2 size={12}/> IPA
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1 bg-gray-800 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full ${lesson.progress === 100 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${lesson.progress}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        </div>
      </div>

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
                <span className="text-yellow-400">🎧</span> Shadowing App
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
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 rounded-lg focus:ring-yellow-500 focus:border-yellow-500 block p-3 outline-none"
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
                        <AlertTriangle className="w-12 h-12 text-yellow-500 mb-3" />
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
                     <Globe className="w-5 h-5 text-gray-400" />
                     <span className="text-gray-300 font-medium">Language:</span>
                   </div>
                   <select 
                     value={recognitionLang} 
                     onChange={(e) => setRecognitionLang(e.target.value)}
                     className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-yellow-500 focus:border-yellow-500 block p-2 outline-none min-w-[140px]"
                   >
                     <option value="de-DE">German (de-DE)</option>
                     <option value="en-US">English (en-US)</option>
                   </select>
                 </div>

                 <div className="flex items-center justify-between gap-4 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                   <div className="flex items-center gap-3">
                     <BookOpen className="w-5 h-5 text-gray-400" />
                     <span className="text-gray-300 font-medium">Learning Mode:</span>
                   </div>
                   <select 
                     value={appMode} 
                     onChange={(e) => setAppMode(e.target.value as AppMode)}
                     className="bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-yellow-500 focus:border-yellow-500 block p-2 outline-none min-w-[140px]"
                   >
                     <option value="normal">Normal (Listen)</option>
                     <option value="dictation">Dictation (Type)</option>
                     <option value="shadowing">Shadowing (Speak)</option>
                   </select>
                 </div>
               </div>
               
               <button 
                 disabled={!audioFile || !transcriptText || isGeneratingIPA}
                 onClick={handleStartLearning}
                 className="px-10 py-4 bg-yellow-500 hover:bg-yellow-400 text-gray-950 font-bold text-lg rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg shadow-yellow-500/20 active:scale-95"
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
            
            {/* Player Controls */}
            <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800 shrink-0">
              
              {/* Progress Bar */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-sm font-mono text-gray-400 w-12 text-right">{formatTime(currentTime)}</span>
                <input 
                  type="range" 
                  min={0} 
                  max={duration || 100} 
                  step={0.01}
                  value={currentTime} 
                  onChange={handleSeek}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                />
                <span className="text-sm font-mono text-gray-400 w-12">{formatTime(duration)}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                
                {/* Speed Control */}
                <button 
                  onClick={changeSpeed}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                  title="Playback Speed"
                >
                  <Gauge className="w-5 h-5 text-blue-400" />
                  <span className="font-medium font-mono">{playbackRate.toFixed(2)}x</span>
                </button>

                {/* Play/Pause */}
                <button 
                  onClick={togglePlayPause}
                  className="w-14 h-14 flex items-center justify-center rounded-full bg-yellow-400 hover:bg-yellow-300 text-gray-950 transition-transform active:scale-95 shadow-lg shadow-yellow-400/20"
                >
                  {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                </button>

                {/* Mode Selector */}
                <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
                  <button 
                    onClick={() => handleModeChange('normal')} 
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${appMode === 'normal' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    Normal
                  </button>
                  <button 
                    onClick={() => handleModeChange('dictation')} 
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${appMode === 'dictation' ? 'bg-purple-500/40 text-purple-100 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    Dictation
                  </button>
                  <button 
                    onClick={() => handleModeChange('shadowing')} 
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${appMode === 'shadowing' ? 'bg-green-500/40 text-green-100 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    {isGeneratingIPA && appMode === 'shadowing' && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    Shadowing
                  </button>
                </div>

                {/* Loop Control */}
                <button 
                  onClick={() => setLoopMode(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${loopMode !== 'none' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-transparent'}`}
                  title="Loop Mode (Shortcut: L)"
                >
                  {loopMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className={`w-5 h-5 ${loopMode === 'all' ? 'text-green-400' : ''}`} />}
                  <span className="font-medium hidden sm:inline">
                    {loopMode === 'none' ? 'Loop' : loopMode === 'all' ? 'Loop All' : 'Loop One'}
                  </span>
                </button>

              </div>
            </div>

            {/* Transcript List */}
            <div className="flex-1 min-h-0 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur shrink-0">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Transcript</h2>
              </div>
              
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth"
              >
                {transcript.map((sentence, index) => {
                  const isActive = currentTime >= sentence.start && currentTime < sentence.end;
                  const isPast = currentTime >= sentence.end;
                  
                  return (
                    <div 
                      key={sentence.id}
                      data-index={index}
                      onClick={() => handleSentenceClick(sentence)}
                      className={`
                        group flex gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200
                        ${isActive 
                          ? 'bg-yellow-400/10 border border-yellow-400/30 shadow-[0_0_15px_rgba(250,204,21,0.1)]' 
                          : 'hover:bg-gray-800 border border-transparent'
                        }
                      `}
                    >
                      <span className={`
                        font-mono text-sm mt-1 shrink-0 w-6 text-right
                        ${isActive ? 'text-yellow-400 font-bold' : isPast ? 'text-gray-600' : 'text-gray-500'}
                      `}>
                        {index + 1}.
                      </span>
                      
                      <div className="flex-1 flex flex-col gap-2">
                        {appMode === 'dictation' ? (
                          <div className="flex flex-col gap-3">
                            <div className="font-mono text-lg tracking-wide flex flex-wrap gap-[1px]">
                              {(() => {
                                const targetLetters = getLetters(sentence.text);
                                const inputLetters = getLetters(dictationInputs[sentence.id] || '');
                                
                                return sentence.text.split('').map((char, charIdx) => {
                                  const isLetter = /[\p{L}\p{N}]/u.test(char);
                                  if (!isLetter) {
                                    return (
                                      <span key={charIdx} className="text-gray-500 whitespace-pre">
                                        {char}
                                      </span>
                                    );
                                  }
                                  
                                  const letterIdx = targetLetters.findIndex(l => l.index === charIdx);
                                  const inputChar = inputLetters[letterIdx]?.char;
                                  
                                  let displayChar = '*';
                                  let colorClass = "text-gray-600";
                                  
                                  if (completedSentences[sentence.id]) {
                                    displayChar = char;
                                    colorClass = "text-green-400";
                                  } else if (inputChar !== undefined) {
                                    if (inputChar.toLowerCase() === char.toLowerCase()) {
                                      displayChar = char;
                                      colorClass = "text-green-400";
                                    } else {
                                      displayChar = '*';
                                      colorClass = "text-red-400";
                                    }
                                  }
                                  
                                  return (
                                    <span key={charIdx} className={colorClass}>
                                      {displayChar}
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                            {isActive && !completedSentences[sentence.id] && (
                              <input
                                type="text"
                                autoFocus
                                value={dictationInputs[sentence.id] || ''}
                                onChange={(e) => handleDictationChange(sentence, e.target.value)}
                                onKeyDown={(e) => handleDictationKeyDown(e, sentence)}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 font-mono text-lg focus:outline-none focus:border-purple-500 shadow-inner"
                                placeholder="Type what you hear... (Tab for hint, Ctrl to replay)"
                                autoComplete="off"
                                spellCheck="false"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <p className={`
                              text-lg leading-relaxed
                              ${isActive ? 'text-yellow-400 font-medium text-xl' : isPast ? 'text-gray-400' : 'text-gray-200'}
                            `}>
                              {sentence.text}
                            </p>
                            
                            {appMode === 'shadowing' && ipaData[sentence.id] && (
                              <p className="text-sm font-mono text-purple-400/80 tracking-wide">
                                /{ipaData[sentence.id]}/
                              </p>
                            )}
                            
                            {/* Error Message */}
                            {recognitionErrors[sentence.id] && (
                              <div className="mt-2 p-3 bg-red-500/10 rounded-lg border border-red-500/30 text-red-400 text-sm flex flex-col gap-3">
                                <span>{recognitionErrors[sentence.id]}</span>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleSimulateSuccess(sentence); }} 
                                  className="self-start px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-xs font-medium text-gray-300 flex items-center gap-2 transition-colors border border-gray-700"
                                >
                                  <Wand2 className="w-3 h-3" /> Bỏ qua lỗi (Mô phỏng đọc đúng 100%)
                                </button>
                              </div>
                            )}

                            {/* Pronunciation Assessment Result */}
                            {spokenResults[sentence.id] && !recognitionErrors[sentence.id] && (
                              <div className={`mt-2 p-3 rounded-lg border ${spokenResults[sentence.id].score >= 80 ? 'bg-green-900/20 border-green-800/50' : 'bg-gray-950 border-gray-800'}`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-400">Pronunciation Score:</span>
                                  <span className={`text-sm font-bold ${spokenResults[sentence.id].score >= 80 ? 'text-green-400' : spokenResults[sentence.id].score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                    {spokenResults[sentence.id].score}%
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1 text-base">
                                  {spokenResults[sentence.id].diff.map((d, i) => (
                                    <span key={i} className={d.status === 'correct' ? 'text-green-400' : 'text-red-400 font-bold'}>
                                      {d.word}
                                    </span>
                                  ))}
                                </div>
                                
                                {appMode === 'shadowing' && isActive && !completedSentences[sentence.id] && (
                                  <div className="mt-4 flex justify-end">
                                    {spokenResults[sentence.id].score >= 80 ? (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleSkip(sentence); }}
                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-green-900/20"
                                      >
                                        Next <FastForward className="w-4 h-4" />
                                      </button>
                                    ) : (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleSkip(sentence); }}
                                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium flex items-center gap-2 transition-colors border border-gray-700"
                                      >
                                        Skip <FastForward className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Status Icon & Mic */}
                      <div className="shrink-0 flex flex-col items-end gap-3 mt-1">
                        {isActive && <Play className="w-5 h-5 text-yellow-400 fill-current animate-pulse" />}
                        {isPast && !isActive && <CheckCircle2 className="w-5 h-5 text-gray-600" />}
                        
                        {appMode === 'shadowing' && isActive && !completedSentences[sentence.id] && !spokenResults[sentence.id] && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSkip(sentence);
                            }}
                            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
                            title="Skip this sentence"
                          >
                            <FastForward className="w-4 h-4" />
                          </button>
                        )}

                        {appMode === 'shadowing' && (
                          <div className="flex items-center gap-2">
                            {isRecording === sentence.id && (
                              <span className="text-xs text-red-400 font-medium animate-pulse">
                                Đang thu... (Click để dừng)
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRecording(sentence);
                              }}
                              className={`p-2 rounded-full transition-colors ${isRecording === sentence.id ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-gray-800 hover:bg-gray-700 text-gray-400'}`}
                              title={isRecording === sentence.id ? "Dừng thu âm" : "Bắt đầu thu âm"}
                            >
                              {isRecording === sentence.id ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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
