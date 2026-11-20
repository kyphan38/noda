'use client';

import { useState } from 'react';

import type { TalkHint } from '@/lib/db';
import { getTalkStore } from '@/lib/talk/store';

/** Hint level 2: type the idea in simple words, get chunks to build the answer. Never a full answer. */
export function TalkHelp({ topicId, aiLine }: { topicId: string; aiLine: string }) {
  const [idea, setIdea] = useState('');
  const [hints, setHints] = useState<TalkHint[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return setError('Write your idea in a few simple words.');
    setBusy(true);
    setError(null);
    try {
      setHints(await getTalkStore().hint(topicId, aiLine, idea.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get hints.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <form onSubmit={ask} className="flex gap-2">
        <input
          value={idea}
          maxLength={200}
          onChange={(e) => {
            setIdea(e.target.value);
            setError(null);
          }}
          placeholder="Your idea in simple words"
          className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-transparent px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
        />
        <button type="submit" disabled={busy} className="rounded-lg border border-gray-700 px-3 text-sm text-gray-300 hover:text-gray-100 disabled:cursor-wait">
          {busy ? '…' : 'Get words'}
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hints && (
        <ul className="space-y-1">
          {hints.map((h) => (
            <li key={h.text} className="text-sm">
              <span className="rounded-md bg-gray-800 px-2 py-0.5 text-gray-100">{h.text}</span>
              {h.use && <span className="ml-2 text-xs text-gray-500">{h.use}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
