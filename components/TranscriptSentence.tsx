import React, { useRef } from 'react';
import { Play, CheckCircle2 } from 'lucide-react';
import { Sentence, AppMode } from '@/types';
import { DictationControls } from './DictationControls';

interface TranscriptSentenceProps {
  sentence: Sentence;
  index: number;
  isActive: boolean;
  isPast: boolean;
  appMode: AppMode;
  /** When true (normal mode only), caption text is visually hidden but layout stays. */
  hideCaptions?: boolean;
  dictationInput: string;
  isCompleted: boolean;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, sentence: Sentence) => void;
  onDictationRetry: (sentence: Sentence) => void;
  isMobile?: boolean;
}

export function TranscriptSentence({
  sentence,
  index,
  isActive,
  isPast,
  appMode,
  hideCaptions,
  dictationInput,
  isCompleted,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  isMobile = false,
}: TranscriptSentenceProps) {
  const statusRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      data-index={index}
      onClick={() => onSentenceClick(sentence)}
      className={`
        group flex cursor-pointer items-baseline gap-2 sm:gap-4 rounded-xl px-2 sm:px-3 py-3 sm:py-4 mb-2 sm:mb-2.5 transition-all duration-200
        ${
          isActive
            ? 'border border-emerald-400/30 bg-emerald-400/10 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.12)]'
            : 'hover:bg-gray-800 active:bg-gray-800 border border-transparent'
        }
      `}
    >
      <span
        className={`
          font-mono text-xs sm:text-sm shrink-0 w-7 sm:w-10 text-right tabular-nums self-baseline
          ${isActive ? 'text-emerald-400 font-bold' : isPast ? 'text-gray-600' : 'text-gray-500'}
        `}
      >
        {index + 1}.
      </span>

      <div className="flex-1 min-w-0 flex flex-col gap-2 sm:gap-3">
        {appMode === 'dictation' ? (
          <DictationControls
            sentence={sentence}
            isActive={isActive}
            dictationInput={dictationInput}
            isCompleted={isCompleted}
            onDictationChange={onDictationChange}
            onDictationKeyDown={onDictationKeyDown}
            onDictationRetry={onDictationRetry}
            isMobile={isMobile}
          />
        ) : (
          <p
            className={`
              font-sans text-base sm:text-lg leading-relaxed
              ${isActive ? 'text-emerald-400 font-medium sm:text-xl' : isPast ? 'text-gray-300' : 'text-gray-100'}
              ${hideCaptions ? 'invisible select-none' : ''}
            `}
          >
            {sentence.text}
          </p>
        )}
      </div>

      <div ref={statusRef} className="shrink-0 flex flex-row items-center justify-end gap-2 self-center">
        {isActive && <Play className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 fill-current animate-pulse" />}
        {isPast && !isActive && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />}
      </div>
    </div>
  );
}

export const MemoTranscriptSentence = React.memo(TranscriptSentence);
