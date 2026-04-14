'use client';

import React from 'react';
import { Sentence, AppMode, SpokenResult, DictationInputs, CompletedSentences, RecognitionState } from '@/types';
import { TranscriptSentence } from './TranscriptSentence';

interface TranscriptProps {
  transcript: Sentence[];
  currentTime: number;
  isPlaying: boolean;
  appMode: AppMode;
  hideCaptions?: boolean;
  onToggleHideCaptions?: () => void;
  onResetDictation?: () => void;
  dictationInputs: DictationInputs;
  completedSentences: CompletedSentences;
  isRecording: number | null;
  spokenResults: Record<number, SpokenResult>;
  recognitionErrors: RecognitionState;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, sentence: Sentence) => void;
  onDictationRetry: (sentence: Sentence) => void;
  onToggleRecording: (sentence: Sentence) => void;
  onSkip: (sentence: Sentence) => void;
  onSimulateSuccess: (sentence: Sentence) => void;
}

export function Transcript({
  transcript,
  currentTime,
  isPlaying,
  appMode,
  hideCaptions,
  dictationInputs,
  completedSentences,
  isRecording,
  spokenResults,
  recognitionErrors,
  scrollContainerRef,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  onToggleRecording,
  onSkip,
  onSimulateSuccess,
}: TranscriptProps) {
  return (
    <div className="flex-1 min-h-0 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2 scroll-smooth"
      >
        {transcript.map((sentence, index) => {
          const isActive = currentTime >= sentence.start && currentTime < sentence.end;
          const isPast = currentTime >= sentence.end;

          return (
            <TranscriptSentence
              key={sentence.id}
              sentence={sentence}
              index={index}
              isActive={isActive}
              isPast={isPast}
              isPlaying={isPlaying}
              appMode={appMode}
              hideCaptions={!!hideCaptions && appMode === 'normal'}
              dictationInput={dictationInputs[sentence.id] || ''}
              isCompleted={!!completedSentences[sentence.id]}
              isRecording={isRecording}
              spokenResult={spokenResults[sentence.id]}
              recognitionError={recognitionErrors[sentence.id]}
              onSentenceClick={onSentenceClick}
              onDictationChange={onDictationChange}
              onDictationKeyDown={onDictationKeyDown}
              onDictationRetry={onDictationRetry}
              onToggleRecording={onToggleRecording}
              onSkip={onSkip}
              onSimulateSuccess={onSimulateSuccess}
            />
          );
        })}
      </div>
    </div>
  );
}
