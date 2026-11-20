"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { blobToBase64 } from '@/lib/speakingCheck';
import { friendlyError } from '@/lib/talk/errors';
import { BROWSER_DEAD, isAppleTouch, pickEngine, speechErrorReason, type ListenEngine } from '@/lib/talk/listen';
import { stopSpeaking } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';

// Only the parts of the Web Speech API used here (not in TypeScript's DOM lib yet).
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Once the browser's speech fails for good, the rest of the visit uses Gemini. */
let browserFailed = false;
/** A short phrase or sentence; Gemini recording stops by itself after this. */
const MAX_RECORD_MS = 20_000;

export type ListenStatus = 'idle' | 'listening' | 'checking';
export type ListenResult = { heard: string[]; reason?: string };

/**
 * Hear one short answer. Tap to start, tap again (stop) to finish. Always
 * resolves with what was heard, or a plain reason when nothing was.
 */
export function useListen() {
  const recorder = useVoiceRecorder();
  const [status, setStatus] = useState<ListenStatus>('idle');
  const [engine, setEngine] = useState<ListenEngine>('gemini');
  const recRef = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<((r: ListenResult) => void) | null>(null);

  useEffect(() => {
    setEngine(
      pickEngine({
        hasWebSpeech: getCtor() !== null,
        appleTouch: isAppleTouch(navigator.userAgent, navigator.platform, navigator.maxTouchPoints),
        browserFailed,
      }),
    );
    return () => recRef.current?.abort();
  }, []);

  const listenBrowser = useCallback((): Promise<ListenResult> => {
    const Ctor = getCtor()!;
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    setStatus('listening');
    return new Promise((resolve) => {
      let heard: string[] = [];
      let code = '';
      rec.onresult = (e) => {
        const first = e.results[0];
        heard = first ? Array.from(first, (a) => a.transcript.trim()).filter(Boolean) : [];
      };
      rec.onerror = (e) => {
        code = e.error;
      };
      rec.onend = () => {
        if (recRef.current === rec) recRef.current = null;
        setStatus('idle');
        if (BROWSER_DEAD.has(code)) {
          browserFailed = true;
          setEngine('gemini');
        }
        resolve(heard.length ? { heard } : { heard, reason: speechErrorReason(code || 'no-speech') });
      };
      rec.start();
    });
  }, []);

  const finishRecording = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const done = pending.current;
    pending.current = null;
    const blob = await recorder.stop();
    if (!done) return;
    if (!blob) {
      setStatus('idle');
      return done({ heard: [], reason: 'Nothing was recorded. Try again.' });
    }
    setStatus('checking');
    try {
      const r = await getTalkStore().speech({ mode: 'transcribe', source: '', recording: await blobToBase64(blob), recordingMimeType: blob.type || 'audio/webm' });
      done(r.transcript ? { heard: [r.transcript] } : { heard: [], reason: 'No speech heard. Try again.' });
    } catch (e) {
      done({ heard: [], reason: friendlyError(e, 'Could not check the recording.') });
    } finally {
      setStatus('idle');
    }
  }, [recorder]);

  const listenGemini = useCallback(async (): Promise<ListenResult> => {
    if (!(await recorder.start())) return { heard: [], reason: recorder.error ?? 'The microphone is blocked. Allow it in your settings.' };
    setStatus('listening');
    timer.current = setTimeout(() => void finishRecording(), MAX_RECORD_MS);
    return new Promise((resolve) => {
      pending.current = resolve;
    });
  }, [recorder, finishRecording]);

  const listen = useCallback((): Promise<ListenResult> => {
    stopSpeaking();
    return engine === 'browser' ? listenBrowser() : listenGemini();
  }, [engine, listenBrowser, listenGemini]);

  /** Finish now: the browser stops listening, a recording is sent. */
  const stop = useCallback(() => {
    if (recRef.current) recRef.current.stop();
    else void finishRecording();
  }, [finishRecording]);

  return { status, engine, listen, stop };
}
