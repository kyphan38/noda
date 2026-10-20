import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Lightbulb } from 'lucide-react';
import { Sentence } from '@/types';
import { normalizeDictationTarget, alignDictationInput } from '@/lib/utils';

type DictationKeyTarget = HTMLInputElement | HTMLTextAreaElement;

interface DictationControlsProps {
  sentence: Sentence;
  isActive: boolean;
  dictationInput: string;
  isCompleted: boolean;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<DictationKeyTarget>, sentence: Sentence) => void;
  onDictationRetry?: (sentence: Sentence) => void;
  isMobile?: boolean;
  /** The line was finished a moment ago by the learner: its full text fades in. */
  justDone?: boolean;
}

export function DictationControls({
  sentence,
  isActive,
  dictationInput,
  isCompleted,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  isMobile = false,
  justDone = false,
}: DictationControlsProps) {
  const targetNorm = useMemo(() => normalizeDictationTarget(sentence.text), [sentence.text]);
  const inputNorm = alignDictationInput(dictationInput, targetNorm);

  // Only characters added since the last render animate (typing forward, a hint, a paste).
  // Backspace and opening a half-typed line change nothing, so nothing moves. CSS does the
  // work; there is no timer and no extra state per key.
  const prevLen = useRef(inputNorm.length);
  const fromIdx = prevLen.current;
  useEffect(() => {
    prevLen.current = inputNorm.length;
  }, [inputNorm.length]);
  const isFresh = (i: number) => isActive && i >= fromIdx && i < inputNorm.length;

  const hiddenRef = useRef<HTMLTextAreaElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const srOnlyRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!isActive) return;
    if (isCompleted) {
      srOnlyRef.current?.focus({ preventScroll: true });
    } else if (isMobile) {
      const el = mobileInputRef.current;
      if (el) {
        el.focus({ preventScroll: true });
        const len = el.value.length;
        el.selectionStart = len;
        el.selectionEnd = len;
      }
    } else {
      const el = hiddenRef.current;
      if (el) {
        el.focus({ preventScroll: true });
        const len = el.value.length;
        el.selectionStart = len;
        el.selectionEnd = len;
      }
    }
  }, [isCompleted, isActive, sentence.id, isMobile]);

  const handleHint = (e: React.MouseEvent) => {
    e.stopPropagation();
    const syntheticEvent = {
      key: 'Tab',
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as React.KeyboardEvent<DictationKeyTarget>;
    onDictationKeyDown(syntheticEvent, sentence);
  };

  const syncDom = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const aligned = alignDictationInput(value, targetNorm);
    if (value !== aligned) {
      el.value = aligned;
      el.selectionStart = aligned.length;
      el.selectionEnd = aligned.length;
    }
  };

  if (isCompleted) {
    return (
      <div className="flex flex-col">
        {/* The mobile "next sentence" button lives in the row's action column (TranscriptSentence),
            in line with the rewrite and status icons. */}
        <div data-dictation-done className={`${justDone ? 'fade-in ' : ''}font-mono text-[15px] sm:text-base leading-normal tracking-normal min-w-0 whitespace-pre-wrap break-words text-gray-100`}>
          {targetNorm}
        </div>
        {isActive && (
          <input
            ref={srOnlyRef}
            type="text"
            readOnly
            aria-label="Press Enter to continue"
            value={dictationInput}
            onKeyDown={(e) => onDictationKeyDown(e, sentence)}
            onClick={(e) => e.stopPropagation()}
            className="fixed top-0 left-0 w-px h-px opacity-0 overflow-hidden pointer-events-none border-0"
          />
        )}
      </div>
    );
  }

  return (
    <>
      {/* Feedback div */}
      <div
        aria-hidden
        className="font-mono text-[15px] sm:text-base leading-normal tracking-normal min-w-0 cursor-text whitespace-pre-wrap break-words"
        onClick={(e) => {
          if (isActive) {
            e.stopPropagation();
            if (isMobile) {
              mobileInputRef.current?.focus();
            } else {
              hiddenRef.current?.focus();
            }
          }
        }}
      >
        {(() => {
          const words = targetNorm.split(' ');
          let gi = 0; // global character index
          return words.map((word, wIdx) => {
            const wordStart = gi;
            const wordChars = word.split('').map((ch, ci) => {
              const i = wordStart + ci;
              const typed = i < inputNorm.length ? inputNorm[i] : undefined;
              return (
                <React.Fragment key={i}>
                  {isActive && i === inputNorm.length && (
                    <span
                      aria-hidden
                      data-caret
                      className="dictation-caret border-l border-gray-100"
                    />
                  )}
                  {/* A key per state: when a star becomes a letter React mounts a new span,
                      so its animation runs once. */}
                  {typed === undefined ? (
                    <span key={`${i}-empty`} data-char="empty" className="text-gray-500">{'*'}</span>
                  ) : typed === ch ? (
                    <span
                      key={`${i}-ok`}
                      data-char="correct"
                      className={`text-gray-100${isFresh(i) ? ' char-in' : ''}`}
                    >
                      {ch}
                    </span>
                  ) : (
                    <span
                      key={`${i}-bad`}
                      data-char="wrong"
                      className={`text-gray-500 line-through${isFresh(i) ? ' char-wrong' : ''}`}
                    >
                      {typed}
                    </span>
                  )}
                </React.Fragment>
              );
            });
            gi = wordStart + word.length;

            // Space separator between words
            let spaceEl: React.ReactNode = null;
            if (wIdx < words.length - 1) {
              const spaceIdx = gi;
              const spaceTyped = spaceIdx < inputNorm.length ? inputNorm[spaceIdx] : undefined;
              spaceEl = (
                <React.Fragment key={`sp-${spaceIdx}`}>
                  {isActive && spaceIdx === inputNorm.length && (
                    <span
                      aria-hidden
                      data-caret
                      className="dictation-caret border-l border-gray-100"
                    />
                  )}
                  {spaceTyped === undefined ? (
                    <span key="empty" data-char="empty" className="text-gray-500">{' '}</span>
                  ) : spaceTyped === ' ' ? (
                    <span key="ok" data-char="correct" className="text-gray-100">{' '}</span>
                  ) : (
                    <span
                      key="bad"
                      data-char="wrong"
                      className={`rounded-sm bg-gray-700 text-gray-500${isFresh(spaceIdx) ? ' char-wrong' : ''}`}
                    >
                      {'\u00a0'}
                    </span>
                  )}
                </React.Fragment>
              );
              gi++; // advance past the space
            }

            return (
              <React.Fragment key={wIdx}>
                <span className="whitespace-nowrap">{wordChars}</span>
                {spaceEl}
              </React.Fragment>
            );
          });
        })()}
        {isActive && inputNorm.length >= targetNorm.length && targetNorm.length > 0 && (
          <span
            aria-hidden
            data-caret
            className="dictation-caret border-l border-gray-100"
          />
        )}
      </div>

      {/* Mobile: visible inline input + touch actions */}
      {isActive && isMobile && (
        <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
          <input
            ref={mobileInputRef}
            data-dictation-input
            type="text"
            inputMode="text"
            value={dictationInput}
            onChange={(e) => {
              onDictationChange(sentence, e.target.value);
              syncDom(e.target, e.target.value);
            }}
            onKeyDown={(e) => onDictationKeyDown(e, sentence)}
            className="flex-1 min-w-0 bg-gray-800/60 border border-gray-700 focus:border-gray-500 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono outline-none"
            placeholder="Type what you hear…"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
          />
          <button
            type="button"
            data-dictation-hint
            title="Hint - fill next character"
            onClick={handleHint}
            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 text-gray-100 active:bg-gray-700"
          >
            <Lightbulb className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Desktop: hidden off-screen textarea */}
      {isActive && !isMobile && (
        <textarea
          ref={hiddenRef}
          data-dictation-input
          value={dictationInput}
          onChange={(e) => {
            onDictationChange(sentence, e.target.value);
            syncDom(e.target, e.target.value);
          }}
          onKeyDown={(e) => onDictationKeyDown(e, sentence)}
          onClick={(e) => e.stopPropagation()}
          className="fixed top-0 left-0 w-px h-px opacity-0 overflow-hidden pointer-events-none border-0"
          aria-label="Type what you hear"
          autoComplete="off"
          spellCheck={false}
        />
      )}
    </>
  );
}
