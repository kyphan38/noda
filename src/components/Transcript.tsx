'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ParagraphDictation } from './ParagraphDictation';
import { currentLessonStore, endSlowNow, listenPausesStore } from '@/lib/lesson-session';
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
  // Dictation one sentence at a time, or a whole part (N7). Per visit.
  const [dictationView, setDictationView] = useState<'sentence' | 'paragraph'>('sentence');
  // A hard sentence plays slower only in Dictation.
  useEffect(() => {
    if (appMode !== 'dictation') endSlowNow();
  }, [appMode]);

  return (
    <div className="h-full min-h-0 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
      {appMode === 'listen' && <ListenPauses />}
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
            />
          );
        })}
      </div>
    </div>
  );
}

/** Listen with pauses (N10), uploaded files only: silence after each sentence to repeat it. */
function ListenPauses() {
  const lesson = useSyncExternalStore(currentLessonStore.subscribe, currentLessonStore.get, () => null);
  const on = useSyncExternalStore(listenPausesStore.subscribe, listenPausesStore.get, () => false);
  if (!lesson || lesson.youtube) return null;
  return (
    <div className="flex items-center gap-3 border-b border-gray-800 px-3 py-2 text-xs" role="radiogroup" aria-label="Pauses">
      <span className="text-gray-500">Pauses</span>
      {(['off', 'on'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={on === (v === 'on')}
          onClick={() => listenPausesStore.set(v === 'on')}
          className={on === (v === 'on') ? 'text-gray-100' : 'text-gray-500 hover:text-gray-300'}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** Dictation one sentence at a time, or a part of several sentences (N7). */
function DictationView({ value, onChange }: { value: 'sentence' | 'paragraph'; onChange: (v: 'sentence' | 'paragraph') => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-800 px-3 py-2 text-xs" role="radiogroup" aria-label="Dictation by">
      {(['sentence', 'paragraph'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={value === v ? 'text-gray-100' : 'text-gray-500 hover:text-gray-300'}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
