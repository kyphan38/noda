import React, { useState, useCallback, useEffect } from 'react';
import { Music2, FileText, Loader2 } from 'lucide-react';
import { isLessonNameTaken } from '@/lib/utils';

const MEDIA_MAX_BYTES = 200 * 1024 * 1024;
const MEDIA_WARN_BYTES = 100 * 1024 * 1024;

export interface LessonData {
  name: string;
  language: 'en' | 'de';
  mediaFile: File;
  mediaType: 'audio' | 'video';
  transcriptFile: File | null;
}

interface NewLessonModalProps {
  onClose: () => void;
  onSubmit: (data: LessonData) => void | Promise<void>;
  getTakenAudioLessonNames: () => string[];
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

function isAcceptedLessonMedia(file: File): boolean {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('audio/')) return true;
  if (file.type === 'video/mp4' || file.type === 'video/webm') return true;
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) return true;
  if (name.endsWith('.webm') && (file.type === '' || file.type === 'application/octet-stream')) return true;
  if (name.endsWith('.mp4')) {
    if (file.type === '' || file.type === 'application/octet-stream') return true;
    return file.type.startsWith('video/');
  }
  return false;
}

/** Reject obvious extension vs MIME mismatch (AC 1.1.4). */
function isExtensionMimeMismatch(file: File): boolean {
  const name = file.name.toLowerCase();
  const t = file.type;
  if (!t || t === 'application/octet-stream') return false;
  if (name.endsWith('.mp4')) return !t.startsWith('video/');
  if (name.endsWith('.webm')) return !t.startsWith('video/') && !t.startsWith('audio/');
  return false;
}

function mediaTypeFromFile(file: File): 'audio' | 'video' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.name.toLowerCase().endsWith('.mp4')) return 'video';
  return 'audio';
}

function isSrtFile(file: File) {
  return file.name.toLowerCase().endsWith('.srt') || file.type === 'application/x-subrip' || file.type === 'text/plain';
}

export function NewLessonModal({
  onClose,
  onSubmit,
  getTakenAudioLessonNames,
  onNotify,
}: NewLessonModalProps) {
  const [lessonName, setLessonName] = useState('');
  const [language, setLanguage] = useState<'en' | 'de'>('de');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [mediaDrag, setMediaDrag] = useState(false);
  const [transcriptDrag, setTranscriptDrag] = useState(false);
  const [mediaNameConflict, setMediaNameConflict] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyMediaFile = useCallback(
    (file: File) => {
      if (file.size > MEDIA_MAX_BYTES) {
        onNotify?.(
          'File is too large (200MB max). Compress the video or extract audio before importing.',
          'error'
        );
        return;
      }
      if (file.size >= MEDIA_WARN_BYTES) {
        onNotify?.(
          'Large files may feel sluggish when seeking. If that happens, try an audio-only export (e.g. MP3).',
          'info'
        );
      }

      if (!isAcceptedLessonMedia(file)) {
        onNotify?.('Invalid file. Supported: common audio formats, MP4, and WebM.', 'error');
        return;
      }
      if (isExtensionMimeMismatch(file)) {
        onNotify?.('File type does not match extension (e.g. use real MP4/WebM).', 'error');
        return;
      }

      const stem = file.name.replace(/\.[^/.]+$/, '');
      const taken = getTakenAudioLessonNames();
      if (isLessonNameTaken(stem, taken)) {
        setMediaNameConflict(
          `A lesson named "${stem}" already exists. Use another file or rename the lesson after choosing a file with a different name.`
        );
        return;
      }
      setMediaNameConflict(null);
      setMediaFile(file);
      setLessonName(stem);
    },
    [getTakenAudioLessonNames, onNotify]
  );

  const applyTranscriptFile = useCallback((file: File) => {
    if (!isSrtFile(file)) return;
    setTranscriptFile(file);
  }, []);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyMediaFile(file);
    e.target.value = '';
  };

  const handleTranscriptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyTranscriptFile(file);
  };

  const handleMediaDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMediaDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyMediaFile(file);
  };

  const handleTranscriptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTranscriptDrag(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyTranscriptFile(file);
  };

  const handleSubmit = async () => {
    if (!mediaFile || !lessonName || isSaving) return;
    setIsSaving(true);
    try {
      await Promise.resolve(
        onSubmit({
          name: lessonName,
          language,
          mediaFile,
          mediaType: mediaTypeFromFile(mediaFile),
          transcriptFile,
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="app-modal-panel relative bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700/80">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">🎧 New Lesson</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        <div className={`space-y-6 ${isSaving ? 'pointer-events-none opacity-70' : ''}`}>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
            <input
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              placeholder=""
              value={lessonName}
              onChange={(e) => {
                setLessonName(e.target.value);
                setMediaNameConflict(null);
              }}
              autoCorrect="off"
              autoCapitalize="off"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Language</label>
            <select
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'de')}
              disabled={isSaving}
            >
              <option value="de">de</option>
              <option value="en">en</option>
            </select>
          </div>

          <div className="bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-2xl p-6">
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setMediaDrag(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setMediaDrag(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={handleMediaDrop}
              className={`text-center pb-6 border-b border-gray-700 mb-4 relative rounded-xl transition-colors ${mediaDrag ? 'bg-emerald-500/10 border border-dashed border-emerald-500/50' : ''}`}
            >
              <div className="flex justify-center mb-3 text-emerald-500">
                <Music2 size={40} />
              </div>
              <p className="text-lg font-medium text-white mb-1">Upload audio or video</p>
              <p className="text-sm text-gray-400 mb-4">MP3, WAV, M4A, MP4, WebM — click or drop here</p>
              <input
                type="file"
                accept="audio/*,video/mp4,video/webm,.mp4,.webm"
                onChange={handleMediaUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isSaving}
              />
              {mediaNameConflict && (
                <p className="text-sm text-amber-400 relative z-10 px-2 mb-2" role="alert">
                  {mediaNameConflict}
                </p>
              )}
              {mediaFile && !mediaNameConflict && (
                <p className="text-emerald-500 font-medium relative z-10 pointer-events-none">✓ {mediaFile.name}</p>
              )}
            </div>

            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setTranscriptDrag(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setTranscriptDrag(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={handleTranscriptDrop}
              className={`flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg relative transition-colors ${transcriptDrag ? 'ring-1 ring-emerald-500/50 bg-emerald-500/5' : ''}`}
            >
              <FileText size={20} className="text-gray-400 shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-300">+ Add transcript (.srt)</p>
                <p className="text-xs text-gray-500 mt-0.5">Drop file here or click</p>
                {transcriptFile && <p className="text-xs text-emerald-500 mt-1">✓ {transcriptFile.name}</p>}
              </div>
              <input
                type="file"
                accept=".srt"
                onChange={handleTranscriptUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isSaving}
              />
            </div>
          </div>

          <button
            type="button"
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 ${
              mediaFile && lessonName && !isSaving
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!mediaFile || !lessonName || isSaving}
            onClick={() => void handleSubmit()}
          >
            {isSaving ? (
              <>
                <Loader2 className="animate-spin shrink-0" size={22} aria-hidden />
                Saving…
              </>
            ) : (
              'Create'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
