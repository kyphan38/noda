'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { ModalShell } from '@/components/ModalShell';
import { DrillRetell } from '@/components/talk/drills/DrillRetell';
import { retellParts } from '@/lib/lesson-talk';
import { cn, formatTime } from '@/lib/utils';
import type { Sentence } from '@/types';

/** Retell a lesson from memory. A long lesson is cut into parts; one part per retell. */
export function LessonTalkModal({ transcript, onClose }: { transcript: Sentence[]; onClose: () => void }) {
  const parts = useMemo(() => retellParts(transcript), [transcript]);
  const [index, setIndex] = useState(0);
  const part = parts[index];

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
        <h3 id="noda-retell-title" className="text-base font-semibold text-white">
          Retell
        </h3>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 overflow-y-auto p-4">
        {parts.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Part">
            {parts.map((p, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs tabular-nums',
                  i === index ? 'border-gray-100 bg-gray-100 text-gray-900' : 'border-gray-800 text-gray-400 hover:text-gray-100'
                )}
              >
                {formatTime(p.start)}-{formatTime(p.end)}
              </button>
            ))}
          </div>
        )}
        {part ? <DrillRetell key={index} source={part.text} /> : <p className="text-sm text-gray-400">This lesson has no transcript.</p>}
      </div>
    </ModalShell>
  );
}
