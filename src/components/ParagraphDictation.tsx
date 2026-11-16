'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { Sentence } from '@/types';
import { checkParagraph, groupParagraphs, type ParagraphCheck } from '@/lib/paragraph-dictation';
import { playRange, playRangeStore } from '@/lib/lesson-session';

/**
 * Paragraph dictation (N7): play a few sentences in one go, write them all in one
 * box with no letter-by-letter help, then check which words were right.
 * Practice only: nothing is saved.
 */
export function ParagraphDictation({ transcript }: { transcript: Sentence[] }) {
  const groups = useMemo(() => groupParagraphs(transcript), [transcript]);
  const [part, setPart] = useState(0);
  const [text, setText] = useState('');
  const [result, setResult] = useState<ParagraphCheck | null>(null);

  // Leaving this view hands playback back to the per-sentence rules.
  useEffect(() => () => playRangeStore.set(null), []);

  const group = groups[Math.min(part, groups.length - 1)];
  if (!group || group.length === 0) return <p className="p-3 text-sm text-gray-500">No sentences.</p>;

  const play = () => playRange(group[0].start, group[group.length - 1].end);
  const go = (to: number) => {
    setPart(to);
    setText('');
    setResult(null);
  };
  const target = group.map((s) => s.text).join(' ');

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center gap-4 text-sm">
        <button type="button" onClick={play} className="rounded-lg bg-gray-100 px-3 py-1.5 font-medium text-gray-900 hover:bg-white">
          Play part
        </button>
        <span className="text-gray-500 tabular-nums">
          Part {part + 1} of {groups.length} · {group.length} sentences
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        onKeyDown={(e) => {
          // Same key as sentence dictation: Control plays the part again.
          if (e.key === 'Control') {
            e.preventDefault();
            play();
          }
        }}
        rows={5}
        placeholder="Write the whole part, then Check. Control plays it again."
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-100 outline-none focus:border-gray-500"
      />

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button type="button" onClick={() => setResult(checkParagraph(text, target))} disabled={!text.trim()} className="text-gray-100 hover:text-white disabled:opacity-40">
          Check
        </button>
        {part > 0 && (
          <button type="button" onClick={() => go(part - 1)} className="text-gray-400 hover:text-gray-100">
            previous
          </button>
        )}
        {part < groups.length - 1 && (
          <button type="button" onClick={() => go(part + 1)} className="text-gray-400 hover:text-gray-100">
            next part
          </button>
        )}
      </div>

      {result && (
        <div className="fade-in space-y-2">
          <p className="text-sm text-gray-300 tabular-nums">
            {result.percent}% right · {result.right} of {result.total} words
            {result.extra > 0 ? ` · ${result.extra} extra` : ''}
          </p>
          <p className="text-sm leading-relaxed">
            {result.marks.map((m, i) => (
              <React.Fragment key={i}>
                <span className={m.ok ? 'text-gray-100' : 'rounded-sm bg-gray-700 px-0.5 text-gray-300'}>{m.word}</span>{' '}
              </React.Fragment>
            ))}
          </p>
          <p className="text-xs text-gray-500">Words on a gray box were missed.</p>
        </div>
      )}
    </div>
  );
}
