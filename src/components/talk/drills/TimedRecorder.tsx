'use client';

import { useEffect, useRef } from 'react';
import { Mic, Square } from 'lucide-react';

import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

/** Record for up to `limit` seconds: it stops by itself at the limit, or on tap. */
export function TimedRecorder({ limit, busy, onBlob }: { limit: number; busy?: boolean; onBlob: (blob: Blob) => void }) {
  const rec = useVoiceRecorder();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBlobRef = useRef(onBlob);
  useEffect(() => {
    onBlobRef.current = onBlob;
  }, [onBlob]);

  const stop = async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const blob = await rec.stop();
    if (blob) onBlobRef.current(blob);
  };

  const start = async () => {
    window.speechSynthesis?.cancel();
    if (!(await rec.start())) return;
    timer.current = setTimeout(() => void stop(), limit * 1000);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const left = Math.max(0, limit - Math.floor(rec.elapsedMs / 1000));
  const recording = rec.status === 'recording';
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <button
        type="button"
        aria-label={recording ? 'Stop' : 'Record'}
        disabled={busy || rec.status === 'starting'}
        onClick={() => void (recording ? stop() : start())}
        className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
          recording ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-gray-100 text-gray-900 hover:bg-white'
        }`}
      >
        {recording ? <Square className="h-5 w-5" /> : <Mic className="h-6 w-6" />}
      </button>
      <p className="text-xs text-gray-500 tabular-nums">{busy ? <span className="breathe">Checking…</span> : recording ? `${left}s left` : `Up to ${limit}s`}</p>
      {rec.error && <p className="text-xs text-red-400">{rec.error}</p>}
    </div>
  );
}
