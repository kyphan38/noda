'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Check, BadgeCheck } from 'lucide-react';
import { useFlashcardEngine } from '@/hooks/useFlashcardEngine';
import type { FlashcardRating } from '@/hooks/useFlashcardEngine';
import { DeckItem } from '@/types';
import { getLessonFirestore, saveLessonFirestore } from '@/lib/db';

interface FlashcardViewerProps {
  deck: DeckItem;
  onComplete: () => void;
  onDeckUpdated?: () => void;
}

function linesFromLesson(lesson: Awaited<ReturnType<typeof getLessonFirestore>>): string[] {
  if (!lesson) return [];
  const fromFlash = lesson.flashcardData?.lines;
  if (fromFlash && fromFlash.length > 0) return [...fromFlash];
  return lesson.transcriptText
    ? lesson.transcriptText.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
}

export function FlashcardViewer({ deck, onComplete, onDeckUpdated }: FlashcardViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editText, setEditText] = useState('');
  const [clickFlash, setClickFlash] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const lesson = await getLessonFirestore(deck.id);
      const next = linesFromLesson(lesson);
      setLines(next);
      setEditText(next.join('\n'));
    } catch {
      setLoadError('Could not load deck.');
      setLines([]);
      setEditText('');
    } finally {
      setLoading(false);
    }
  }, [deck.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onPersistRate = useCallback(
    (lineIndex: number, rating: FlashcardRating) => {
      void (async () => {
        try {
          const lesson = await getLessonFirestore(deck.id);
          if (!lesson?.flashcardData) return;
          lesson.flashcardData = {
            ...lesson.flashcardData,
            ratings: { ...lesson.flashcardData.ratings, [lineIndex]: rating },
          };
          lesson.updatedAt = Date.now();
          await saveLessonFirestore(lesson);
          onDeckUpdated?.();
        } catch {
          /* ignore */
        }
      })();
    },
    [deck.id, onDeckUpdated]
  );

  const engine = useFlashcardEngine(lines, onComplete, { onRate: onPersistRate });

  const flashAndRate = (key: string, rating: FlashcardRating) => {
    setClickFlash(key);
    window.setTimeout(() => engine.handleRating(rating), 0);
    window.setTimeout(() => setClickFlash(null), 300);
  };

  const handleResetDeck = async () => {
    try {
      const lesson = await getLessonFirestore(deck.id);
      if (!lesson) return;
      const baseLines =
        lesson.flashcardData?.lines && lesson.flashcardData.lines.length > 0
          ? lesson.flashcardData.lines
          : lines;
      lesson.flashcardData = {
        ratings: {},
        currentIndex: 0,
        isShuffled: false,
        shuffledIndices: [],
        lines: baseLines,
      };
      lesson.totalSentences = baseLines.length;
      lesson.updatedAt = Date.now();
      await saveLessonFirestore(lesson);
      setLines([...baseLines]);
      onDeckUpdated?.();
    } catch {
      setLoadError('Failed to reset deck.');
    }
  };

  const handleSaveEdit = async () => {
    const nextLines = editText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    try {
      const lesson = await getLessonFirestore(deck.id);
      if (!lesson) return;
      lesson.flashcardData = {
        ...(lesson.flashcardData ?? {
          ratings: {},
          currentIndex: 0,
          isShuffled: false,
          shuffledIndices: [],
        }),
        lines: nextLines,
      };
      lesson.totalSentences = nextLines.length;
      lesson.updatedAt = Date.now();
      await saveLessonFirestore(lesson);
      setLines(nextLines);
      setIsEditing(false);
      onDeckUpdated?.();
    } catch {
      setLoadError('Failed to save deck.');
    }
  };

  if (loading) {
    return (
      <div className="flashcard-viewer-container flex items-center justify-center text-gray-400 text-sm">
        Loading deck…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flashcard-viewer-container flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-red-400 text-sm">{loadError}</p>
        <button type="button" className="flashcard-btn-ghost" onClick={() => reload()}>
          Retry
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flashcard-viewer-container flashcard-editor">
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="deck-textarea"
          rows={18}
          aria-label="Deck lines, one card per line"
        />
        <div className="flex gap-2 mt-4">
          <button type="button" className="flashcard-btn-ghost bg-emerald-600/20 border-emerald-500/50 text-emerald-300" onClick={handleSaveEdit}>
            Save &amp; Resume
          </button>
          <button type="button" className="flashcard-btn-ghost" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flashcard-viewer-container flex flex-col items-center justify-center gap-4 text-center text-gray-400">
        <p className="text-sm">This deck has no cards yet.</p>
        <button type="button" className="flashcard-btn-ghost" onClick={() => setIsEditing(true)}>
          Add lines
        </button>
      </div>
    );
  }

  const doneMessage = !engine.hasCards && engine.totalCards > 0 ? 'All caught up!' : engine.currentCard;
  const keyFlash = (k: string) => engine.flashedButton === k || clickFlash === k;

  return (
    <div className="flashcard-viewer-container">
      <div className="flashcard-header">
        <div className="header-actions w-full flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-gray-500 tabular-nums shrink-0">{lines.length} cards</span>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleResetDeck}
              title="Reset deck progress"
              className="flashcard-btn-ghost border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Reset deck
            </button>
            <button
              type="button"
              onClick={engine.toggleShuffle}
              className={`flashcard-btn-ghost ${engine.isShuffle ? 'active' : ''}`}
            >
              {engine.isShuffle ? 'Shuffle on' : 'Sequential'}
            </button>
            <button type="button" className="flashcard-btn-ghost" onClick={() => setIsEditing(true)}>
              Edit
            </button>
          </div>
        </div>
      </div>

      <div className="flashcard-main">
        <h2 className="flashcard-text">{engine.hasCards ? engine.currentCard : doneMessage}</h2>
      </div>

      {engine.hasCards && (
        <div className="flashcard-controls">
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            className={`rate-btn btn-again ${keyFlash('1') ? 'flash-active' : ''}`}
            onClick={() => flashAndRate('1', 'again')}
          >
            <span className="shortcut-hint">1</span>
            <RotateCcw className="w-4 h-4 shrink-0" strokeWidth={2.25} aria-hidden />
            Again
          </button>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            className={`rate-btn btn-good ${keyFlash('2') ? 'flash-active' : ''}`}
            onClick={() => flashAndRate('2', 'good')}
          >
            <span className="shortcut-hint">2</span>
            <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} aria-hidden />
            Good
          </button>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            className={`rate-btn btn-done ${keyFlash('3') ? 'flash-active' : ''}`}
            onClick={() => flashAndRate('3', 'done')}
          >
            <span className="shortcut-hint">3</span>
            <BadgeCheck className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />
            Done
          </button>
        </div>
      )}
    </div>
  );
}
