'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy' | 'done';

function shuffleIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isTypingInField(): boolean {
  const ae = document.activeElement;
  if (!ae) return false;
  if (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || ae instanceof HTMLSelectElement) {
    return true;
  }
  if (ae instanceof HTMLElement && ae.isContentEditable) return true;
  return false;
}

export function useFlashcardEngine(
  initialLines: string[],
  onComplete: () => void,
  options?: { onRate?: (lineIndex: number, rating: FlashcardRating) => void }
) {
  const [lines, setLines] = useState<string[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [isShuffle, setIsShuffle] = useState(false);
  const [flashedButton, setFlashedButton] = useState<string | null>(null);

  const orderRef = useRef<number[]>([]);
  const linesRef = useRef<string[]>([]);
  const onCompleteRef = useRef(onComplete);
  const onRateRef = useRef(options?.onRate);
  const completeFiredRef = useRef(false);

  onCompleteRef.current = onComplete;
  onRateRef.current = options?.onRate;

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    completeFiredRef.current = false;
    const cleaned = initialLines.map((l) => l.trim()).filter((l) => l.length > 0);
    setLines(cleaned);
    const n = cleaned.length;
    const ord = n === 0 ? [] : isShuffle ? shuffleIndices(n) : Array.from({ length: n }, (_, i) => i);
    setOrder(ord);
  }, [initialLines, isShuffle]);

  const originalTotal = lines.length;
  const cardsRemaining = order.length;
  const progress =
    originalTotal === 0 ? 0 : Math.round(((originalTotal - cardsRemaining) / originalTotal) * 100);
  const currentIndex = originalTotal - cardsRemaining;
  const currentCard = order.length > 0 ? lines[order[0]] ?? '' : '';
  const currentLineOneBased = order.length > 0 ? order[0] + 1 : 0;

  const handleRating = useCallback((rating: FlashcardRating) => {
    setOrder((prev) => {
      if (prev.length === 0) return prev;
      const idx = prev[0];
      onRateRef.current?.(idx, rating);
      const rest = prev.slice(1);

      if (rating === 'done') {
        return rest;
      }
      if (rating === 'good' || rating === 'easy') {
        return [...rest, idx];
      }
      if (rating === 'again' || rating === 'hard') {
        if (rest.length === 0) return [idx];
        return [rest[0]!, idx, ...rest.slice(1)];
      }
      return rest;
    });
  }, []);

  useEffect(() => {
    if (originalTotal > 0 && order.length === 0 && !completeFiredRef.current) {
      completeFiredRef.current = true;
      onCompleteRef.current();
    }
  }, [order.length, originalTotal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingInField()) return;
      const el = e.target as HTMLElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable) {
        return;
      }
      const keyMap: Record<string, FlashcardRating> = {
        '1': 'again',
        '2': 'good',
        '3': 'done',
      };
      const rating = keyMap[e.key];
      if (!rating) return;
      if (orderRef.current.length === 0) return;
      e.preventDefault();
      setFlashedButton(e.key);
      window.setTimeout(() => {
        handleRating(rating);
      }, 0);
      window.setTimeout(() => setFlashedButton(null), 300);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRating]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((s) => !s);
  }, []);

  const jumpToLineOneBased = useCallback((oneBased: number) => {
    const lineIndex = oneBased - 1;
    setOrder((prev) => {
      const L = linesRef.current.length;
      if (lineIndex < 0 || lineIndex >= L) return prev;
      const pos = prev.indexOf(lineIndex);
      if (pos === -1) return prev;
      return [...prev.slice(pos), ...prev.slice(0, pos)];
    });
  }, []);

  return {
    currentCard,
    progress,
    currentIndex,
    totalCards: originalTotal,
    queueLength: order.length,
    currentLineOneBased,
    isShuffle,
    toggleShuffle,
    handleRating,
    flashedButton,
    hasCards: order.length > 0,
    jumpToLineOneBased,
  };
}
