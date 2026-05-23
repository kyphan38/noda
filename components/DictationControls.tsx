import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { Lightbulb, CornerDownLeft } from 'lucide-react';
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
}: DictationControlsProps) {
  const targetNorm = useMemo(() => normalizeDictationTarget(sentence.text), [sentence.text]);
  const inputNorm = alignDictationInput(dictationInput, targetNorm);

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

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    const syntheticEvent = {
      key: 'Enter',
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
        <div className="flex items-start gap-2">
          <div className="font-mono text-base sm:text-lg leading-normal tracking-normal min-w-0 flex-1 whitespace-pre-wrap break-all text-green-400">
            {targetNorm}
          </div>
          {isMobile && isActive && (
            <div className="shrink-0 flex items-center">
              <button
                type="button"
                data-dictation-next
                title="Next sentence"
                onClick={handleNext}
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-400 active:bg-emerald-500/20"
              >
                <CornerDownLeft className="h-4 w-4" />
              </button>
            </div>
          )}
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
        className="font-mono text-base sm:text-lg leading-normal tracking-normal min-w-0 cursor-text whitespace-pre-wrap break-all"
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
        {targetNorm.split('').map((ch, i) => {
          const typed = i < inputNorm.length ? inputNorm[i] : undefined;
          const isSpace = ch === ' ';

          return (
            <React.Fragment key={i}>
              {isActive && i === inputNorm.length && (
                <span
                  aria-hidden
                  className="inline-block w-px h-[1.1em] bg-emerald-400 animate-pulse align-text-bottom"
                />
              )}
              {typed === undefined ? (
                <span className="text-gray-500">{isSpace ? ' ' : '*'}</span>
              ) : typed === ch ? (
                <span className="text-emerald-500">{isSpace ? ' ' : ch}</span>
              ) : (
                <span className="text-red-500">{typed === ' ' ? '\u00a0' : typed}</span>
              )}
            </React.Fragment>
          );
        })}
        {isActive && inputNorm.length >= targetNorm.length && targetNorm.length > 0 && (
          <span
            aria-hidden
            className="inline-block w-px h-[1.1em] bg-emerald-400 animate-pulse align-text-bottom"
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
            className="flex-1 min-w-0 bg-gray-800/60 border border-gray-700 focus:border-emerald-500/50 rounded-lg px-3 py-2 text-sm text-gray-100 font-mono outline-none"
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
            title="Hint — fill next character"
            onClick={handleHint}
            className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 text-amber-400 active:bg-gray-700"
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
