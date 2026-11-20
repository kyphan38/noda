'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';

import { useListen } from '@/hooks/useListen';
import { answerItem, buildQueue, currentItem, isQueueDone, type DrillItem, type LearnQueue } from '@/lib/talk/learn-queue';
import { isPhraseSpoken, isPhraseTyped, makeCloze, phraseHint } from '@/lib/talk/phrase-check';
import { speak } from '@/lib/talk/speak';
import type { TalkPhrase } from '@/lib/talk/types';

type Result = { right: boolean; heard?: string } | null;

type Props = {
  phrases: TalkPhrase[];
  /** A saved queue to go on from; a fresh one when missing. */
  resume?: LearnQueue;
  /** Called with the queue at the start and after every answer, so the place can be saved. */
  onQueue?: (q: LearnQueue) => void;
  onDone: (misses: Record<string, number>) => void;
};

/** Fill the blank, then say each phrase from its meaning. A miss comes back a few items later. */
export function TalkDrill({ phrases, resume, onQueue, onDone }: Props) {
  const byId = useMemo(() => new Map(phrases.map((p) => [p.id, p])), [phrases]);
  const [queue, setQueue] = useState(() => resume ?? buildQueue(phrases.map((p) => ({ id: p.id, hasCloze: makeCloze(p.example, p.text) !== null }))));
  const [result, setResult] = useState<Result>(null);

  useEffect(() => {
    onQueue?.(queue);
    // Once at the start; answers report below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = currentItem(queue);
  const phrase = item ? byId.get(item.phraseId) : undefined;

  const next = () => {
    if (!result) return;
    const q = answerItem(queue, result.right);
    setResult(null);
    if (isQueueDone(q)) onDone(q.misses);
    else {
      setQueue(q);
      onQueue?.(q);
    }
  };

  if (!item || !phrase) return null;
  return (
    <div className="space-y-4">
      <div className="h-1 overflow-hidden rounded bg-gray-800">
        <div className="h-full bg-gray-100 transition-all" style={{ width: `${Math.round((queue.done / queue.total) * 100)}%` }} />
      </div>
      <Item key={`${item.kind}:${item.phraseId}:${queue.done}:${queue.items.length}`} item={item} phrase={phrase} result={result} onResult={setResult} onNext={next} />
    </div>
  );
}

function Item(props: { item: DrillItem; phrase: TalkPhrase; result: Result; onResult: (r: Result) => void; onNext: () => void }) {
  const { item, phrase, result, onResult, onNext } = props;
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const rec = useListen();
  const cloze = item.kind === 'cloze' ? makeCloze(phrase.example, phrase.text) : null;

  useEffect(() => {
    (result ? nextRef : inputRef).current?.focus();
  }, [result]);

  const finish = (right: boolean, heard?: string) => {
    onResult({ right, heard });
    speak(item.kind === 'cloze' ? phrase.example : phrase.text);
  };

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    if (result) return onNext();
    if (!text.trim()) {
      setError('Type an answer first.');
      return;
    }
    finish(isPhraseTyped(text, phrase.text));
  };

  const say = async () => {
    setError(null);
    const r = await rec.listen();
    if (r.heard.length === 0) {
      setError(r.reason ?? 'No speech heard. Try again or type it.');
      return;
    }
    finish(r.heard.some((h) => isPhraseSpoken(h, phrase.text)), r.heard[0]);
  };

  return (
    <form onSubmit={check} className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      {cloze ? (
        <p className="text-base leading-relaxed text-gray-100">
          {cloze.before}
          <span className="mx-1 rounded bg-gray-800 px-2 font-mono text-sm text-gray-400">{result ? cloze.answer : hint ? phraseHint(phrase.text) : '_____'}</span>
          {cloze.after}
        </p>
      ) : (
        <p className="text-base text-gray-100">Say the phrase that means:</p>
      )}
      <p className="text-sm text-gray-400">{phrase.meaning}</p>

      {!result && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
            placeholder={item.kind === 'cloze' ? 'Fill the blank' : 'Type it, or tap the mic'}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
          />
          {item.kind === 'recall' && (
            <button
              type="button"
              aria-label={rec.status === 'listening' ? 'Stop' : 'Say it'}
              disabled={rec.status === 'checking'}
              onClick={() => (rec.status === 'listening' ? rec.stop() : void say())}
              className={`rounded-lg border px-3 disabled:opacity-50 ${rec.status === 'listening' ? 'border-red-400 text-red-400' : 'border-gray-700 text-gray-300 hover:text-gray-100'}`}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {!result && rec.status !== 'idle' && (
        <p className="text-xs text-gray-500">{rec.status === 'listening' ? 'Listening… tap the mic again when you are done.' : <span className="breathe">Checking…</span>}</p>
      )}
      {!result && error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="space-y-1">
          <p className={`text-sm ${result.right ? 'text-gray-100' : 'text-red-400'}`}>{result.right ? 'Right' : 'Not quite'}</p>
          {result.heard && <p className="text-xs text-gray-500">Heard: “{result.heard}”</p>}
          <p className="flex items-center gap-2 text-base text-gray-100">
            <button type="button" aria-label="Play again" onClick={() => speak(phrase.text)} className="text-gray-500 hover:text-gray-100">
              <Volume2 className="h-4 w-4" />
            </button>
            {phrase.text}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        {!result && item.kind === 'cloze' ? (
          <button type="button" onClick={() => setHint(true)} className="text-xs text-gray-500 hover:text-gray-100">
            Hint
          </button>
        ) : (
          <span />
        )}
        <button ref={nextRef} type="submit" className="rounded-lg bg-gray-100 font-medium text-gray-900 hover:bg-white px-3 py-1.5 text-sm">
          {result ? 'Next' : 'Check'}
        </button>
      </div>
    </form>
  );
}
