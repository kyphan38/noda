'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { ModalShell } from '@/components/ModalShell';
import { LessonTalkStart } from '@/components/LessonTalkStart';
import { DrillRetell } from '@/components/talk/drills/DrillRetell';
import { retellParts } from '@/lib/lesson-talk';
import { cn, formatTime } from '@/lib/utils';
import type { Sentence } from '@/types';

type Mode = 'retell' | 'talk';
const MODES: { id: Mode; label: string }[] = [
  { id: 'retell', label: 'Retell' },
  { id: 'talk', label: 'Talk' },
];

/**
 * Speak about a lesson: retell it from memory (a long lesson is cut into parts, one part per
 * retell), or open a Talk topic built from it.
 */
export function LessonTalkModal({
  lesson,
  transcript,
  onClose,
}: {
  lesson: { id: string; name: string };
  transcript: Sentence[];
  onClose: () => void;
}) {
  const parts = useMemo(() => retellParts(transcript), [transcript]);
  const [mode, setMode] = useState<Mode>('retell');
  const [index, setIndex] = useState(0);
  const part = parts[index];
  const chip = (on: boolean) =>
    cn('rounded-full border px-3 py-1 text-xs tabular-nums', on ? 'border-gray-100 bg-gray-100 text-gray-900' : 'border-gray-800 text-gray-400 hover:text-gray-100');

  return (
    <ModalShell
      onClose={onClose}
      labelledBy="noda-retell-title"
      backdropClassName="bg-black/80 z-[200] p-3 sm:p-4 backdrop-blur-sm"
      panelClassName="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden"
      // A click outside must not throw away a recording.
      closeOnBackdrop={false}
      portal
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-3">
        <h3 id="noda-retell-title" className="sr-only">
          Speak about this lesson
        </h3>
        <div className="flex gap-1.5" role="tablist" aria-label="Mode">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)} className={chip(mode === m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 overflow-y-auto p-4">
        {mode === 'talk' && <LessonTalkStart lesson={lesson} transcript={transcript} />}
        {mode === 'retell' && parts.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Part">
            {parts.map((p, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
                className={chip(i === index)}
              >
                {formatTime(p.start)}-{formatTime(p.end)}
              </button>
            ))}
          </div>
        )}
        {mode === 'retell' && (part ? <DrillRetell key={index} source={part.text} /> : <p className="text-sm text-gray-400">This lesson has no transcript.</p>)}
      </div>
    </ModalShell>
  );
}
