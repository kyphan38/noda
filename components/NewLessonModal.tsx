import React, { useState, useCallback, useEffect } from 'react';
import { Music2, FileText, X, Check } from 'lucide-react';
import {
  MEDIA_WARN_BYTES,
  lessonNameFromFile,
  isSrtFile,
  mediaFileError,
  mediaTypeFromFile,
  pairLessonFiles,
  type LessonFilePair,
} from '@/lib/lessonFiles';
import { isLessonNameTaken } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export interface LessonData {
  name: string;
  folderId: string | null;
  mediaFile: File;
  mediaType: 'audio' | 'video';
  transcriptFile: File | null;
}

interface NewLessonModalProps {
  onClose: () => void;
  /** `onUploadProgress` reports the media upload share, 0..1. */
  onSubmit: (data: LessonData, onUploadProgress: (fraction: number) => void) => void | Promise<void>;
  /** Several lessons from files dropped together; see useLessonCreateFlow.handleLessonsCreated. */
  onSubmitMany: (
    items: LessonData[],
    onUploadProgress: (index: number, fraction: number) => void,
    onItemDone: (index: number) => void
  ) => Promise<void>;
  getTakenAudioLessonNames: () => string[];
  folders?: Array<{ id: string; name: string }>;
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

/** One lesson in a multi-file drop; `error` rows are shown but not created. */
type BatchRow = LessonFilePair & { error: string | null };

export function NewLessonModal({
  onClose,
  onSubmit,
  onSubmitMany,
  getTakenAudioLessonNames,
  folders = [],
  onNotify,
}: NewLessonModalProps) {
  const [lessonName, setLessonName] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);

  const visibleFolders = folders; // caller should filter by kind; we filter by language below
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [mediaDrag, setMediaDrag] = useState(false);
  const [transcriptDrag, setTranscriptDrag] = useState(false);
  const [mediaNameConflict, setMediaNameConflict] = useState<string | null>(null);
  const [formUploadError, setFormUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /** 0..100 while the media file uploads; null before the first progress event. */
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  /** Set when 2+ media files were dropped together: one row per lesson. */
  const [batch, setBatch] = useState<BatchRow[] | null>(null);
  /** .srt files in the drop with no media of the same name. */
  const [unmatchedTranscripts, setUnmatchedTranscripts] = useState<string[]>([]);
  /** Which batch item is uploading, for the button label. */
  const [batchProgress, setBatchProgress] = useState<{ index: number; total: number; percent: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyMediaFile = useCallback(
    (file: File) => {
      setFormUploadError(null);
      const error = mediaFileError(file);
      if (error) {
        setFormUploadError(error);
        return;
      }
      if (file.size >= MEDIA_WARN_BYTES) {
        onNotify?.(
          'Large files may feel sluggish when seeking. If that happens, try an audio-only export (e.g. MP3).',
          'info'
        );
      }

      const stem = lessonNameFromFile(file.name);
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

  /**
   * Files dropped or picked together. One media file (with or without its .srt)
   * fills the form as before; two or more become a list of lessons, each media
   * paired with the .srt of the same name.
   */
  const applyFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (files.length === 1) {
        if (files[0].name.toLowerCase().endsWith('.srt')) applyTranscriptFile(files[0]);
        else applyMediaFile(files[0]);
        return;
      }
      const { pairs, unmatchedTranscripts: unmatched } = pairLessonFiles(files);
      setFormUploadError(null);
      setUnmatchedTranscripts(unmatched.map((f) => f.name));
      if (pairs.length === 0) {
        setFormUploadError('No audio or video file in the drop.');
        return;
      }
      if (pairs.length === 1) {
        setBatch(null);
        applyMediaFile(pairs[0].media);
        if (pairs[0].transcript) setTranscriptFile(pairs[0].transcript);
        return;
      }
      const taken = getTakenAudioLessonNames();
      const rows = pairs.map((pair) => {
        const error =
          mediaFileError(pair.media) ?? (isLessonNameTaken(pair.name, taken) ? 'Name already in use' : null);
        if (!error) taken.push(pair.name); // two media files with one name: only the first goes in
        return { ...pair, error };
      });
      setBatch(rows);
      setMediaFile(null);
      setTranscriptFile(null);
      setMediaNameConflict(null);
    },
    [applyMediaFile, applyTranscriptFile, getTakenAudioLessonNames]
  );

  const clearBatch = () => {
    setBatch(null);
    setUnmatchedTranscripts([]);
    setFormUploadError(null);
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyFiles(Array.from(e.target.files ?? []));
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
    applyFiles(Array.from(e.dataTransfer.files ?? []));
  };

  const handleTranscriptDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTranscriptDrag(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 1) applyFiles(files);
    else if (files[0]) applyTranscriptFile(files[0]);
  };

  const batchReady = batch?.filter((r) => !r.error) ?? [];

  const handleSubmitBatch = async () => {
    if (!batch || batchReady.length === 0 || isSaving) return;
    const rows = batchReady;
    setIsSaving(true);
    setFormUploadError(null);
    const done = new Set<BatchRow>();
    try {
      await onSubmitMany(
        rows.map((r) => ({
          name: r.name,
          folderId,
          mediaFile: r.media,
          mediaType: mediaTypeFromFile(r.media),
          transcriptFile: r.transcript,
        })),
        (index, fraction) => setBatchProgress({ index, total: rows.length, percent: Math.round(fraction * 100) }),
        (index) => done.add(rows[index])
      );
    } catch (error) {
      // Keep only what is not created yet, so Create again does not duplicate lessons.
      setBatch((list) => list?.filter((r) => !done.has(r)) ?? null);
      setFormUploadError(error instanceof Error ? error.message : 'Could not create the lessons.');
    } finally {
      setIsSaving(false);
      setBatchProgress(null);
    }
  };

  const handleSubmit = async () => {
    if (!mediaFile || !lessonName || isSaving) return;
    setIsSaving(true);
    setFormUploadError(null);
    setUploadPercent(null);
    try {
      await Promise.resolve(
        onSubmit({
          name: lessonName,
          folderId,
          mediaFile,
          mediaType: mediaTypeFromFile(mediaFile),
          transcriptFile,
        }, (fraction) => setUploadPercent(Math.round(fraction * 100)))
      );
    } catch (error) {
      // Keep the modal and everything picked so far; show why it failed.
      setFormUploadError(error instanceof Error ? error.message : 'Could not create the lesson.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="app-modal-panel relative bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700/80">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Music2 size={22} strokeWidth={1.75} aria-hidden /> New Lesson
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </Button>
        </div>

        {formUploadError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Cannot add this lesson</AlertTitle>
            <AlertDescription>{formUploadError}</AlertDescription>
          </Alert>
        ) : null}
        {mediaNameConflict ? (
          <Alert variant="warning" className="mb-4">
            <AlertTitle>Name already in use</AlertTitle>
            <AlertDescription>{mediaNameConflict}</AlertDescription>
          </Alert>
        ) : null}

        <div className={`space-y-6 ${isSaving ? 'pointer-events-none opacity-70' : ''}`}>
          {!batch && (
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
            <input
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
              placeholder=""
              value={lessonName}
              onChange={(e) => {
                setLessonName(e.target.value);
                setMediaNameConflict(null);
                setFormUploadError(null);
              }}
              autoCorrect="off"
              autoCapitalize="off"
              disabled={isSaving}
            />
          </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Folder</label>
            <select
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
              value={folderId ?? ''}
              onChange={(e) => setFolderId(e.target.value ? e.target.value : null)}
              disabled={isSaving}
            >
              <option value="">(Root)</option>
              {visibleFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {batch ? (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-400">Lessons ({batchReady.length})</span>
                <Button type="button" variant="ghost" size="xs" onClick={clearBatch} disabled={isSaving}>
                  Clear
                </Button>
              </div>
              <ul className="divide-y divide-gray-700/70 rounded-lg border border-gray-700 bg-gray-900">
                {batch.map((row) => (
                  <li key={row.media.name} className={`flex items-center gap-3 px-3 py-2 ${row.error ? 'opacity-50' : ''}`}>
                    <Music2 size={14} className="shrink-0 text-gray-500" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-100" title={row.media.name}>
                      {row.name}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {row.error ?? (row.transcript ? (
                        <span className="inline-flex items-center gap-1"><Check size={12} aria-hidden /> .srt</span>
                      ) : 'No transcript')}
                    </span>
                  </li>
                ))}
              </ul>
              {unmatchedTranscripts.length > 0 && (
                <p className="mt-2 text-xs text-gray-500" title={unmatchedTranscripts.join('\n')}>
                  {unmatchedTranscripts.length} .srt without matching media
                </p>
              )}
            </div>
          ) : (
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
              className={`text-center pb-6 border-b border-gray-700 mb-4 relative rounded-xl transition-colors ${mediaDrag ? 'bg-gray-800/60 border border-dashed border-gray-500' : ''}`}
            >
              <div className="flex justify-center mb-3 text-gray-300">
                <Music2 size={40} />
              </div>
              <p className="text-lg font-medium text-white mb-1">Upload audio or video</p>
              <p className="text-sm text-gray-400 mb-2">MP3, WAV, M4A, MP4, WebM - click or drop here</p>
              <p className="text-xs text-gray-500 mb-4">
                Up to 200MB. Big video? Use audio-only (MP3).
              </p>
              <input
                type="file"
                multiple
                accept="audio/*,video/mp4,video/webm,.mp4,.webm,.srt"
                onChange={handleMediaUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isSaving}
              />
              {mediaFile && !mediaNameConflict && (
                <p className="text-gray-200 font-medium relative z-10 pointer-events-none inline-flex max-w-full items-center gap-1.5">
                  <Check size={16} className="shrink-0" aria-hidden /> <span className="truncate">{mediaFile.name}</span>
                </p>
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
              className={`flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg relative transition-colors ${transcriptDrag ? 'ring-1 ring-gray-500 bg-gray-800/60' : ''}`}
            >
              <FileText size={20} className="text-gray-400 shrink-0" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-300">+ Add transcript (.srt)</p>
                <p className="text-xs text-gray-500 mt-0.5">Drop file here or click</p>
                {transcriptFile && (
                  <p className="text-xs text-gray-300 mt-1 inline-flex max-w-full items-center gap-1">
                    <Check size={12} className="shrink-0" aria-hidden /> <span className="truncate">{transcriptFile.name}</span>
                  </p>
                )}
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
          )}

          <Button
            type="button"
            variant="default"
            className="h-auto w-full justify-center gap-2 rounded-xl py-4 text-lg font-bold"
            disabled={(batch ? batchReady.length === 0 : !mediaFile || !lessonName) || isSaving}
            onClick={() => void (batch ? handleSubmitBatch() : handleSubmit())}
          >
            {isSaving ? (
              <>
                <span className="inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-current" aria-hidden />
                {batchProgress
                  ? `Uploading ${batchProgress.index + 1}/${batchProgress.total}… ${batchProgress.percent}%`
                  : uploadPercent !== null && uploadPercent < 100
                    ? `Uploading… ${uploadPercent}%`
                    : 'Saving…'}
              </>
            ) : batch ? (
              `Create ${batchReady.length} ${batchReady.length === 1 ? 'lesson' : 'lessons'}`
            ) : (
              'Create'
            )}
          </Button>
          {isSaving && uploadPercent !== null && (
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-gray-700"
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={uploadPercent}
            >
              <div className="h-full rounded-full bg-gray-200 transition-[width] duration-200" style={{ width: `${uploadPercent}%` }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
