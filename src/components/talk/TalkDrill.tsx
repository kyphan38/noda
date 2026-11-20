'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';

import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { answerItem, buildQueue, currentItem, isQueueDone, type DrillItem } from '@/lib/talk/learn-queue';
import { isPhraseSpoken, isPhraseTyped, makeCloze, phraseHint } from '@/lib/talk/phrase-check';
import { speak } from '@/lib/talk/speak';
import type { TalkPhrase } from '@/lib/talk/types';

type Result = { right: boolean; heard?: string } | null;

/** Fill the blank, then say each phrase from its meaning. A miss comes back a few items later. */
export function TalkDrill({ phrases, onDone }: { phrases: TalkPhrase[]; onDone: (misses: Record<string, number>) => void }) {
  const byId = useMemo(() => new Map(phrases.map((p) => [p.id, p])), [phrases]);
  const [queue, setQueue] = useState(() => buildQueue(phrases.map((p) => ({ id: p.id, hasCloze: makeCloze(p.example, p.text) !== null }))));
  const [result, setResult] = useState<Result>(null);

  const item = currentItem(queue);
  const phrase = item ? byId.get(item.phraseId) : undefined;

  const next = () => {
    if (!result) return;
    const q = answerItem(queue, result.right);
    setResult(null);
    if (isQueueDone(q)) onDone(q.misses);
    else setQueue(q);
  };

  if (!item || !phrase) return null;
  return (
    <div className="space-y-4">
      <div className="h-1 overflow-hidden rounded bg-gray-800">
        <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.round((queue.done / queue.total) * 100)}%` }} />
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
  const rec = useSpeechRecognition();
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
    const heard = await rec.listen();
    if (heard.length === 0) {
      setError('Nothing heard. Try again or type it.');
      return;
    }
    finish(heard.some((h) => isPhraseSpoken(h, phrase.text)), heard[0]);
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
            className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
          />
          {item.kind === 'recall' && rec.supported && (
            <button
              type="button"
              aria-label="Say it"
              onClick={() => (rec.status === 'listening' ? rec.stop() : void say())}
              className={`rounded-lg border px-3 ${rec.status === 'listening' ? 'border-red-500 text-red-400' : 'border-gray-700 text-gray-300 hover:text-gray-100'}`}
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {!result && (error || rec.error) && <p className="text-xs text-red-400">{error ?? rec.error}</p>}

      {result && (
        <div className="space-y-1">
          <p className={`text-sm ${result.right ? 'text-green-400' : 'text-red-400'}`}>{result.right ? 'Right' : 'Not quite'}</p>
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
        <button ref={nextRef} type="submit" className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500">
          {result ? 'Next' : 'Check'}
        </button>
      </div>
    </form>
  );
}
