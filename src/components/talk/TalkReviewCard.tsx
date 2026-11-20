'use client';

import { useState } from 'react';
import { Volume2 } from 'lucide-react';

import { fixSegments } from '@/lib/talk/session';
import { speak } from '@/lib/talk/speak';
import type { TalkTurn } from '@/lib/talk/types';

export type VersionKey = 'correct' | 'natural' | 'levelUp';
export const VERSIONS: { key: VersionKey; label: string }[] = [
  { key: 'correct', label: 'Correct' },
  { key: 'natural', label: 'Natural' },
  { key: 'levelUp', label: 'Level up' },
];

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]+/g, '').replace(/\s+/g, ' ').trim();

type Props = {
  turn: TalkTurn;
  selfRepair: boolean;
  onChange: (patch: Partial<TalkTurn>) => void;
  /** Controlled from the talk (keys 1-3 on a computer); internal when missing. */
  level?: VersionKey;
  onLevel?: (v: VersionKey) => void;
  showKeys?: boolean;
};

/** Review of one answer, no boxes: your words with marks, three versions, the fixes folded. */
export function TalkReviewCard({ turn, selfRepair, onChange, level, onLevel, showKeys }: Props) {
  const fixes = turn.review.fixes;
  const dismissed = turn.dismissedFixes ?? [];
  const live = fixes.filter((_, i) => !dismissed.includes(i)).length;
  const [shown, setShown] = useState(!selfRepair || fixes.length === 0);
  const [own, setOwn] = useState<VersionKey>('natural');
  const [openFixes, setOpenFixes] = useState(false);
  const pick = (v: VersionKey) => (onLevel ? onLevel(v) : setOwn(v));
  // "Correct" says the same as you when nothing was wrong: not worth a tab.
  const versions = VERSIONS.filter((v) => v.key !== 'correct' || plain(turn.review.correct) !== plain(turn.transcript));
  const wanted = level ?? own;
  const showing = versions.some((v) => v.key === wanted) ? wanted : 'natural';

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs text-gray-500">You</p>
        <p className="text-base leading-relaxed text-gray-100">
          {fixSegments(turn.transcript, fixes, dismissed).map((s, i) =>
            s.fix === undefined ? (
              <span key={i}>{s.text}</span>
            ) : (
              <mark key={i} className="bg-transparent text-gray-100 underline decoration-gray-500 decoration-wavy underline-offset-4">
                {s.text}
              </mark>
            ),
          )}
        </p>
        {live === 0 && <p className="mt-1 text-xs text-gray-500">No mistakes ✓</p>}
        {!shown && (
          <p className="mt-2 text-sm text-gray-400">
            Fix the marked parts in your head, then{' '}
            <button type="button" onClick={() => setShown(true)} className="text-gray-100 underline underline-offset-2">
              Show answer
            </button>
            .
          </p>
        )}
      </div>

      {shown && (
        <div className="space-y-3 border-t border-gray-800 pt-3">
          <div className="flex items-center gap-4 text-xs" role="tablist">
            {versions.map((v) => (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={showing === v.key}
                onClick={() => pick(v.key)}
                className={`pb-0.5 ${showing === v.key ? 'border-b border-gray-100 text-gray-100' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {v.label}
                {showKeys && <span className="ml-1 text-[10px] text-gray-600">{VERSIONS.indexOf(v) + 1}</span>}
              </button>
            ))}
            <button type="button" aria-label="Play" onClick={() => speak(turn.review[showing])} className="ml-auto text-gray-500 hover:text-gray-100">
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
          <p className="text-base leading-relaxed text-gray-100">{turn.review[showing]}</p>
          {turn.review.structure && <p className="text-xs text-gray-400">Order: {turn.review.structure}</p>}

          {fixes.length > 0 && (
            <div>
              <button type="button" onClick={() => setOpenFixes((v) => !v)} className="text-xs text-gray-400 hover:text-gray-100">
                {fixes.length} {fixes.length === 1 ? 'fix' : 'fixes'} {openFixes ? '▴' : '▸'}
              </button>
              {openFixes && (
                <ul className="mt-2 space-y-2">
                  {fixes.map((f, i) => (
                    <li key={i} className={`text-sm ${dismissed.includes(i) ? 'opacity-40' : ''}`}>
                      <span className="text-gray-500 line-through">{f.wrong}</span>
                      <span className="mx-1.5 text-gray-600">→</span>
                      <span className="text-gray-100">{f.right}</span>
                      {f.why && <span className="block text-xs text-gray-500">{f.why}</span>}
                      {!dismissed.includes(i) && (
                        <button type="button" onClick={() => onChange({ dismissedFixes: [...dismissed, i] })} className="text-[11px] text-gray-600 hover:text-gray-300">
                          I said it right
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
