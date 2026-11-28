'use client';

import React, { useEffect, useState } from 'react';
import { ParagraphDictation } from './ParagraphDictation';
import { endSlowNow, openWordStore } from '@/lib/lesson-session';
import { Sentence, AppMode, DictationInputs, CompletedSentences } from '@/types';
import { MemoTranscriptSentence } from './TranscriptSentence';
import { personalWords } from '@/lib/cloze';
import { getMissedWordCounts } from '@/lib/db/missed-words';
import type { TranslationLine } from '@/lib/translate';

interface TranscriptProps {
  transcript: Sentence[];
  currentTime: number;
  appMode: AppMode;
  hideCaptions?: boolean;
  dictationInputs: DictationInputs;
  completedSentences: CompletedSentences;
  /** Sentences shadowed (Enter pressed past them) in the Shadowing tab. */
  shadowingCompleted: CompletedSentences;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, sentence: Sentence) => void;
  onDictationRetry: (sentence: Sentence) => void;
  onShadowingNext: () => void;
  isMobile?: boolean;
  /** Touch-first device (phone or iPad): show tap buttons for what a keyboard does elsewhere. */
  touchControls?: boolean;
  /** The sentence whose shadowing-pattern panel is open, to outline its row. The panel is
   *  opened from the player's AI button, not from the rows. */
  activeShadowingSentenceId: number | null;
  isShadowingPanelOpen: boolean;
  /** Rows whose Vietnamese translation is shown (opened from the player's VI button). */
  translations: ReadonlyMap<number, TranslationLine>;
}

export function Transcript({
  transcript,
  currentTime,
  appMode,
  hideCaptions,
  dictationInputs,
  completedSentences,
  shadowingCompleted,
  scrollContainerRef,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  onShadowingNext,
  isMobile = false,
  touchControls = false,
  activeShadowingSentenceId,
  isShadowingPanelOpen,
  translations,
}: TranscriptProps) {
  // Dictation one sentence at a time, only its hard words (gaps), or a whole part (N7). Per visit.
  const [dictationView, setDictationView] = useState<DictationViewId>('sentence');
  // Words you often miss, also hidden in gaps. Read each time gaps opens, then fixed, so
  // the gaps do not move while you type.
  const [yourWords, setYourWords] = useState<ReadonlySet<string>>(NO_WORDS);
  const gaps = appMode === 'dictation' && dictationView === 'gaps';
  useEffect(() => {
    if (!gaps) return;
    let alive = true;
    getMissedWordCounts()
      .then((c) => alive && setYourWords(personalWords(c)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [gaps]);
  // A hard sentence plays slower only in Dictation.
  useEffect(() => {
    if (appMode !== 'dictation') endSlowNow();
    // A word card belongs to the tab it was opened in.
    openWordStore.set(null);
  }, [appMode]);

  return (
    <div className="h-full min-h-0 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
      {appMode === 'dictation' && <DictationView value={dictationView} onChange={setDictationView} />}
      <div
        ref={scrollContainerRef}
        className="scroll-quiet flex-1 overflow-y-auto scroll-smooth p-2 md:p-3"
      >
        {appMode === 'dictation' && dictationView === 'paragraph' ? (
          <ParagraphDictation transcript={transcript} />
        ) : transcript.map((sentence, index) => {
          const isActive = currentTime >= sentence.start && currentTime < sentence.end;
          const isPast = currentTime >= sentence.end;

          return (
            <MemoTranscriptSentence
              key={sentence.id}
              sentence={sentence}
              index={index}
              isActive={isActive}
              isPast={isPast}
              appMode={appMode}
              hideCaptions={!!hideCaptions && appMode !== 'dictation'}
              dictationInput={dictationInputs[sentence.id] || ''}
              isCompleted={
                appMode === 'dictation'
                  ? !!completedSentences[sentence.id]
                  : appMode === 'shadowing' && !!shadowingCompleted[sentence.id]
              }
              onSentenceClick={onSentenceClick}
              onDictationChange={onDictationChange}
              onDictationKeyDown={onDictationKeyDown}
              onDictationRetry={onDictationRetry}
              onShadowingNext={onShadowingNext}
              isMobile={isMobile}
              touchControls={touchControls}
              isShadowingOpen={isShadowingPanelOpen && activeShadowingSentenceId === sentence.id}
              gaps={gaps}
              gapWords={yourWords}
              translation={translations.get(sentence.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

type DictationViewId = 'sentence' | 'gaps' | 'paragraph';
const NO_WORDS: ReadonlySet<string> = new Set();

/** Dictation one sentence at a time, only its hard words, or a part of several sentences (N7). */
function DictationView({ value, onChange }: { value: DictationViewId; onChange: (v: DictationViewId) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-800 px-3 py-2 text-xs" role="radiogroup" aria-label="Dictation by">
      {(['sentence', 'gaps', 'paragraph'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          title={v === 'gaps' ? 'Type only the small, fast words' : undefined}
          className={value === v ? 'text-gray-100' : 'text-gray-500 hover:text-gray-300'}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
