'use client';

import { useEffect, useState } from 'react';

import { TalkSayCheck } from '@/components/talk/TalkSayCheck';
import { applyWarmupAnswer, patternLabel, pickWarmup, type TalkMistake, type WarmupItem } from '@/lib/talk/mistake-bank';
import { isPhraseSpoken, isPhraseTyped } from '@/lib/talk/phrase-check';
import { getTalkStore } from '@/lib/talk/store';

/**
 * Fix a few of your own past Talk mistakes: before a talk, or in Today's review.
 * Calls onDone at once when the bank is empty.
 */
export function TalkWarmup({ onDone, title = 'Warm-up', doneLabel = 'Start the talk' }: { onDone: () => void; title?: string; doneLabel?: string }) {
  const [bank, setBank] = useState<Map<string, TalkMistake> | null>(null);
  const [items, setItems] = useState<WarmupItem[]>([]);
  const [i, setI] = useState(0);
  const [right, setRight] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    getTalkStore()
      .listMistakes()
      .catch(() => [])
      .then((rows) => {
        if (!alive) return;
        const picked = pickWarmup(rows);
        if (picked.length === 0) return onDone();
        setBank(new Map(rows.map((m) => [m.pattern, m])));
        setItems(picked);
      });
    return () => {
      alive = false;
    };
    // Loaded once when the talk opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const item = items[i];
  if (!bank || !item) return null;

  const answer = (guesses: string[]) => {
    const ok = guesses.some((g) => isPhraseTyped(g, item.right) || isPhraseSpoken(g, item.right));
    setRight(ok);
    const m = bank.get(item.pattern);
    if (!m) return;
    const next = applyWarmupAnswer(m, ok, Date.now());
    setBank(new Map(bank).set(m.pattern, next));
    void getTalkStore().saveMistakes([next]).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-400">
          {title} <span className="ml-1 text-xs text-gray-500 tabular-nums">{i + 1}/{items.length}</span>
        </h2>
        <button type="button" onClick={onDone} className="text-xs text-gray-500 hover:text-gray-100">
          Skip
        </button>
      </div>
      <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <p className="text-xs text-gray-500">{patternLabel(item.pattern)}</p>
        <p className="text-base text-gray-100">
          Fix it: <span className="rounded-sm bg-gray-800 px-1 underline decoration-gray-500 decoration-wavy underline-offset-4">{item.wrong}</span>
        </p>
        {right === null ? (
          <TalkSayCheck key={i} placeholder="Say or type the right words" onAnswer={answer} />
        ) : (
          <>
            <p className="text-sm">
              <span className={right ? 'text-gray-100' : 'text-red-400'}>{right ? 'Right' : 'Not quite'}</span>
              <span className="mx-2 text-gray-500">·</span>
              <span className="font-medium text-gray-100">{item.right}</span>
            </p>
            {item.why && <p className="text-xs text-gray-400">{item.why}</p>}
            <button
              type="button"
              onClick={() => {
                setRight(null);
                if (i + 1 < items.length) setI(i + 1);
                else onDone();
              }}
              className="w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-900 hover:bg-white"
            >
              {i + 1 < items.length ? 'Next' : doneLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
