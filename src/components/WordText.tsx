'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { openWordStore, wordCardsOnStore } from '@/lib/lesson-session';
import { lookupWord, type WordCard } from '@/lib/wordLookup';

/** Two taps on the same word within this time open its card. */
const DOUBLE_TAP_MS = 350;

/**
 * Sentence text whose words open a card on double click or double tap (N3): IPA,
 * part of speech and a simple meaning in this sentence. One click still goes to the
 * row, so it plays the sentence. "Words off" makes it plain text.
 */
export function WordText({ text, sentenceId }: { text: string; sentenceId: number }) {
  const on = useSyncExternalStore(wordCardsOnStore.subscribe, wordCardsOnStore.get, () => true);
  const open = useSyncExternalStore(openWordStore.subscribe, openWordStore.get, () => null);
  const lastTap = useRef<{ index: number; at: number } | null>(null);

  if (!on) return <>{text}</>;

  const parts = text.split(/(\s+)/);
  const openIndex = open?.sentenceId === sentenceId ? open.index : null;

  return (
    <>
      {parts.map((p, i) =>
        /^\s*$/.test(p) ? (
          <React.Fragment key={i}>{p}</React.Fragment>
        ) : (
          <span
            key={i}
            // No word selection on a double click: the card is what was asked for.
            onMouseDown={(e) => {
              if (e.detail > 1) e.preventDefault();
            }}
            onClick={(e) => {
              const now = Date.now();
              const prev = lastTap.current;
              if (prev && prev.index === i && now - prev.at < DOUBLE_TAP_MS) {
                // The second tap only opens the card; the first one already played the row.
                e.stopPropagation();
                lastTap.current = null;
                openWordStore.set({ sentenceId, index: i });
                return;
              }
              lastTap.current = { index: i, at: now };
            }}
            className={`rounded-sm ${openIndex === i ? 'bg-gray-700' : ''}`}
          >
            {p}
          </span>
        ),
      )}
      {openIndex !== null && parts[openIndex] && (
        <Card key={openIndex} word={parts[openIndex]} sentence={text} onClose={() => openWordStore.set(null)} />
      )}
    </>
  );
}

function Card({ word, sentence, onClose }: { word: string; sentence: string; onClose: () => void }) {
  const [card, setCard] = useState<WordCard | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    lookupWord(word, sentence)
      .then((c) => alive && setCard(c))
      .catch((e: { code?: string }) => {
        if (!alive) return;
        setFailed(e?.code === 'functions/resource-exhausted' ? 'AI credit used up, or the daily limit is reached.' : 'Could not look it up. Try again.');
      });
    return () => {
      alive = false;
    };
  }, [word, sentence]);

  return (
    <span onClick={(e) => e.stopPropagation()} className="fade-in mt-2 block rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm" role="note">
      {card ? (
        <>
          <span className="text-gray-100">{card.word}</span> <span className="font-mono text-gray-400">{card.ipa}</span>{' '}
          <span className="text-xs text-gray-500">{card.partOfSpeech}</span>
          <span className="mt-1 block text-gray-300">{card.meaning}</span>
        </>
      ) : failed ? (
        <span className="text-gray-400">{failed}</span>
      ) : (
        <span className="breathe text-gray-500">Looking up…</span>
      )}
      <button type="button" onClick={onClose} className="mt-1 block text-xs text-gray-500 hover:text-gray-100">
        close
      </button>
    </span>
  );
}
