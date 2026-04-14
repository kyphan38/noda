import React from 'react';
import { Play, CheckCircle2, MicOff, Mic, FastForward, Wand2 } from 'lucide-react';
import { Sentence, AppMode, SpokenResult, CompletedSentences, RecognitionState } from '@/types';
import { PRONUNCIATION_SCORE_THRESHOLD } from '@/constants';
import { DictationControls } from './DictationControls';

interface TranscriptSentenceProps {
  sentence: Sentence;
  index: number;
  isActive: boolean;
  isPast: boolean;
  isPlaying: boolean;
  appMode: AppMode;
  /** When true (normal mode only), caption text is visually hidden but layout stays. */
  hideCaptions?: boolean;
  dictationInput: string;
  isCompleted: boolean;
  isRecording: number | null;
  spokenResult?: SpokenResult;
  recognitionError?: string;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, sentence: Sentence) => void;
  onDictationRetry: (sentence: Sentence) => void;
  onToggleRecording: (sentence: Sentence) => void;
  onSkip: (sentence: Sentence) => void;
  onSimulateSuccess: (sentence: Sentence) => void;
}

export function TranscriptSentence({
  sentence,
  index,
  isActive,
  isPast,
  isPlaying,
  appMode,
  hideCaptions,
  dictationInput,
  isCompleted,
  isRecording,
  spokenResult,
  recognitionError,
  onSentenceClick,
  onDictationChange,
  onDictationKeyDown,
  onDictationRetry,
  onToggleRecording,
  onSkip,
  onSimulateSuccess,
}: TranscriptSentenceProps) {
  return (
    <div
      data-index={index}
      onClick={() => onSentenceClick(sentence)}
      className={`
        group flex gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200
        ${
          isActive
            ? 'bg-emerald-400/10 border border-emerald-400/30'
            : 'hover:bg-gray-800 border border-transparent'
        }
      `}
    >
      <span
        className={`
          font-mono text-sm mt-1 shrink-0 w-6 text-right
          ${
            isActive ? 'text-emerald-400 font-bold' : isPast ? 'text-gray-600' : 'text-gray-500'
          }
        `}
      >
        {index + 1}.
      </span>

      <div className="flex-1 flex flex-col gap-2">
        {appMode === 'dictation' ? (
          <DictationControls
            sentence={sentence}
            isActive={isActive}
            dictationInput={dictationInput}
            isCompleted={isCompleted}
            onDictationChange={onDictationChange}
            onDictationKeyDown={onDictationKeyDown}
            onDictationRetry={onDictationRetry}
          />
        ) : (
          <NormalMode
            sentence={sentence}
            isActive={isActive}
            isPast={isPast}
            appMode={appMode}
            hideCaptions={hideCaptions}
            spokenResult={spokenResult}
            recognitionError={recognitionError}
            isCompleted={isCompleted}
            onSkip={onSkip}
            onSimulateSuccess={onSimulateSuccess}
          />
        )}
      </div>

      {/* Status Icon & Mic */}
      <StatusBar
        sentence={sentence}
        isActive={isActive}
        isPast={isPast}
        isPlaying={isPlaying}
        appMode={appMode}
        isRecording={isRecording}
        spokenResult={spokenResult}
        recognitionError={recognitionError}
        isCompleted={isCompleted}
        onSentenceClick={onSentenceClick}
        onToggleRecording={onToggleRecording}
        onSkip={onSkip}
      />
    </div>
  );
}

function NormalMode({
  sentence,
  isActive,
  isPast,
  appMode,
  hideCaptions,
  spokenResult,
  recognitionError,
  isCompleted,
  onSkip,
  onSimulateSuccess,
}: {
  sentence: Sentence;
  isActive: boolean;
  isPast: boolean;
  appMode: AppMode;
  hideCaptions?: boolean;
  spokenResult?: SpokenResult;
  recognitionError?: string;
  isCompleted: boolean;
  onSkip: (sentence: Sentence) => void;
  onSimulateSuccess: (sentence: Sentence) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p
        className={`
          font-sans text-lg leading-loose
          ${
            isActive
              ? 'text-emerald-400 font-medium text-xl'
              : isPast
                ? 'text-gray-300'
                : 'text-gray-100'
          }
          ${hideCaptions ? 'invisible select-none' : ''}
        `}
      >
        {sentence.text}
      </p>

      {/* Error Message */}
      {recognitionError && (
        <div className="mt-2 p-3 bg-red-500/10 rounded-lg border border-red-500/30 text-red-400 text-sm flex flex-col gap-3">
          <span>{recognitionError}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSimulateSuccess(sentence);
            }}
            className="self-start px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-xs font-medium text-gray-300 flex items-center gap-2 transition-colors border border-gray-700"
          >
            <Wand2 className="w-3 h-3" /> Skip error (simulate match)
          </button>
        </div>
      )}

      {/* Pronunciation Assessment Result */}
      {spokenResult && !recognitionError && (
        <div
          className={`mt-2 p-3 rounded-lg border ${
            spokenResult.score >= 80
              ? 'bg-green-900/20 border-green-800/50'
              : 'bg-gray-950 border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-400">Pronunciation Score:</span>
            <span
              className={`text-sm font-bold ${
                spokenResult.score >= 80
                  ? 'text-green-400'
                  : spokenResult.score >= 50
                    ? 'text-emerald-400'
                    : 'text-red-400'
              }`}
            >
              {spokenResult.score}%
            </span>
          </div>
          <div className="flex flex-wrap gap-1 text-base">
            {spokenResult.diff.map((d, i) => (
              <span key={i} className={d.status === 'correct' ? 'text-green-400' : 'text-red-400 font-bold'}>
                {d.word}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBar({
  sentence,
  isActive,
  isPast,
  isPlaying,
  appMode,
  isRecording,
  spokenResult,
  recognitionError,
  isCompleted,
  onSentenceClick,
  onToggleRecording,
  onSkip,
}: {
  sentence: Sentence;
  isActive: boolean;
  isPast: boolean;
  isPlaying: boolean;
  appMode: AppMode;
  isRecording: number | null;
  spokenResult?: SpokenResult;
  recognitionError?: string;
  isCompleted: boolean;
  onSentenceClick: (sentence: Sentence) => void;
  onToggleRecording: (sentence: Sentence) => void;
  onSkip: (sentence: Sentence) => void;
}) {
  if (appMode === 'shadowing') {
    return (
      <div className="shrink-0 flex flex-row flex-wrap items-center justify-end gap-2 mt-1 max-w-[min(100%,280px)]">
        {isActive && isPlaying && (
          <Play className="w-5 h-5 text-emerald-400 fill-current animate-pulse shrink-0 pointer-events-none" aria-hidden />
        )}
        {isActive && !isPlaying && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSentenceClick(sentence);
            }}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-emerald-400 transition-colors shrink-0"
            title="Replay sentence from the start"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        )}
        {isPast && !isActive && <CheckCircle2 className="w-5 h-5 text-gray-600 shrink-0" />}
        {isActive && !isCompleted && !spokenResult && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSkip(sentence);
            }}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors shrink-0"
            title="Skip this sentence"
          >
            <FastForward className="w-4 h-4" />
          </button>
        )}
        {isActive && !isCompleted && spokenResult && !recognitionError && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSkip(sentence);
            }}
            className={`shrink-0 px-3 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors ${
              spokenResult.score >= PRONUNCIATION_SCORE_THRESHOLD
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
            }`}
          >
            {spokenResult.score >= PRONUNCIATION_SCORE_THRESHOLD ? 'Next' : 'Skip'}
            <FastForward className="w-3.5 h-3.5" />
          </button>
        )}
        {isRecording === sentence.id && (
          <span className="text-xs text-red-400 font-medium animate-pulse whitespace-nowrap">Recording…</span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleRecording(sentence);
          }}
          className={`p-2 rounded-full transition-colors shrink-0 ${
            isRecording === sentence.id
              ? 'bg-red-500/20 text-red-400'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
          }`}
          title={isRecording === sentence.id ? 'Stop recording' : 'Start recording'}
        >
          {isRecording === sentence.id ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 flex flex-row items-center justify-end gap-2 mt-1">
      {isActive && <Play className="w-5 h-5 text-emerald-400 fill-current animate-pulse" />}
      {isPast && !isActive && <CheckCircle2 className="w-5 h-5 text-gray-600" />}
    </div>
  );
}
