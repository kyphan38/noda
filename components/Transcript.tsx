'use client';

import React from 'react';
import { Play, CheckCircle2, MicOff, Mic, FastForward, Wand2 } from 'lucide-react';
import { Sentence, AppMode, SpokenResult, IPAData, DictationInputs, CompletedSentences, RecognitionState } from '@/types';
import { getLetters, formatTime } from '@/lib/utils';
import { PRONUNCIATION_SCORE_THRESHOLD } from '@/constants';

interface TranscriptProps {
  transcript: Sentence[];
  currentTime: number;
  appMode: AppMode;
  dictationInputs: DictationInputs;
  completedSentences: CompletedSentences;
  isRecording: number | null;
  spokenResults: Record<number, SpokenResult>;
  recognitionErrors: RecognitionState;
  ipaData: IPAData;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onSentenceClick: (sentence: Sentence) => void;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, sentence: Sentence) => void;
  onToggleRecording: (sentence: Sentence) => void;
  onSkip: (sentence: Sentence) => void;
  onSimulateSuccess: (sentence: Sentence) => void;
}

export function Transcript({
  transcript,
  currentTime,
  appMode,
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
  onSimulateSuccess,
}: TranscriptProps) {
  return (
    <div className="flex-1 min-h-0 bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur shrink-0">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Transcript</h2>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth">
        {transcript.map((sentence, index) => {
          const isActive = currentTime >= sentence.start && currentTime < sentence.end;
          const isPast = currentTime >= sentence.end;

          return (
            <div
              key={sentence.id}
              data-index={index}
              onClick={() => onSentenceClick(sentence)}
              className={`
                group flex gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200
                ${
                  isActive
                    ? 'bg-emerald-400/10 border border-emerald-400/30 shadow-[0_0_15px_rgba(250,204,21,0.1)]'
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
                  <DictationMode
                    sentence={sentence}
                    isActive={isActive}
                    dictationInput={dictationInputs[sentence.id] || ''}
                    isCompleted={completedSentences[sentence.id]}
                    onDictationChange={onDictationChange}
                    onDictationKeyDown={onDictationKeyDown}
                  />
                ) : (
                  <NormalMode
                    sentence={sentence}
                    isActive={isActive}
                    isPast={isPast}
                    appMode={appMode}
                    ipaData={ipaData}
                    isRecording={isRecording}
                    spokenResults={spokenResults}
                    recognitionErrors={recognitionErrors}
                    completedSentences={completedSentences}
                    onToggleRecording={onToggleRecording}
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
                appMode={appMode}
                isRecording={isRecording}
                spokenResults={spokenResults}
                completedSentences={completedSentences}
                onToggleRecording={onToggleRecording}
                onSkip={onSkip}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Dictation mode specific rendering
 */
function DictationMode({
  sentence,
  isActive,
  dictationInput,
  isCompleted,
  onDictationChange,
  onDictationKeyDown,
}: {
  sentence: Sentence;
  isActive: boolean;
  dictationInput: string;
  isCompleted: boolean;
  onDictationChange: (sentence: Sentence, value: string) => void;
  onDictationKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, sentence: Sentence) => void;
}) {
  const targetLetters = getLetters(sentence.text);
  const inputLetters = getLetters(dictationInput);

  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-lg tracking-wide flex flex-wrap gap-[1px]">
        {sentence.text.split('').map((char, charIdx) => {
          const isLetter = /[\p{L}\p{N}]/u.test(char);
          if (!isLetter) {
            return (
              <span key={charIdx} className="text-gray-500 whitespace-pre">
                {char}
              </span>
            );
          }

          const letterIdx = targetLetters.findIndex((l) => l.index === charIdx);
          const inputChar = inputLetters[letterIdx]?.char;

          let displayChar = '*';
          let colorClass = 'text-gray-600';

          if (isCompleted) {
            displayChar = char;
            colorClass = 'text-green-400';
          } else if (inputChar !== undefined) {
            if (inputChar.toLowerCase() === char.toLowerCase()) {
              displayChar = char;
              colorClass = 'text-green-400';
            } else {
              displayChar = '*';
              colorClass = 'text-red-400';
            }
          }

          return (
            <span key={charIdx} className={colorClass}>
              {displayChar}
            </span>
          );
        })}
      </div>
      {isActive && !isCompleted && (
        <input
          type="text"
          autoFocus
          value={dictationInput}
          onChange={(e) => onDictationChange(sentence, e.target.value)}
          onKeyDown={(e) => onDictationKeyDown(e, sentence)}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-gray-200 font-mono text-lg focus:outline-none focus:border-purple-500 shadow-inner"
          placeholder="Type what you hear... (Tab for hint, Ctrl to replay)"
          autoComplete="off"
          spellCheck="false"
        />
      )}
    </div>
  );
}

/**
 * Normal & Shadowing mode rendering
 */
function NormalMode({
  sentence,
  isActive,
  isPast,
  appMode,
  ipaData,
  isRecording,
  spokenResults,
  recognitionErrors,
  completedSentences,
  onToggleRecording,
  onSkip,
  onSimulateSuccess,
}: {
  sentence: Sentence;
  isActive: boolean;
  isPast: boolean;
  appMode: AppMode;
  ipaData: IPAData;
  isRecording: number | null;
  spokenResults: Record<number, SpokenResult>;
  recognitionErrors: Record<number, string>;
  completedSentences: CompletedSentences;
  onToggleRecording: (sentence: Sentence) => void;
  onSkip: (sentence: Sentence) => void;
  onSimulateSuccess: (sentence: Sentence) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p
        className={`
          text-lg leading-relaxed
          ${
            isActive
              ? 'text-emerald-400 font-medium text-xl'
              : isPast
                ? 'text-gray-400'
                : 'text-gray-200'
          }
        `}
      >
        {sentence.text}
      </p>

      {appMode === 'shadowing' && ipaData[sentence.id] && (
        <p className="text-sm font-mono text-purple-400/80 tracking-wide">
          /{ipaData[sentence.id]}/
        </p>
      )}

      {/* Error Message */}
      {recognitionErrors[sentence.id] && (
        <div className="mt-2 p-3 bg-red-500/10 rounded-lg border border-red-500/30 text-red-400 text-sm flex flex-col gap-3">
          <span>{recognitionErrors[sentence.id]}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSimulateSuccess(sentence);
            }}
            className="self-start px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-md text-xs font-medium text-gray-300 flex items-center gap-2 transition-colors border border-gray-700"
          >
            <Wand2 className="w-3 h-3" /> Bỏ qua lỗi (Mô phỏng đọc đúng 100%)
          </button>
        </div>
      )}

      {/* Pronunciation Assessment Result */}
      {spokenResults[sentence.id] && !recognitionErrors[sentence.id] && (
        <div
          className={`mt-2 p-3 rounded-lg border ${
            spokenResults[sentence.id].score >= 80
              ? 'bg-green-900/20 border-green-800/50'
              : 'bg-gray-950 border-gray-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-400">Pronunciation Score:</span>
            <span
              className={`text-sm font-bold ${
                spokenResults[sentence.id].score >= 80
                  ? 'text-green-400'
                  : spokenResults[sentence.id].score >= 50
                    ? 'text-emerald-400'
                    : 'text-red-400'
              }`}
            >
              {spokenResults[sentence.id].score}%
            </span>
          </div>
          <div className="flex flex-wrap gap-1 text-base">
            {spokenResults[sentence.id].diff.map((d, i) => (
              <span key={i} className={d.status === 'correct' ? 'text-green-400' : 'text-red-400 font-bold'}>
                {d.word}
              </span>
            ))}
          </div>

          {appMode === 'shadowing' && isActive && !completedSentences[sentence.id] && (
            <div className="mt-4 flex justify-end">
              {spokenResults[sentence.id].score >= PRONUNCIATION_SCORE_THRESHOLD ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkip(sentence);
                  }}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-green-900/20"
                >
                  Next <FastForward className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSkip(sentence);
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium flex items-center gap-2 transition-colors border border-gray-700"
                >
                  Skip <FastForward className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Status icon and mic button
 */
function StatusBar({
  sentence,
  isActive,
  isPast,
  appMode,
  isRecording,
  spokenResults,
  completedSentences,
  onToggleRecording,
  onSkip,
}: {
  sentence: Sentence;
  isActive: boolean;
  isPast: boolean;
  appMode: AppMode;
  isRecording: number | null;
  spokenResults: Record<number, SpokenResult>;
  completedSentences: CompletedSentences;
  onToggleRecording: (sentence: Sentence) => void;
  onSkip: (sentence: Sentence) => void;
}) {
  return (
    <div className="shrink-0 flex flex-col items-end gap-3 mt-1">
      {isActive && <Play className="w-5 h-5 text-emerald-400 fill-current animate-pulse" />}
      {isPast && !isActive && <CheckCircle2 className="w-5 h-5 text-gray-600" />}

      {appMode === 'shadowing' && isActive && !completedSentences[sentence.id] && !spokenResults[sentence.id] && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSkip(sentence);
          }}
          className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
          title="Skip this sentence"
        >
          <FastForward className="w-4 h-4" />
        </button>
      )}

      {appMode === 'shadowing' && (
        <div className="flex items-center gap-2">
          {isRecording === sentence.id && (
            <span className="text-xs text-red-400 font-medium animate-pulse">
              Đang thu... (Click để dừng)
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleRecording(sentence);
            }}
            className={`p-2 rounded-full transition-colors ${
              isRecording === sentence.id
                ? 'bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
            }`}
            title={isRecording === sentence.id ? 'Dừng thu âm' : 'Bắt đầu thu âm'}
          >
            {isRecording === sentence.id ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
