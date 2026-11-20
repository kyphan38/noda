'use client';

import { useMemo, useState } from 'react';

import { matchingRounds, shuffle } from '@/lib/talk/learn-queue';
import { speak } from '@/lib/talk/speak';
import type { TalkPhrase } from '@/lib/talk/types';

/** Pair each phrase with its meaning, a few at a time. Reports wrong tries per phrase. */
export function TalkMatching({ phrases, onDone }: { phrases: TalkPhrase[]; onDone: (misses: Record<string, number>) => void }) {
  const rounds = useMemo(() => matchingRounds(shuffle(phrases)), [phrases]);
  const [round, setRound] = useState(0);
  const [misses, setMisses] = useState<Record<string, number>>({});

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
                ? 'border-green-700/50 text-green-400/60'
                : picked === p.id
                  ? 'border-blue-500 bg-blue-500/15 text-blue-200'
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
                ? 'border-green-700/50 text-green-400/60'
                : wrong === p.id
                  ? 'border-red-500 text-red-300'
                  : 'border-gray-800 text-gray-300 hover:border-gray-600'
            }`}
          >
            {p.vi}
          </button>
        ))}
      </div>
    </div>
  );
}
