'use client';

import { useState } from 'react';
import { Mic } from 'lucide-react';

import { useListen } from '@/hooks/useListen';

/**
 * Say (or type) an answer, then hand the guesses to `onAnswer`. Listening uses
 * the browser where it works and Gemini on iPhone (see useListen).
 */
export function TalkSayCheck({ placeholder, onAnswer }: { placeholder: string; onAnswer: (guesses: string[]) => void }) {
  const rec = useListen();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const say = async () => {
    setError(null);
    const r = await rec.listen();
    if (r.heard.length === 0) setError(r.reason ?? 'No speech heard. Try again or type it.');
    else onAnswer(r.heard);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return setError('Type an answer first.');
        onAnswer([text]);
      }}
      className="space-y-1"
    >
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
        />
        <button
          type="button"
          aria-label={rec.status === 'listening' ? 'Stop' : 'Say it'}
          disabled={rec.status === 'checking'}
          onClick={() => (rec.status === 'listening' ? rec.stop() : void say())}
          className={`rounded-lg border px-3 ${rec.status === 'listening' ? 'border-red-400 text-red-400' : 'border-gray-700 text-gray-300 hover:text-gray-100'}`}
        >
          <Mic className="h-4 w-4" />
        </button>
        <button type="submit" className="rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-900 hover:bg-white">
          Check
        </button>
      </div>
      {rec.status !== 'idle' && <p className="text-xs text-gray-500">{rec.status === 'listening' ? 'Listening… tap the mic again when you are done.' : 'Checking…'}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
