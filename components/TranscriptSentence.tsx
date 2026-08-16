import React from 'react';
import { Play, CheckCircle2, RotateCcw } from 'lucide-react';
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
  const showDictationActions = appMode === 'dictation' && !!onDictationRetry;

  return (
    <div
      data-index={index}
      onClick={() => onSentenceClick(sentence)}
      className={`
        group flex cursor-pointer items-baseline gap-2 sm:gap-4 rounded-xl px-2 sm:px-3 py-3 sm:py-4 mb-2 sm:mb-2.5 transition duration-200
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

      <div className="shrink-0 flex flex-row items-center justify-end gap-1 self-center">
        {showDictationActions && (
          <div
            data-dictation-rewrite-slot
            className="flex h-10 w-10 shrink-0 items-center justify-center"
            aria-hidden={!isCompleted}
          >
            {isCompleted ? (
              <button
                type="button"
                data-dictation-rewrite
                title="Rewrite line"
                onClick={(e) => {
                  e.stopPropagation();
                  onDictationRetry(sentence);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-transparent text-emerald-500/90 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400 active:bg-emerald-500/20"
              >
                <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
              </button>
            ) : null}
          </div>
        )}
        <div
          data-dictation-status-slot
          className="flex h-10 w-10 shrink-0 items-center justify-center"
        >
          {isActive && (
            <Play
              data-dictation-status-icon
              className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-400 fill-current animate-pulse"
              aria-hidden
            />
          )}
          {isPast && !isActive && (
            <CheckCircle2
              data-dictation-status-icon
              className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600"
              aria-hidden
            />
          )}
        </div>
      </div>
    </div>
  );
}

export const MemoTranscriptSentence = React.memo(TranscriptSentence);
