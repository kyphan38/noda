import React from 'react';
import { ArrowRight, X } from 'lucide-react';
import { LESSON_MODES } from '@/constants';
import { formatTime } from '@/lib/utils';
import type { ResumeTarget } from '@/lib/progress';

interface ResumePromptProps {
  target: ResumeTarget;
  totalSentences: number;
  onResume: () => void;
  onDismiss: () => void;
}

/** "Continue: Dictation · sentence 23/80" bar shown when a lesson opens with saved progress. */
export function ResumePrompt({ target, totalSentences, onResume, onDismiss }: ResumePromptProps) {
  const modeLabel = LESSON_MODES.find((m) => m.mode === target.mode)?.label ?? target.mode;
  const where =
    target.mode === 'listen'
      ? formatTime(target.time)
      : `sentence ${target.index + 1}/${totalSentences}`;

  return (
    <div className="shrink-0 flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2 text-sm">
      <button
        type="button"
        onClick={onResume}
        className="flex flex-1 min-w-0 items-center gap-2 text-left text-gray-200 hover:text-white"
      >
        <span className="truncate">
          Continue: <span className="font-medium">{modeLabel}</span>
          <span className="text-gray-500"> · {where}</span>
        </span>
        <ArrowRight size={16} className="shrink-0" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-200"
        aria-label="Dismiss"
        title="Dismiss"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
