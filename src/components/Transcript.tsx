'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ParagraphDictation } from './ParagraphDictation';
import { currentLessonStore, endSlowNow, listenPausesStore, openWordStore, wordCardsOnStore } from '@/lib/lesson-session';
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
  // Dictation one sentence at a time, only its hard words (gaps), or a whole part (N7). Per visit.
  const [dictationView, setDictationView] = useState<DictationViewId>('sentence');
  // A hard sentence plays slower only in Dictation.
  useEffect(() => {
    if (appMode !== 'dictation') endSlowNow();
    // A word card belongs to the tab it was opened in.
    openWordStore.set(null);
  }, [appMode]);

  return (
    <div className="h-full min-h-0 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col">
      {appMode !== 'dictation' && <ListenOptions showPauses={appMode === 'listen'} />}
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
              gaps={appMode === 'dictation' && dictationView === 'gaps'}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Options above the lines in Listen and Shadowing: word cards (N3) and, in Listen, pauses (N10). */
function ListenOptions({ showPauses }: { showPauses: boolean }) {
  const lesson = useSyncExternalStore(currentLessonStore.subscribe, currentLessonStore.get, () => null);
  const pauses = useSyncExternalStore(listenPausesStore.subscribe, listenPausesStore.get, () => false);
  const words = useSyncExternalStore(wordCardsOnStore.subscribe, wordCardsOnStore.get, () => false);
  return (
    <div className="flex items-center gap-4 px-3 pt-1.5 text-xs">
      <Toggle label="Words" title="Double click a word for its meaning" on={words} onChange={(v) => wordCardsOnStore.set(v)} />
      {/* Uploaded files only: YouTube lessons keep playing straight through. */}
      {showPauses && lesson && !lesson.youtube && (
        <Toggle label="Pauses" title="Silence after each sentence, to say it" on={pauses} onChange={(v) => listenPausesStore.set(v)} />
      )}
    </div>
  );
}

/** One word that says the state ("Words off") and flips it on click. */
function Toggle({ label, title, on, onChange }: { label: string; title: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      title={title}
      onClick={() => onChange(!on)}
      className={on ? 'text-gray-100' : 'text-gray-500 hover:text-gray-300'}
    >
      {label} {on ? 'on' : 'off'}
    </button>
  );
}

type DictationViewId = 'sentence' | 'gaps' | 'paragraph';

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
