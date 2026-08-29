'use client';

import React from 'react';
import { Sentence, AppMode, DictationInputs, CompletedSentences } from '@/types';
import { MemoTranscriptSentence } from './TranscriptSentence';
import type { ShadowingEntry } from '@/hooks/useShadowingPatternManager';

interface TranscriptProps {
  transcript: Sentence[];
  lessonId: string | null;
  mediaStoragePath: string | null;
  currentTime: number;
  appMode: AppMode;
  hideCaptions?: boolean;
  dictationInputs: DictationInputs;
  completedSentences: CompletedSentences;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, sentence: Sentence) => void;
  onDictationRetry: (sentence: Sentence) => void;
  isMobile?: boolean;
  /** Shadowing-pattern explanation feature (Stage 7: centralized manager, one panel open at a time). */
  activeShadowingSentenceId: number | null;
  isShadowingPanelOpen: boolean;
  confirmingShadowingSentenceId: number | null;
  getShadowingEntry: (sentenceId: number) => ShadowingEntry;
  onSparkleClick: (sentence: Sentence) => void;
  onConfirmShadowingGenerate: (sentence: Sentence) => void;
  onCancelShadowingConfirm: () => void;
}

export function Transcript({
  transcript,
  lessonId,
  mediaStoragePath,
  currentTime,
  appMode,
  hideCaptions,
  dictationInputs,
  completedSentences,
  scrollContainerRef,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  isMobile = false,
  activeShadowingSentenceId,
  isShadowingPanelOpen,
  confirmingShadowingSentenceId,
  getShadowingEntry,
  onSparkleClick,
  onConfirmShadowingGenerate,
  onCancelShadowingConfirm,
}: TranscriptProps) {
  // Hidden during dictation and caption-hidden (blind listening) modes - the analysis text
  // would reveal the answer/transcript those modes are trying to keep hidden.
  const shadowingAvailable = appMode !== 'dictation' && !hideCaptions && !!lessonId && !!mediaStoragePath;

  return (
    <div className="h-full min-h-0 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth p-3 md:p-4 space-y-2"
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
              hideCaptions={!!hideCaptions && appMode === 'normal'}
              dictationInput={dictationInputs[sentence.id] || ''}
              isCompleted={!!completedSentences[sentence.id]}
              onSentenceClick={onSentenceClick}
              onDictationChange={onDictationChange}
              onDictationKeyDown={onDictationKeyDown}
              onDictationRetry={onDictationRetry}
              isMobile={isMobile}
              shadowingEnabled={shadowingAvailable}
              shadowingEntry={getShadowingEntry(sentence.id)}
              isShadowingOpen={isShadowingPanelOpen && activeShadowingSentenceId === sentence.id}
              isConfirmingShadowing={confirmingShadowingSentenceId === sentence.id}
              onSparkleClick={onSparkleClick}
              onConfirmShadowingGenerate={onConfirmShadowingGenerate}
              onCancelShadowingConfirm={onCancelShadowingConfirm}
            />
          );
        })}
      </div>
    </div>
  );
}
