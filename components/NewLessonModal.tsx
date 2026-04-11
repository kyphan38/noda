import React, { useState, useCallback, useEffect } from 'react';
import { Music2, FileText } from 'lucide-react';

interface LessonData {
  name: string;
  language: 'en' | 'de';
  audioFile: File;
  transcriptFile: File | null;
  generateIpa: boolean;
}

interface NewLessonModalProps {
  onClose: () => void;
  onSubmit: (data: LessonData) => void;
  isGeneratingIPA: boolean;
}

function isAudioFile(file: File) {
  return file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(file.name);
}

function isSrtFile(file: File) {
  return file.name.toLowerCase().endsWith('.srt') || file.type === 'application/x-subrip' || file.type === 'text/plain';
}

export function NewLessonModal({ onClose, onSubmit, isGeneratingIPA }: NewLessonModalProps) {
  const [lessonName, setLessonName] = useState('');
  const [language, setLanguage] = useState<'en' | 'de'>('de');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [audioDrag, setAudioDrag] = useState(false);
  const [transcriptDrag, setTranscriptDrag] = useState(false);
  const [generateIpa, setGenerateIpa] = useState(false);

  useEffect(() => {
    if (!transcriptFile) setGenerateIpa(false);
  }, [transcriptFile]);

  const isCreatingWithIPA = generateIpa && isGeneratingIPA;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isGeneratingIPA) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, isGeneratingIPA]);

  const applyAudioFile = useCallback((file: File) => {
    if (!isAudioFile(file)) return;
    setAudioFile(file);
    setLessonName((n) => n || file.name.replace(/\.[^/.]+$/, ''));
  }, []);

  const applyTranscriptFile = useCallback((file: File) => {
    if (!isSrtFile(file)) return;
    setTranscriptFile(file);
  }, []);

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyAudioFile(file);
  };

  const handleTranscriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyTranscriptFile(file);
  };

  const handleAudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAudioDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyAudioFile(file);
  };

  const handleTranscriptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTranscriptDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyTranscriptFile(file);
  };

  const handleSubmit = () => {
    if (audioFile && lessonName) {
      onSubmit({
        name: lessonName,
        language,
        audioFile,
        transcriptFile,
        generateIpa,
      });
    }
  };

  return (
    <div className="app-modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="app-modal-panel relative bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700/80"
        aria-busy={isCreatingWithIPA}
      >
        {isCreatingWithIPA && (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 rounded-2xl bg-gray-950/55 backdrop-blur-[3px] pointer-events-none"
            role="status"
            aria-live="polite"
          >
            <div className="noda-ipa-bar-track" aria-hidden>
              <div className="noda-ipa-bar-fill" />
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-gray-500">Đang tạo IPA</p>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">🎧 Create New Audio Lesson</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isGeneratingIPA}
            className="text-gray-400 hover:text-white text-xl disabled:opacity-40 disabled:pointer-events-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Lesson Name</label>
            <input
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              placeholder="Lesson name (e.g., German A1 Basics)"
              value={lessonName}
              onChange={(e) => setLessonName(e.target.value)}
              disabled={isGeneratingIPA}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Language</label>
            <select
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'de')}
              disabled={isGeneratingIPA}
            >
              <option value="de">German</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-2xl p-6">
            <div
              onDragEnter={(e) => { e.preventDefault(); setAudioDrag(true); }}
              onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setAudioDrag(false); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={handleAudioDrop}
              className={`text-center pb-6 border-b border-gray-700 mb-4 relative rounded-xl transition-colors ${audioDrag ? 'bg-emerald-500/10 border border-dashed border-emerald-500/50' : ''} ${isGeneratingIPA ? 'pointer-events-none opacity-50' : ''}`}
            >
              <div className="flex justify-center mb-3 text-emerald-500">
                <Music2 size={40} />
              </div>
              <p className="text-lg font-medium text-white mb-1">Upload Audio File</p>
              <p className="text-sm text-gray-400 mb-4">MP3, WAV, M4A - click or drop here</p>
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioUpload}
                disabled={isGeneratingIPA}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              {audioFile && <p className="text-emerald-500 font-medium relative z-10 pointer-events-none">✓ {audioFile.name}</p>}
            </div>

            <div
              onDragEnter={(e) => { e.preventDefault(); setTranscriptDrag(true); }}
              onDragLeave={(e) => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget as Node)) setTranscriptDrag(false); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
              onDrop={handleTranscriptDrop}
              className={`flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg relative transition-colors ${transcriptDrag ? 'ring-1 ring-emerald-500/50 bg-emerald-500/5' : ''} ${isGeneratingIPA ? 'pointer-events-none opacity-50' : ''}`}
            >
              <FileText size={20} className="text-gray-400 shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-300">+ Add transcript (.srt) - optional</p>
                <p className="text-xs text-gray-500 mt-0.5">Drop file here or click</p>
                {transcriptFile && <p className="text-xs text-emerald-500 mt-1">✓ {transcriptFile.name}</p>}
              </div>
              <input
                type="file"
                accept=".srt"
                onChange={handleTranscriptUpload}
                disabled={isGeneratingIPA}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
            </div>

            <label
              className={`mt-4 flex items-start gap-3 rounded-lg p-2 -mx-1 transition-colors ${
                transcriptFile && !isGeneratingIPA ? 'cursor-pointer hover:bg-gray-900/40' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={generateIpa}
                  disabled={!transcriptFile || isGeneratingIPA}
                  onChange={(e) => setGenerateIpa(e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  className="flex h-4 w-4 items-center justify-center rounded border border-gray-600 bg-gray-900 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/50 peer-checked:border-emerald-500 peer-checked:bg-emerald-600 peer-disabled:opacity-50"
                  aria-hidden
                >
                  {generateIpa && (
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 10" fill="none" aria-hidden>
                      <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-200">Auto-generate IPA (Noda)</span>
                <span className="mt-1 block text-xs text-gray-500 leading-relaxed">
                  {transcriptFile
                    ? 'Hiển thị IPA dưới mỗi dòng trong chế độ Shadowing. Chạy một lần sau khi tạo bài.'
                    : 'Thêm file transcript (.srt) phía trên để bật tùy chọn này.'}
                </span>
              </span>
            </label>
          </div>

          <button
            type="button"
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${
              audioFile && lessonName && !isGeneratingIPA
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!audioFile || !lessonName || isGeneratingIPA}
            onClick={handleSubmit}
          >
            {isCreatingWithIPA ? 'Đang tạo IPA…' : 'Create Lesson'}
          </button>
        </div>
      </div>
    </div>
  );
}
