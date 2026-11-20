'use client';

import { useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';

import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { checkParagraph, type WordMark } from '@/lib/paragraph-dictation';
import { fixSegments } from '@/lib/talk/session';
import { speak } from '@/lib/talk/speak';
import type { TalkTurn } from '@/lib/talk/types';

const LEVELS = [
  { key: 'correct', label: 'Correct', note: 'Your words, fixed' },
  { key: 'natural', label: 'Natural', note: 'How a colleague says it' },
  { key: 'levelUp', label: 'Level up', note: 'One step above' },
] as const;


type Props = { turn: TalkTurn; selfRepair: boolean; onChange: (patch: Partial<TalkTurn>) => void };

/** Review of one answer: marked transcript, try-it-yourself, three versions, top fixes, say it again. */
export function TalkReviewCard({ turn, selfRepair, onChange }: Props) {
  const fixes = turn.review.fixes;
  const dismissed = turn.dismissedFixes ?? [];
  const [shown, setShown] = useState(!selfRepair || fixes.length === 0);
  const [level, setLevel] = useState<(typeof LEVELS)[number]['key']>('correct');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
        <p className="mb-1 text-xs text-gray-500">You said</p>
        <p className="text-base leading-relaxed text-gray-100">
          {fixSegments(turn.transcript, fixes, dismissed).map((s, i) =>
            s.fix === undefined ? (
              <span key={i}>{s.text}</span>
            ) : (
              <mark key={i} className="rounded-sm bg-gray-800 px-0.5 text-gray-100 underline decoration-gray-500 decoration-wavy underline-offset-4">
                {s.text}
              </mark>
            ),
          )}
        </p>
        {!shown && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-400">Fix the marked parts in your head, then check.</p>
            <button type="button" onClick={() => setShown(true)} className="shrink-0 rounded-lg bg-gray-100 font-medium text-gray-900 hover:bg-white px-3 py-1.5 text-sm">
              Show answer
            </button>
          </div>
        )}
        {shown && fixes.length === 0 && <p className="mt-2 text-sm text-gray-400">No mistakes found.</p>}
        {shown && turn.review.structure && (
          <p className="mt-2 text-sm text-gray-300">
            <span className="mr-2 rounded bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-400">order</span>
            {turn.review.structure}
          </p>
        )}
      </div>

      {shown && (
        <>
          <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLevel(l.key)}
                  className={`rounded-lg border px-2.5 py-1 text-xs ${level === l.key ? 'border-gray-500 bg-gray-800 text-gray-100' : 'border-gray-800 text-gray-400 hover:text-gray-100'}`}
                >
                  {l.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-500">{LEVELS.find((l) => l.key === level)?.note}</span>
            </div>
            <p className="flex gap-2 text-base leading-relaxed text-gray-100">
              <button type="button" aria-label="Play" onClick={() => speak(turn.review[level])} className="mt-1 self-start text-gray-500 hover:text-gray-100">
                <Volume2 className="h-4 w-4" />
              </button>
              <span>{turn.review[level]}</span>
            </p>
          </div>

          {fixes.length > 0 && (
            <ul className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
              {fixes.map((f, i) => (
                <li key={i} className={dismissed.includes(i) ? 'opacity-40' : ''}>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-400">{f.kind}</span>
                    <span className="text-gray-500 line-through">{f.wrong}</span>
                    <span className="text-gray-500">→</span>
                    <span className="font-medium text-gray-100">{f.right}</span>
                  </div>
                  {f.why && <p className="mt-0.5 text-xs text-gray-400">{f.why}</p>}
                  {!dismissed.includes(i) && (
                    <button type="button" onClick={() => onChange({ dismissedFixes: [...dismissed, i] })} className="mt-0.5 text-[11px] text-gray-500 hover:text-gray-200">
                      I said it right
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <SayAgain target={turn.review.natural} onScore={(retryPercent) => onChange({ retryPercent })} />
        </>
      )}
    </div>
  );
}

/** Say the natural version out loud; word match in the browser, no model call. */
function SayAgain({ target, onScore }: { target: string; onScore: (percent: number) => void }) {
  const rec = useSpeechRecognition();
  const [marks, setMarks] = useState<WordMark[] | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!rec.supported) return null;
  const go = async () => {
    setNote(null);
    const heard = await rec.listen();
    if (heard.length === 0) {
      setNote('Nothing heard. Try again.');
      return;
    }
    const best = heard.map((h) => checkParagraph(h, target)).sort((a, b) => b.percent - a.percent)[0];
    setMarks(best.marks);
    setPercent(best.percent);
    onScore(best.percent);
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-300">Say the natural version</p>
        <button
          type="button"
          onClick={() => (rec.status === 'listening' ? rec.stop() : void go())}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${rec.status === 'listening' ? 'border-red-400 text-red-400' : 'border-gray-700 text-gray-300 hover:text-gray-100'}`}
        >
          <Mic className="h-4 w-4" />
          {rec.status === 'listening' ? 'Stop' : 'Say it again'}
        </button>
      </div>
      {marks && (
        <p className="mt-3 text-base leading-relaxed">
          {marks.map((m, i) => (
            <span key={i} className={m.ok ? 'text-gray-100' : 'rounded-sm bg-gray-700 px-0.5 text-gray-300'}>
              {m.word}{' '}
            </span>
          ))}
          <span className="ml-1 text-sm text-gray-400 tabular-nums">{percent}%</span>
        </p>
      )}
      {(note || rec.error) && <p className="mt-2 text-xs text-red-400">{note ?? rec.error}</p>}
    </div>
  );
}
