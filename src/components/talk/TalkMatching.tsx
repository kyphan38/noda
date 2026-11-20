'use client';

import { useEffect, useMemo, useState } from 'react';

import { matchingRounds, shuffle } from '@/lib/talk/learn-queue';
import { speak } from '@/lib/talk/speak';
import type { TalkPhrase } from '@/lib/talk/types';

export type MatchProgress = { order: string[]; round: number; misses: Record<string, number> };

type Props = {
  phrases: TalkPhrase[];
  /** A saved shuffle and round to go on from; a fresh shuffle when missing. */
  resume?: MatchProgress;
  /** Called when a round starts, so the place can be saved. */
  onRound?: (p: MatchProgress) => void;
  onDone: (misses: Record<string, number>) => void;
};

/** Pair each phrase with its meaning, a few at a time. Reports wrong tries per phrase. */
export function TalkMatching({ phrases, resume, onRound, onDone }: Props) {
  // Shuffled once; a resumed set keeps its old order, so its rounds are the same.
  const [order] = useState(() => resume?.order ?? shuffle(phrases).map((p) => p.id));
  const rounds = useMemo(() => {
    const byId = new Map(phrases.map((p) => [p.id, p]));
    return matchingRounds(order.map((id) => byId.get(id)).filter((p): p is TalkPhrase => !!p));
  }, [order, phrases]);
  const [round, setRound] = useState(() => Math.min(resume?.round ?? 0, Math.max(0, rounds.length - 1)));
  const [misses, setMisses] = useState<Record<string, number>>(() => resume?.misses ?? {});

  useEffect(() => {
    onRound?.({ order, round, misses });
    // Only when a round starts: a miss is saved with the next round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const items = rounds[round] ?? [];
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 tabular-nums">
        Round {round + 1}/{rounds.length}
      </p>
      <Round
        key={round}
        items={items}
        onMiss={(id) => setMisses((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }))}
        onDone={() => {
          if (round + 1 < rounds.length) setRound(round + 1);
          else onDone(misses);
        }}
      />
    </div>
  );
}

function Round({ items, onMiss, onDone }: { items: TalkPhrase[]; onMiss: (id: string) => void; onDone: () => void }) {
  const left = useMemo(() => shuffle(items), [items]);
  const right = useMemo(() => shuffle(items), [items]);
  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);

  const pickMeaning = (id: string) => {
    if (!picked || matched.has(id)) return;
    if (id === picked) {
      const next = new Set(matched).add(id);
      setMatched(next);
      setPicked(null);
      if (next.size === items.length) setTimeout(onDone, 400);
    } else {
      onMiss(picked);
      setWrong(id);
      setTimeout(() => setWrong(null), 500);
    }
  };

  const cell = 'w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors';
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-2">
        {left.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={matched.has(p.id)}
            onClick={() => {
              setPicked(p.id);
              speak(p.text);
            }}
            className={`${cell} ${
              matched.has(p.id)
                ? 'border-gray-800 text-gray-600'
                : picked === p.id
                  ? 'border-gray-500 bg-gray-800 text-gray-100'
                  : 'border-gray-800 text-gray-100 hover:border-gray-600'
            }`}
          >
            {p.text}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {right.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={matched.has(p.id)}
            onClick={() => pickMeaning(p.id)}
            className={`${cell} ${
              matched.has(p.id)
                ? 'border-gray-800 text-gray-600'
                : wrong === p.id
                  ? 'border-red-400 text-red-400'
                  : 'border-gray-800 text-gray-300 hover:border-gray-600'
            }`}
          >
            {p.meaning}
          </button>
        ))}
      </div>
    </div>
  );
}
