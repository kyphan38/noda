import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Sentence, AppMode, ExpandedSections } from '@/types';
import {
  DEFAULT_APP_MODE,
  GEMINI_IPA_MODEL,
  IPA_CHUNK_SIZE,
  IPA_MAX_CONCURRENT,
  SAVE_PROGRESS_DELAY_MS,
} from '@/constants';
import {
  parseTranscript,
  getIPASystemInstruction,
  parseGeminiJsonArray,
  uniquifyName,
  flashcardDeckProgressPercent,
} from '@/lib/utils';
import { getAllLessons, getLesson, saveLesson, deleteLesson, updateLessonProgress } from '@/lib/db';

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
  });

  const appModeRef = useRef<AppMode>(appMode);
  const completedSentencesRef = useRef<Record<number, boolean>>(completedSentences);

  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  useEffect(() => {
    completedSentencesRef.current = completedSentences;
  }, [completedSentences]);

  useEffect(() => {
    ipaDataRef.current = ipaData;
  }, [ipaData]);

  const transcript = useMemo(() => parseTranscript(transcriptText), [transcriptText]);

  const loadLessonsList = useCallback(async (opts?: { trackLoading?: boolean }) => {
    const trackLoading = opts?.trackLoading === true;
    if (trackLoading) setIsListLoading(true);
    try {
      const dbLessons = await getAllLessons();
      const rows = dbLessons.map((l) => {
        const kind: 'audio' | 'flashcard' = l.type === 'flashcard' ? 'flashcard' : 'audio';
        const audioProgress =
          l.totalSentences > 0
            ? Math.round(
                (Object.values(l.completedSentences || {}).filter(Boolean).length / l.totalSentences) * 100
              )
            : 0;
        return {
          id: l.id,
          name: l.name,
          language: l.language,
          progress:
            kind === 'flashcard'
              ? flashcardDeckProgressPercent(l.flashcardData, l.totalSentences ?? 0)
              : audioProgress,
          totalSentences: l.totalSentences ?? 0,
          kind,
          hasIpa: Object.keys(l.ipaData || {}).length > 0,
          isTrashed: !!l.isTrashed,
          hasAudio: !!l.audioFile,
        };
      });
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      setLessonsList(rows);
    } catch (e) {
      console.error("Failed to load lessons", e);
    } finally {
      if (trackLoading) setIsListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLessonsList({ trackLoading: true });
  }, []);

  const progressSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentLessonId || !isStarted) {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
        progressSaveTimeoutRef.current = null;
      }
      return;
    }
    if (progressSaveTimeoutRef.current) {
      clearTimeout(progressSaveTimeoutRef.current);
      progressSaveTimeoutRef.current = null;
    }
    progressSaveTimeoutRef.current = setTimeout(() => {
      progressSaveTimeoutRef.current = null;
      updateLessonProgress(
        currentLessonId,
        completedSentencesRef.current,
        ipaDataRef.current
      ).then(() => {
        loadLessonsList();
      });
    }, SAVE_PROGRESS_DELAY_MS);
    return () => {
      if (progressSaveTimeoutRef.current) {
        clearTimeout(progressSaveTimeoutRef.current);
        progressSaveTimeoutRef.current = null;
      }
    };
  }, [completedSentences, ipaData, currentLessonId, isStarted]);

  /** Cancel debounced progress save and persist latest progress so a later put cannot resurrect cleared audio. */
  const prepareForLessonMediaClear = useCallback(async (lessonId: string) => {
    if (progressSaveTimeoutRef.current) {
      clearTimeout(progressSaveTimeoutRef.current);
      progressSaveTimeoutRef.current = null;
    }
    const active =
      currentLessonIdRef.current === lessonId || currentLessonId === lessonId;
    if (active && isStarted) {
      await updateLessonProgress(
        lessonId,
        completedSentencesRef.current,
        ipaDataRef.current
      );
      await loadLessonsList();
    }
  }, [currentLessonId, isStarted]);

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
        const hasTranscript = !!(lesson.transcriptText && lesson.transcriptText.trim());
        setIsStarted(!!lesson.audioFile || hasTranscript);
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

  const handleUpdateItemLanguage = useCallback(
    async (id: string, language: 'en' | 'de'): Promise<{ ipaNote: boolean }> => {
      const lesson = await getLesson(id);
      if (!lesson) return { ipaNote: false };
      const prev = lesson.language;
      if (prev === language) return { ipaNote: false };
      const ipaNote = Object.keys(lesson.ipaData || {}).length > 0;
      lesson.language = language;
      await saveLesson(lesson);
      if (currentLessonId === id) {
        setRecognitionLang(language);
      }
      await loadLessonsList();
      return { ipaNote };
    },
    [currentLessonId, setRecognitionLang, loadLessonsList]
  );

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
      return false;
    }
    const lang = langOverride ?? recognitionLang;
    const model = GEMINI_IPA_MODEL;
    const ipaSchema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.NUMBER },
          ipa: { type: Type.STRING },
        },
        required: ['id', 'ipa'],
      },
    };

    const chunks: Sentence[][] = [];
    for (let i = 0; i < sentencesToUse.length; i += IPA_CHUNK_SIZE) {
      chunks.push(sentencesToUse.slice(i, i + IPA_CHUNK_SIZE));
    }

    setIsGeneratingIPA(true);
    try {
      const ai = new GoogleGenAI({ apiKey });

      const runChunk = async (chunk: Sentence[]): Promise<Record<number, string>> => {
        const sentencesToTranslate = chunk.map((s) => ({ id: s.id, text: s.text }));
        const response = await ai.models.generateContent({
          model,
          contents: JSON.stringify(sentencesToTranslate),
          config: {
            systemInstruction: getIPASystemInstruction(lang),
            responseMimeType: 'application/json',
            responseSchema: ipaSchema,
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

        const partial: Record<number, string> = {};
        chunk.forEach((s, i) => {
          const row =
            (parsed.find((p) => p && typeof p === 'object' && Number((p as { id?: number }).id) === s.id) as
              | unknown
              | undefined) ?? parsed[i];
          const ipa = pickRowIpa(row);
          if (ipa) partial[s.id] = ipa;
        });
        return partial;
      };

      const newIpaData: Record<number, string> = {};
      let chunkIndex = 0;
      const workerCount = Math.min(IPA_MAX_CONCURRENT, chunks.length);

      const worker = async () => {
        for (;;) {
          const i = chunkIndex++;
          if (i >= chunks.length) break;
          const partial = await runChunk(chunks[i]!);
          Object.assign(newIpaData, partial);
        }
      };

      await Promise.all(Array.from({ length: workerCount }, () => worker()));

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
    } catch {
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

  const expandSidebarForItem = useCallback((kind: 'audio' | 'flashcard', language: string) => {
    const isDe = language === 'de';
    setExpandedSections((prev) => {
      if (kind === 'audio') {
        return {
          ...prev,
          lessons: true,
          'audio-en': !isDe,
          'audio-de': isDe,
        };
      }
      return {
        ...prev,
        decks: true,
        'flashcard-en': !isDe,
        'flashcard-de': isDe,
      };
    });
  }, []);

  const handleModeChange = async (mode: AppMode) => {
    appModeRef.current = mode;
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

    const all = await getAllLessons();
    const taken = all.filter((l) => l.type === 'flashcard').map((l) => l.name);
    const base = name.trim() || text.split('\n')[0].substring(0, 30) || 'Untitled deck';
    const finalName = uniquifyName(base, taken);

    const lessonId = Date.now().toString();
    
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
    handleDeletePermanently,
    fetchIPA,
    handleStartLearning,
    handleModeChange,
    expandSidebarForItem,
    handleTranscriptUpload,
    handleFlashcardUpload,
    loadLessonsList,
    prepareForLessonMediaClear,
    handleUpdateItemLanguage
  };
}
