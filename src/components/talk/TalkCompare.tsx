'use client';

import { useEffect, useState } from 'react';

import { talkNumbers, type TalkNumbers } from '@/lib/talk/stats';
import { getTalkStore } from '@/lib/talk/store';
import type { TalkSession } from '@/lib/talk/types';

const ROWS: { key: keyof TalkNumbers; label: string; better: 'up' | 'down' }[] = [
  { key: 'wordsPerAnswer', label: 'Words per answer', better: 'up' },
  { key: 'wpm', label: 'Words per minute', better: 'up' },
  { key: 'fixesPerAnswer', label: 'Fixes per answer', better: 'down' },
  { key: 'phrasesUsed', label: 'Phrases used', better: 'up' },
];

/** The same situation, last time and now. Nothing when this talk is not a redo. */
export function TalkCompare({ session }: { session: TalkSession }) {
  const [before, setBefore] = useState<TalkSession | null>(null);

  useEffect(() => {
    if (!session.redoOf) return;
    let alive = true;
    getTalkStore()
      .getSession(session.redoOf)
      .then((s) => alive && setBefore(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [session.redoOf]);

  if (!before || before.turns.length === 0) return null;
  const a = talkNumbers(before);
  const b = talkNumbers(session);
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-gray-400">Last time → now</h2>
      <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">
        {ROWS.map((r) => {
          const gain = r.better === 'up' ? b[r.key] > a[r.key] : b[r.key] < a[r.key];
          return (
            <li key={r.key} className="flex items-baseline justify-between px-4 py-2 text-sm">
              <span className="text-gray-400">{r.label}</span>
              <span className="tabular-nums">
                <span className="text-gray-500">{a[r.key]}</span>
                <span className="mx-1.5 text-gray-500">→</span>
                <span className={gain ? 'font-medium text-gray-100' : 'text-gray-300'}>{b[r.key]}</span>
                {gain && <span className="ml-1 text-gray-100">✓</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
