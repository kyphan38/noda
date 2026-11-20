"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

// The Web Speech API is not in TypeScript's DOM lib yet; only the parts used here.
type RecognitionAlternative = { transcript: string };
type RecognitionEvent = { results: ArrayLike<ArrayLike<RecognitionAlternative>> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
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

export type ListenStatus = 'idle' | 'listening';

/**
 * One phrase of speech to text, free, in the browser (Chrome and Edge send the
 * audio to their own service). `listen()` resolves with the best guesses, or
 * an empty list when nothing was heard.
 */
export function useSpeechRecognition(lang = 'en-US') {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<ListenStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => recRef.current?.abort();
  }, []);

  const listen = useCallback((): Promise<string[]> => {
    const Ctor = getCtor();
    if (!Ctor) return Promise.resolve([]);
    recRef.current?.abort();
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    setError(null);
    setStatus('listening');
    return new Promise((resolve) => {
      let heard: string[] = [];
      rec.onresult = (e) => {
        const first = e.results[0];
        heard = first ? Array.from(first, (a) => a.transcript.trim()).filter(Boolean) : [];
      };
      rec.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') setError(e.error === 'not-allowed' ? 'Microphone is blocked.' : 'Could not hear you.');
      };
      rec.onend = () => {
        if (recRef.current === rec) recRef.current = null;
        setStatus('idle');
        resolve(heard);
      };
      rec.start();
    });
  }, [lang]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported, status, error, listen, stop };
}
