'use client';

import { useState } from 'react';
import { Mic, Square } from 'lucide-react';

import { useListen } from '@/hooks/useListen';
import { checkParagraph, type ParagraphCheck } from '@/lib/paragraph-dictation';

/** Pinned to the bottom of the screen, above the iPhone home bar. */
const PINNED = 'sticky bottom-0 z-10 mt-auto -mx-4 border-t border-gray-800 bg-[var(--background)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]';
const Kbd = ({ k }: { k: string }) => <span className="ml-1 rounded border border-gray-700 px-1 text-[10px] text-gray-500">{k}</span>;

type AnswerProps = {
  recording: boolean;
  busy: boolean;
  checking: boolean;
  seconds: number;
  error: string | null;
  fine: boolean;
  onToggle: () => void;
  onCancel: () => void;
};

/** The big mic while it is your turn to answer. */
export function TalkAnswerBar({ recording, busy, checking, seconds, error, fine, onToggle, onCancel }: AnswerProps) {
  const status = checking ? 'Checking your answer…' : recording ? `${seconds}s · tap to send` : 'Tap to answer';
  return (
    <div className={`${PINNED} flex flex-col items-center gap-1.5`}>
      <button
        type="button"
        aria-label={recording ? 'Stop and send' : 'Answer'}
        disabled={busy}
        onClick={onToggle}
        className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
          recording ? 'bg-red-500 text-white hover:bg-red-400' : 'bg-gray-100 text-gray-900 hover:bg-white'
        }`}
      >
        {recording ? <Square className="h-5 w-5" /> : <Mic className="h-6 w-6" />}
      </button>
      <p className="text-xs text-gray-500">
        {checking ? <span className="breathe">{status}</span> : status}
        {fine && !checking && <Kbd k="Space" />}
      </p>
      {(recording || checking) && (
        <button type="button" onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-100">
          Cancel{fine && <Kbd k="Esc" />}
        </button>
      )}
      {error && <p className="text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}

type ReviewProps = {
  /** What "Say again" is checked against (the Natural version). */
  target: string;
  nextLabel: string;
  fine: boolean;
  onTry: () => void;
  onNext: () => void;
  onScore: (percent: number) => void;
};

/** Try again, say the natural version again, or go on. */
export function TalkReviewBar({ target, nextLabel, fine, onTry, onNext, onScore }: ReviewProps) {
  const rec = useListen();
  const [result, setResult] = useState<ParagraphCheck | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const say = async () => {
    setReason(null);
    const r = await rec.listen();
    if (r.heard.length === 0) return setReason(r.reason ?? 'No speech heard. Try again.');
    const best = r.heard.map((h) => ({ h, c: checkParagraph(h, target) })).sort((a, b) => b.c.percent - a.c.percent)[0];
    setResult(best.c);
    setHeard(best.h);
    onScore(best.c.percent);
  };

  return (
    <div className={`${PINNED} space-y-2`}>
      {rec.status !== 'idle' && <p className="text-xs text-gray-500">{rec.status === 'listening' ? 'Say the Natural version… tap the mic again when done.' : 'Checking…'}</p>}
      {reason && <p className="text-xs text-red-400">{reason}</p>}
      {result && rec.status === 'idle' && !reason && (
        <p className="text-sm leading-relaxed">
          {result.marks.map((m, i) => (
            <span key={i} className={m.ok ? 'text-gray-100' : 'rounded-sm bg-gray-700 px-0.5 text-gray-300'}>
              {m.word}{' '}
            </span>
          ))}
          <span className="text-xs text-gray-500 tabular-nums">{result.percent}%</span>
          {heard && <span className="block text-xs text-gray-500">Heard: “{heard}”</span>}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onTry} className="px-2 py-2 text-sm text-gray-400 hover:text-gray-100">
          Try again{fine && <Kbd k="R" />}
        </button>
        <button
          type="button"
          aria-label={rec.status === 'listening' ? 'Stop' : 'Say it again'}
          disabled={rec.status === 'checking'}
          onClick={() => (rec.status === 'listening' ? rec.stop() : void say())}
          className={`rounded-full p-2.5 disabled:opacity-50 ${rec.status === 'listening' ? 'bg-red-500 text-white' : 'text-gray-300 hover:text-gray-100'}`}
        >
          <Mic className="h-5 w-5" />
        </button>
        <button type="button" onClick={onNext} className="flex-1 rounded-full bg-gray-100 py-2.5 text-sm font-medium text-gray-900 hover:bg-white">
          {nextLabel}
          {fine && <Kbd k="Enter" />}
        </button>
      </div>
    </div>
  );
}
