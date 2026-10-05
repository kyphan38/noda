import React from 'react';
import { CheckCircle2, RotateCcw, CornerDownLeft } from 'lucide-react';
import { Sentence, AppMode } from '@/types';
import { DictationControls } from './DictationControls';

interface TranscriptSentenceProps {
  sentence: Sentence;
  index: number;
  isActive: boolean;
  isPast: boolean;
  appMode: AppMode;
  /** This row's shadowing-pattern panel is open (opened from the player's AI button). */
  isShadowingOpen: boolean;
  /** When true (listen / shadowing), caption text is visually hidden but layout stays. */
  hideCaptions?: boolean;
  dictationInput: string;
  /** Done in the current tab: typed correctly (dictation) or shadowed (shadowing). */
  isCompleted: boolean;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, sentence: Sentence) => void;
  onDictationRetry: (sentence: Sentence) => void;
  /** Shadowing: mark this (active) line done and play the next one - the tap version of Enter. */
  onShadowingNext: () => void;
  isMobile?: boolean;
  /** Touch-first device (phone or iPad): no Enter key outside a text field. */
  touchControls?: boolean;
}

export function TranscriptSentence({
  sentence,
  index,
  isActive,
  isPast,
  appMode,
  isShadowingOpen,
  hideCaptions,
  dictationInput,
  isCompleted,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  onShadowingNext,
  isMobile = false,
  touchControls = false,
}: TranscriptSentenceProps) {
  const showDictationActions = appMode === 'dictation' && !!onDictationRetry;

  // Touch "next line" button - only where there is no Enter key to press. Dictation: phones,
  // once the line is typed correctly (the keyboard's Go key also works). Shadowing: phones and
  // iPads; on a computer Enter does the same and the button would only add clutter.
  const showDictationNext = appMode === 'dictation' && isMobile && isActive && isCompleted;
  const showShadowingNext = appMode === 'shadowing' && touchControls && isActive;
  // The slot is reserved on every row where the button can appear, so showing it does not
  // narrow the text column and re-wrap the sentence (same idea as the rewrite slot).
  const reserveNextSlot = (appMode === 'shadowing' && touchControls) || (appMode === 'dictation' && isMobile);
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showShadowingNext) {
      onShadowingNext();
      return;
    }
    const syntheticEvent = {
      key: 'Enter',
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as React.KeyboardEvent<HTMLInputElement>;
    onDictationKeyDown(syntheticEvent, sentence);
  };

  return (
    <div
      data-index={index}
      onClick={() => onSentenceClick(sentence)}
      className={`
        group flex cursor-pointer items-baseline gap-2 sm:gap-4 rounded-xl px-2 sm:px-3 py-2.5 sm:py-3 mb-1.5 transition duration-200
        ${
          isActive
            ? 'border border-gray-600 bg-gray-800'
            : 'hover:bg-gray-800 active:bg-gray-800 border border-transparent'
        }
        ${isShadowingOpen ? 'ring-1 ring-gray-500/60 bg-gray-800/40' : ''}
      `}
    >
      <span
        className={`
          font-mono text-xs sm:text-sm shrink-0 w-7 sm:w-10 text-right tabular-nums self-baseline
          ${isActive ? 'text-gray-50 font-bold' : isPast ? 'text-gray-600' : 'text-gray-500'}
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
          // Same size and weight whether active or not: the line must wrap the same way in both
          // states. Ctrl-replay seeks 0.1s before the start (pre-roll), so the row flips to
          // inactive and back; a bigger/bolder active font made a 2-line sentence jump to 1 line
          // and back on every replay. The row box carries the highlight instead.
          <p
            className={`
              font-sans text-[15px] sm:text-base leading-relaxed
              ${isActive ? 'text-gray-50' : isPast ? 'text-gray-300' : 'text-gray-100'}
              ${hideCaptions ? 'invisible select-none' : ''}
            `}
          >
            {sentence.text}
          </p>
        )}
      </div>

      {/* Pinned to the FIRST line of the sentence, not centred on the whole row: on a phone a
          long line wraps to 3 rows and centred icons drift away from the words they act on.
          The negative margin centres the 40px (32px on sm+) buttons on that first text line. */}
      <div className="shrink-0 flex flex-row items-center justify-end gap-1 self-start -my-2 sm:-my-1">
        {reserveNextSlot && !(showDictationNext || showShadowingNext) && (
          <div className="h-10 w-10 sm:h-8 sm:w-8 shrink-0" aria-hidden />
        )}
        {(showDictationNext || showShadowingNext) && (
          <button
            type="button"
            {...(showShadowingNext ? { 'data-shadowing-next': true } : { 'data-dictation-next': true })}
            title={showShadowingNext ? 'Done - next sentence (Enter)' : 'Next sentence'}
            onClick={handleNext}
            className="flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-gray-200 transition-colors hover:bg-gray-700 active:bg-gray-700"
          >
            <CornerDownLeft className="h-4 w-4" aria-hidden />
          </button>
        )}
        {showDictationActions && (
          <div
            data-dictation-rewrite-slot
            className="flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center"
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
                className="flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-gray-500 transition-colors hover:border-gray-700 hover:bg-gray-800 hover:text-gray-200 active:bg-gray-700"
              >
                <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
              </button>
            ) : null}
          </div>
        )}
        <div
          data-dictation-status-slot
          className="flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center"
        >
          {/* No "playing" icon on the active row: its box already says it. */}
          {!isActive && appMode === 'shadowing' && isCompleted && (
            <CheckCircle2
              data-shadowing-done-icon
              className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400"
              aria-label="Shadowed"
            />
          )}
          {!isActive && appMode !== 'shadowing' && isPast && (
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
