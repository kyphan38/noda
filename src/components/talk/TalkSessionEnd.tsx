'use client';

import { useState } from 'react';

import { TalkReviewCard } from '@/components/talk/TalkReviewCard';
import { topSessionFixes, wordsPerMinute } from '@/lib/talk/session';
import { getTalkStore } from '@/lib/talk/store';
import type { TalkPhrase, TalkSession } from '@/lib/talk/types';

type Props = { session: TalkSession; phrases: TalkPhrase[]; onChange: (s: TalkSession) => void; onExit: () => void };

/** End of a talk: a few numbers, the fixes that matter most, and every answer to look at again. */
export function TalkSessionEnd({ session, phrases, onChange, onExit }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const turns = session.turns;
  const used = new Set(turns.flatMap((t) => t.usedPhraseIds));
  const words = turns.reduce((n, t) => n + t.transcript.split(/\s+/).filter(Boolean).length, 0);
  const seconds = turns.reduce((n, t) => n + t.seconds, 0);
  const top = topSessionFixes(turns);

  const stats = [
    { label: 'Phrases used', value: `${used.size}/${phrases.length}` },
    { label: 'Words per answer', value: turns.length ? Math.round(words / turns.length) : 0 },
    { label: 'Words per minute', value: wordsPerMinute(turns.map((t) => t.transcript).join(' '), seconds) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-gray-900/60 p-3">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl text-gray-100 tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {top.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-gray-400">Top fixes</h2>
          <ul className="space-y-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            {top.map((f) => (
              <li key={`${f.turn}-${f.index}`} className="text-sm">
                <span className="text-gray-500 line-through">{f.wrong}</span>
                <span className="mx-1.5 text-gray-500">→</span>
                <span className="font-medium text-gray-100">{f.right}</span>
                {f.why && <span className="block text-xs text-gray-400">{f.why}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-400">Your answers</h2>
        <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">
          {turns.map((t, i) => (
            <li key={i}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="w-full px-4 py-3 text-left hover:bg-gray-800/60">
                <span className="block text-xs text-gray-500">{t.ai.text}</span>
                <span className="block truncate text-sm text-gray-100">{t.transcript}</span>
              </button>
              {open === i && (
                <div className="px-4 pb-4">
                  <TalkReviewCard
                    turn={t}
                    selfRepair={false}
                    onChange={(patch) => {
                      const s = { ...session, turns: turns.map((x, j) => (j === i ? { ...x, ...patch } : x)) };
                      onChange(s);
                      void getTalkStore().saveSession(s).catch(() => {});
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <button type="button" onClick={onExit} className="w-full rounded-lg bg-gray-100 font-medium text-gray-900 hover:bg-white py-2 text-sm">
        Done
      </button>
    </div>
  );
}
