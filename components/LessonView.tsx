import React from 'react';
import { Player } from './Player';
import { Transcript } from './Transcript';
import { LessonItem, AppMode, Sentence, SpokenResult, DictationInputs, CompletedSentences, IPAData } from '@/types';

interface LessonViewProps {
  lesson: LessonItem;
  mode: AppMode;
  // Player props
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  playbackRate: number;
  loopMode: 'none' | 'all' | 'one';
  isGeneratingIPA: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: () => void;
  onModeChange: (mode: AppMode) => void;
  onLoopModeChange: () => void;
  // Transcript props
  transcript: Sentence[];
  dictationInputs: DictationInputs;
  completedSentences: CompletedSentences;
  isRecording: number | null;
  spokenResults: Record<number, SpokenResult>;
  recognitionErrors: Record<number, string>;
  ipaData: IPAData;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, sentence: Sentence) => void;
  onToggleRecording: (sentence: Sentence) => void;
  onSkip: (sentence: Sentence) => void;
  onSimulateSuccess: (sentence: Sentence) => void;
}

export function LessonView({
  lesson,
  mode,
  isPlaying,
  duration,
  currentTime,
  playbackRate,
  loopMode,
  isGeneratingIPA,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onModeChange,
  onLoopModeChange,
  transcript,
  dictationInputs,
  completedSentences,
  isRecording,
  spokenResults,
  recognitionErrors,
  ipaData,
  scrollContainerRef,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onToggleRecording,
  onSkip,
  onSimulateSuccess
}: LessonViewProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-6">
      <Player
        isPlaying={isPlaying}
        duration={duration}
        currentTime={currentTime}
        playbackRate={playbackRate}
        appMode={mode}
        loopMode={loopMode}
        isGeneratingIPA={isGeneratingIPA}
        onPlayPause={onPlayPause}
        onSeek={onSeek}
        onSpeedChange={onSpeedChange}
        onModeChange={onModeChange}
        onLoopModeChange={onLoopModeChange}
      />

      <Transcript
        transcript={transcript}
        currentTime={currentTime}
        appMode={mode}
        dictationInputs={dictationInputs}
        completedSentences={completedSentences}
        isRecording={isRecording}
        spokenResults={spokenResults}
        recognitionErrors={recognitionErrors}
        ipaData={ipaData}
        scrollContainerRef={scrollContainerRef}
        onSentenceClick={onSentenceClick}
        onDictationChange={onDictationChange}
        onDictationKeyDown={onDictationKeyDown}
        onToggleRecording={onToggleRecording}
        onSkip={onSkip}
        onSimulateSuccess={onSimulateSuccess}
      />
    </div>
  );
}
