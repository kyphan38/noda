'use client';

import React from 'react';
import { Sentence, AppMode, DictationInputs, CompletedSentences } from '@/types';
import { MemoTranscriptSentence } from './TranscriptSentence';

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
}: TranscriptProps) {
  return (
    <div className="h-full min-h-0 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth p-2 md:p-3"
      >
        {transcript.map((sentence, index) => {
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
            />
          );
        })}
      </div>
    </div>
  );
}
