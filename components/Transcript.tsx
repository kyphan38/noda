'use client';

import React from 'react';
import { Sentence, AppMode, DictationInputs, CompletedSentences } from '@/types';
import { MemoTranscriptSentence } from './TranscriptSentence';

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
}: TranscriptProps) {
  return (
    <div className="flex-1 min-h-0 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
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
              lessonId={lessonId}
              mediaStoragePath={mediaStoragePath}
              hideCaptions={!!hideCaptions && appMode === 'normal'}
              dictationInput={dictationInputs[sentence.id] || ''}
              isCompleted={!!completedSentences[sentence.id]}
              onSentenceClick={onSentenceClick}
              onDictationChange={onDictationChange}
              onDictationKeyDown={onDictationKeyDown}
              onDictationRetry={onDictationRetry}
              isMobile={isMobile}
            />
          );
        })}
      </div>
    </div>
  );
}
