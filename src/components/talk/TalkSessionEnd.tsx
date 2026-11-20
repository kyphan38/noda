'use client';

import { useEffect, useState } from 'react';

import { TalkCompare } from '@/components/talk/TalkCompare';
import { TalkNotes } from '@/components/talk/TalkNotes';
import { TalkReviewCard } from '@/components/talk/TalkReviewCard';
import { addSessionFixes } from '@/lib/talk/mistake-bank';
import { GRADE_LABEL, rateTalk } from '@/lib/talk/rating';
import { topSessionFixes, wordsPerMinute } from '@/lib/talk/session';
import { getTalkStore } from '@/lib/talk/store';
import type { TalkPhrase, TalkSession } from '@/lib/talk/types';

type Props = { session: TalkSession; phrases: TalkPhrase[]; onChange: (s: TalkSession) => void; onExit: () => void; onRedo?: () => void };

/** End of a talk: a few numbers, the fixes that matter most, and every answer to look at again. */
export function TalkSessionEnd({ session, phrases, onChange, onExit, onRedo }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const turns = session.turns;

  // Once per talk: its fixes go into the mistake bank for the next warm-up.
  useEffect(() => {
    if (session.banked || turns.length === 0) return;
    const store = getTalkStore();
    const banked = { ...session, banked: true };
    onChange(banked);
    void store
      .listMistakes()
      .then((rows) => store.saveMistakes(addSessionFixes(new Map(rows.map((m) => [m.pattern, m])), turns, session.id, Date.now())))
      .then(() => store.saveSession(banked))
      .catch((e) => console.warn('[talk] mistake bank save failed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const top = topSessionFixes(turns);
  const ratings = rateTalk(session, phrases.length);
  const seconds = turns.reduce((n, t) => n + t.seconds, 0);
  const wpm = wordsPerMinute(turns.map((t) => t.transcript).join(' '), seconds);

  return (
    <div className="mx-auto w-full max-w-xl pb-10 sm:pb-16 space-y-6">
      <button type="button" onClick={onExit} className="text-sm text-gray-400 hover:text-gray-100">
        ← Back to the topic
      </button>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-gray-400">
          This talk <span className="ml-1 text-xs font-normal text-gray-500">{turns.length} answers · {wpm} words/min</span>
        </h2>
        <ul className="space-y-2.5">
          {ratings.map((r) => (
            <li key={r.name} className="flex items-baseline gap-3 text-sm">
              <span className="w-20 shrink-0 text-gray-400">{r.name}</span>
              <span className="shrink-0 tracking-widest text-gray-100" aria-hidden="true">
                {'●'.repeat(r.grade)}
                <span className="text-gray-700">{'●'.repeat(3 - r.grade)}</span>
              </span>
              <span className="min-w-0">
                <span className="text-gray-100">{GRADE_LABEL[r.grade]}</span>
                <span className="block text-xs text-gray-500">{r.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

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

      <TalkCompare session={session} />

      <TalkNotes session={session} phrases={phrases} onWrap={(wrap) => onChange({ ...session, banked: true, wrap })} />

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

      <div className="flex gap-2">
        {onRedo && turns.length > 0 && (
          <button type="button" onClick={onRedo} className="rounded-lg border border-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-100/[0.06]">
            Talk this again
          </button>
        )}
        <button type="button" onClick={onExit} className="flex-1 rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 hover:bg-white">
          Done
        </button>
      </div>
    </div>
  );
}
