'use client';

import React, { useEffect, useState } from 'react';
import { lookupWord, type WordCard } from '@/lib/wordLookup';

/**
 * Sentence text whose words can be tapped (N3) while the row is active: the card
 * shows IPA, part of speech and a simple meaning in this sentence. Inactive rows
 * stay plain text, so a tap there still plays the sentence.
 */
export function WordText({ text, active }: { text: string; active: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  // The card belongs to the playing row: leaving it closes the card.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setPicked(null);
  }

  if (!active) return <>{text}</>;

  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((p, i) =>
        /^\s*$/.test(p) ? (
          <React.Fragment key={i}>{p}</React.Fragment>
        ) : (
          <span
            key={i}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setPicked((cur) => (cur === p ? null : p));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                setPicked(p);
              }
            }}
            className={`cursor-pointer rounded-sm hover:bg-gray-700 ${picked === p ? 'bg-gray-700' : ''}`}
          >
            {p}
          </span>
        ),
      )}
      {picked && <Card key={picked} word={picked} sentence={text} onClose={() => setPicked(null)} />}
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
        setFailed(e?.code === 'functions/resource-exhausted' ? 'AI credit used up, or the daily limit is reached.' : 'Could not look it up. Tap the word again.');
      });
    return () => {
      alive = false;
    };
  }, [word, sentence]);

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      className="fade-in mt-2 block rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm"
      role="note"
    >
      {card ? (
        <>
          <span className="text-gray-100">{card.word}</span>{' '}
          <span className="font-mono text-gray-400">{card.ipa}</span>{' '}
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
