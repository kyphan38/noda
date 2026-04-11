import { useState, useRef, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Sentence, AppMode, ExpandedSections } from '@/types';
import { DEFAULT_APP_MODE, GEMINI_MODEL, SAVE_PROGRESS_DELAY_MS } from '@/constants';
import { parseTranscript, getIPASystemInstruction, parseGeminiJsonArray } from '@/lib/utils';
import { getAllLessons, getLesson, saveLesson, trashLesson, deleteLesson, updateLessonProgress } from '@/lib/db';

/** `GenerateContentResponse.text` skips parts with `thought: true`; Gemini 3 may emit JSON only in those parts. */
function joinAllCandidateTextParts(response: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
}

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
  const ipaDataRef = useRef<Record<number, string>>({});
  const currentLessonIdRef = useRef<string | null>(null);
  const [lessonsList, setLessonsList] = useState<any[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
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

  const loadLessonsList = async (opts?: { trackLoading?: boolean }) => {
    const trackLoading = opts?.trackLoading === true;
    if (trackLoading) setIsListLoading(true);
    try {
      const dbLessons = await getAllLessons();
      dbLessons.sort((a, b) => b.lastAccessed - a.lastAccessed);
      setLessonsList(dbLessons.map(l => {
        const kind: 'audio' | 'flashcard' = l.type === 'flashcard' ? 'flashcard' : 'audio';
        return {
          id: l.id,
          name: l.name,
          language: l.language,
          progress: l.totalSentences > 0 ? Math.round((Object.keys(l.completedSentences || {}).length / l.totalSentences) * 100) : 0,
          totalSentences: l.totalSentences ?? 0,
          kind,
          hasIpa: Object.keys(l.ipaData || {}).length > 0,
          isTrashed: !!l.isTrashed,
          hasAudio: !!l.audioFile
        };
      }));
    } catch (e) {
      console.error("Failed to load lessons", e);
    } finally {
      if (trackLoading) setIsListLoading(false);
    }
  };

  useEffect(() => {
    loadLessonsList({ trackLoading: true });
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
        currentLessonIdRef.current = lesson.id;
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
        const loadedIpa = lesson.ipaData || {};
        ipaDataRef.current = loadedIpa;
        setIpaData(loadedIpa);
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
    currentLessonIdRef.current = null;
    setCurrentLessonId(null);
    setLessonName('');
    setAudioFile(null);
    setAudioURL(null);
    setTranscriptText('');
    ipaDataRef.current = {};
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

  const pickRowIpa = (row: unknown): string => {
    if (!row || typeof row !== 'object') return '';
    const o = row as Record<string, unknown>;
    const raw = o.ipa ?? o.IPA;
    return raw != null ? String(raw).trim() : '';
  };

  const fetchIPA = async (sentencesToUse = transcript, langOverride?: string): Promise<boolean> => {
    const ref = ipaDataRef.current;
    const hasUsefulIpa = Object.values(ref).some((v) => typeof v === 'string' && v.trim().length > 0);
    if (hasUsefulIpa) return true;
    if (!sentencesToUse.length) return true;
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error('IPA: NEXT_PUBLIC_GEMINI_API_KEY is missing (restart dev server after changing .env.local)');
      return false;
    }
    const lang = langOverride ?? recognitionLang;
    setIsGeneratingIPA(true);
    try {
      const ai = new GoogleGenAI({ apiKey });

      const sentencesToTranslate = sentencesToUse.map((s) => ({ id: s.id, text: s.text }));

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: JSON.stringify(sentencesToTranslate),
        config: {
          systemInstruction: getIPASystemInstruction(lang),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.NUMBER },
                ipa: { type: Type.STRING },
              },
              required: ['id', 'ipa'],
            },
          },
        },
      });

      if (!response.candidates?.length) {
        throw new Error(
          `Gemini returned no candidates: ${JSON.stringify(response.promptFeedback ?? {})}`
        );
      }

      const fromSdk = response.text?.trim() ?? '';
      const fromAllParts = joinAllCandidateTextParts(response);
      let jsonStr = fromSdk || fromAllParts || '[]';
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
      }
      const parsed = parseGeminiJsonArray(jsonStr) as unknown[];

      const newIpaData: Record<number, string> = {};
      sentencesToUse.forEach((s, i) => {
        const row =
          (parsed.find((p) => p && typeof p === 'object' && Number((p as { id?: number }).id) === s.id) as
            | unknown
            | undefined) ?? parsed[i];
        const ipa = pickRowIpa(row);
        if (ipa) newIpaData[s.id] = ipa;
      });

      const outKeyCount = Object.keys(newIpaData).length;

      if (outKeyCount === 0) {
        return false;
      }

      ipaDataRef.current = newIpaData;
      setIpaData(newIpaData);

      const persistId = currentLessonIdRef.current;
      if (persistId) {
        await updateLessonProgress(persistId, completedSentencesRef.current, newIpaData);
        loadLessonsList();
      }
      return true;
    } catch (error) {
      console.error('Failed to generate IPA', error);
      return false;
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
      currentLessonIdRef.current = lessonId;
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
    
    setIsStarted(true);
  };

  const handleModeChange = async (mode: AppMode) => {
    setAppMode(mode);
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
    currentLessonIdRef.current = lessonId;
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
    isListLoading,
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
    handleFlashcardUpload,
    loadLessonsList
  };
}
