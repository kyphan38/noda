"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { SPEAKING_MAX_RECORDING_MS } from '@/constants';

export type RecorderStatus = 'idle' | 'starting' | 'recording';

/** Opus in WebM on Chrome/Firefox, AAC in MP4 on Safari. ffmpeg on the server reads both. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) =>
    MediaRecorder.isTypeSupported(t)
  );
}

/**
 * Microphone recording with MediaRecorder. `start()` asks for the mic; `stop()`
 * resolves with the recording. The mic is released after every take so the
 * browser's recording indicator goes away between takes.
 */
export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const release = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (limitRef.current) clearTimeout(limitRef.current);
    tickRef.current = null;
    limitRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (recorderRef.current) return false;
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording is not supported in this browser.');
      return false;
    }
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        chunksRef.current = [];
        release();
        setStatus('idle');
        resolveRef.current?.(blob.size > 0 ? blob : null);
        resolveRef.current = null;
      };
      recorder.start();
      const startedAt = performance.now();
      setElapsedMs(0);
      tickRef.current = setInterval(() => setElapsedMs(performance.now() - startedAt), 200);
      limitRef.current = setTimeout(() => {
        void stop();
      }, SPEAKING_MAX_RECORDING_MS);
      setStatus('recording');
      return true;
    } catch (e) {
      release();
      setStatus('idle');
      const name = e instanceof DOMException ? e.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access is blocked. Allow it in the browser settings.'
          : name === 'NotFoundError'
            ? 'No microphone found.'
            : 'Could not start recording.'
      );
      return false;
    }
  }, [release, stop]);

  /** Drops the current take without returning it. */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    resolveRef.current = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else release();
    setStatus('idle');
  }, [release]);

  useEffect(() => cancel, [cancel]);

  return { status, elapsedMs, error, start, stop, cancel };
}
