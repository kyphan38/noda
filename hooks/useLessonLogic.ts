import { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Sentence, AppMode, ExpandedSections } from '@/types';
import { DEFAULT_APP_MODE, GEMINI_MODEL, SAVE_PROGRESS_DELAY_MS } from '@/constants';
import { parseTranscript, getIPASystemInstruction, getLetters } from '@/lib/utils';
import { getAllLessons, getLesson, saveLesson, trashLesson, deleteLesson, updateLessonProgress } from '@/lib/db';

export function useLessonLogic(
  audioFile: File | null,
  setAudioFile: (file: File | null) => void,
  setAudioURL: (url: string | null) => void,
  recognitionLang: string,
  setRecognitionLang: (lang: string) => void
) {
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [appMode, setAppMode] = useState<AppMode>(DEFAULT_APP_MODE);
  const [dictationInputs, setDictationInputs] = useState<Record<number, string>>({});
  const [completedSentences, setCompletedSentences] = useState<Record<number, boolean>>({});
  const [isStarted, setIsStarted] = useState<boolean>(false);
  const [isGeneratingIPA, setIsGeneratingIPA] = useState<boolean>(false);
  const [ipaData, setIpaData] = useState<Record<number, string>>({});
  const [lessonsList, setLessonsList] = useState<any[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const [lessonName, setLessonName] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [lessonToDelete, setLessonToDelete] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({
    'audio-en': true,
    'audio-de': false,
    'flashcard-en': true,
    'flashcard-de': false,
    'trash': true
  });

  const appModeRef = useRef<AppMode>(appMode);
  const completedSentencesRef = useRef<Record<number, boolean>>(completedSentences);

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    completedSentencesRef.current = completedSentences;
  }, [completedSentences]);

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
        setIsStarted(!!lesson.audioFile);
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

  const handleRenameLesson = async (id: string, newName: string) => {
    const lesson = await getLesson(id);
    if (lesson) {
      lesson.name = newName;
      await saveLesson(lesson);
      if (currentLessonId === id) {
        setLessonName(newName);
      }
      loadLessonsList();
    }
  };

  const handleTrashLesson = async (id: string) => {
    await trashLesson(id);
    if (currentLessonId === id) {
      handleNewLesson();
    }
    setLessonToDelete(null);
    loadLessonsList();
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

  const handleTranscriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      setTranscriptText(text);
    }
  };

  const handleFlashcardUpload = async (text: string, name: string) => {
    if (!text.trim()) return;
    
    const lessonId = Date.now().toString();
    const finalName = name.trim() || text.split('\n')[0].substring(0, 30) || 'Untitled Deck';
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const newLesson = {
      id: lessonId,
      type: 'flashcard' as const,
      name: finalName,
      language: recognitionLang,
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
        shuffledIndices: Array.from({ length: lines.length }, (_, i) => i)
      }
    };
    
    await saveLesson(newLesson);
    setCurrentLessonId(lessonId);
    setLessonName(finalName);
    setAppMode('flashcard');
    setIsStarted(true);
    loadLessonsList();
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
    isStarted,
    setIsStarted,
    isGeneratingIPA,
    ipaData,
    lessonsList,
    currentLessonId,
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
    handleNewLesson,
    handleRenameLesson,
    handleTrashLesson,
    handleDeletePermanently,
    fetchIPA,
    handleStartLearning,
    handleModeChange,
    handleTranscriptUpload,
    handleFlashcardUpload
  };
}
