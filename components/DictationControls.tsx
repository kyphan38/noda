import React, { useEffect, useMemo, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { Sentence } from '@/types';
import { normalizeDictationTarget } from '@/lib/utils';

type DictationKeyTarget = HTMLInputElement | HTMLTextAreaElement;

interface DictationControlsProps {
  sentence: Sentence;
  isActive: boolean;
  dictationInput: string;
  isCompleted: boolean;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<DictationKeyTarget>, sentence: Sentence) => void;
  onDictationRetry?: (sentence: Sentence) => void;
}

export function DictationControls({
  sentence,
  isActive,
  dictationInput,
  isCompleted,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
}: DictationControlsProps) {
  const targetNorm = useMemo(() => normalizeDictationTarget(sentence.text), [sentence.text]);
  const inputNorm = normalizeDictationTarget(dictationInput, { preserveTrailingSpace: true });

  // hiddenRef: off-screen textarea that captures all keystrokes.
  // srOnlyRef: off-screen input used in completed state for Enter-to-advance.
  const hiddenRef = useRef<HTMLTextAreaElement>(null);
  const srOnlyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isActive) return;
    if (isCompleted) {
      srOnlyRef.current?.focus({ preventScroll: true });
    } else {
      hiddenRef.current?.focus({ preventScroll: true });
    }
  }, [isCompleted, isActive, sentence.id]);

  // ── Completed ─────────────────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="flex flex-col">
        <div className="flex items-start gap-2 px-4 py-3 border border-transparent rounded-lg">
          <div className="font-mono text-lg leading-normal tracking-normal min-w-0 flex-1 whitespace-pre-wrap break-all text-green-400">
            {targetNorm}
          </div>
          {onDictationRetry && (
            <button
              type="button"
              title="Practice this sentence again"
              onClick={(e) => {
                e.stopPropagation();
                onDictationRetry(sentence);
              }}
              className="shrink-0 rounded-lg border border-transparent p-1.5 text-emerald-500/90 transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-400"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
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

  // ── Active / incomplete ────────────────────────────────────────────────────
  // Single-div approach: the feedback div IS the entire visual output.
  // No overlay, no z-index tricks — the textarea lives off-screen (position:fixed)
  // so it can never cover the feedback.
  //
  // Character rendering:
  //   Correct (typed === target char)  → green,  show the real character
  //   Wrong   (typed !== target char)  → red,    show what was typed
  //   Untyped (no input yet)           → gray,   show * (or &nbsp; for spaces)
  //
  // A 1 px blinking bar marks the current typing position.
  return (
    <>
      {/* ── Feedback div ─────────────────────────────────────────────────── */}
      <div
        aria-hidden
        className={`font-mono text-lg leading-normal tracking-normal px-4 py-3 rounded-lg border bg-gray-950 cursor-text whitespace-pre-wrap break-all ${
          isActive ? 'border-emerald-500' : 'border-gray-700'
        }`}
        onClick={(e) => {
          if (isActive) {
            e.stopPropagation();
            hiddenRef.current?.focus();
          }
        }}
      >
        {targetNorm.split('').map((ch, i) => {
          const typed = i < inputNorm.length ? inputNorm[i] : undefined;
          const isSpace = ch === ' ';

          return (
            <React.Fragment key={i}>
              {/* Blinking cursor at current typing position */}
              {isActive && i === inputNorm.length && (
                <span
                  aria-hidden
                  className="inline-block w-px h-[1.1em] bg-emerald-400 animate-pulse align-text-bottom"
                />
              )}
              {typed === undefined ? (
                <span className="text-gray-500">{isSpace ? ' ' : '*'}</span>
              ) : typed === ch ? (
                <span className="text-emerald-500">{isSpace ? ' ' : ch}</span>
              ) : (
                <span className="text-red-500">{isSpace ? ' ' : typed}</span>
              )}
            </React.Fragment>
          );
        })}
        {/* Cursor after the last char when the sentence is fully typed */}
        {isActive && inputNorm.length >= targetNorm.length && targetNorm.length > 0 && (
          <span
            aria-hidden
            className="inline-block w-px h-[1.1em] bg-emerald-400 animate-pulse align-text-bottom"
          />
        )}
      </div>

      {/* ── Hidden textarea ───────────────────────────────────────────────── */}
      {/* position:fixed keeps it completely out of layout flow so it can never
          obscure the feedback div. opacity:0 hides the focus ring. */}
      {isActive && (
        <textarea
          ref={hiddenRef}
          data-dictation-input
          value={dictationInput}
          onChange={(e) => onDictationChange(sentence, e.target.value)}
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
