'use client';

import React from 'react';
import { Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { NOTE_LABEL, TONE_ARROW, isRenderableAnalysis, noteBadgeClass } from '@/lib/shadowingChunks';
import type { ShadowingChunk, ShadowingNote, ShadowingPatternAnalysis } from '@/types';
import type { ShadowingPatternStatus } from '@/hooks/useShadowingPatternAnalysis';

interface ShadowingPatternPanelProps {
  status: ShadowingPatternStatus;
  analysis: ShadowingPatternAnalysis | null;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}

const LEVEL_CLASS = {
  strong: 'text-gray-100 font-medium',
  normal: 'text-gray-300',
  weak: 'text-gray-500',
} as const;

/**
 * One thought group: the words with their stress marking, then the pitch arrow.
 * Groups flow inline separated by a divider rather than sitting on their own rows,
 * so a long sentence still reads as one sentence. The divider - not the line break -
 * is what marks a boundary, which is all a confident reader needs to know where the
 * speaker breathes.
 */
function Chunk({ chunk }: { chunk: ShadowingChunk }) {
  const arrow = TONE_ARROW[chunk.tone];
  return (
    <span>
      {chunk.tokens.map((token, i) => (
        <span
          key={i}
          className={`${LEVEL_CLASS[token.level]} ${
            token.linked ? 'underline decoration-dotted decoration-gray-700 underline-offset-[6px]' : ''
          }`}
        >
          {i > 0 ? ' ' : ''}
          {token.display}
        </span>
      ))}
      <span className={`ml-1 text-emerald-400 ${chunk.toneStrength === 'weak' ? 'opacity-50' : ''}`}>
        {chunk.toneStrength === 'weak' ? `(${arrow})` : arrow}
      </span>
    </span>
  );
}

function NoteRow({ note }: { note: ShadowingNote }) {
  const hasExample = !!note.text;
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] whitespace-nowrap ${noteBadgeClass(
          note.type
        )}`}
      >
        {NOTE_LABEL[note.type] ?? note.type}
      </span>
      <div className="min-w-0 flex-1">
        {hasExample && (
          <div className="text-sm leading-snug text-gray-200">
            <span className="font-medium">{note.text}</span>
            {note.sounds && <span className="text-gray-400"> → </span>}
            {note.sounds && <span>“{note.sounds}”</span>}
            {note.ipa && <span className="ml-1 font-mono text-[11px] text-gray-500">{note.ipa}</span>}
          </div>
        )}
        <div className="text-[13px] leading-snug text-gray-400">{note.why}</div>
      </div>
    </div>
  );
}

/**
 * Shadowing pattern explanation (v2 - one annotated line, no tabs).
 *
 * v1 split the same sentence across four tabs (stress / intonation / connected
 * speech / chunking), so reading it meant clicking three times and re-assembling
 * the sentence mentally. Stress, pitch and grouping are now one line: CAPS marks
 * the stressed syllable, dimmed words are the reduced ones, an arrow ends each
 * thought group. Only the things that genuinely differ from careful word-by-word
 * reading stay as prose, capped at `SHADOWING_MAX_NOTES` by the Cloud Function.
 *
 * The line is pinned (the notes scroll under it) because it is what the learner
 * looks at while speaking - it must not scroll away while they read a note.
 */
export function ShadowingPatternPanel({
  status,
  analysis,
  error,
  onRetry,
  onClose,
}: ShadowingPatternPanelProps) {
  // Stop clicks inside the panel from bubbling to the sentence row's onSentenceClick.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // Last line of defence: the manager already rejects an unrenderable analysis, but the
  // panel must not be the thing that throws if one ever reaches it - a crash here takes
  // the whole lesson view down through the route error boundary.
  const renderable = analysis !== null && isRenderableAnalysis(analysis);

  const Header = (
    <div className="flex shrink-0 items-center gap-1 border-b border-gray-800 px-1 pb-1">
      <div className="flex items-center gap-1.5 pl-1 pr-2 text-xs font-medium text-emerald-400">
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Shadowing pattern</span>
      </div>
      <div className="ml-auto shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
          title="Đóng"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );

  if (status === 'loading') {
    return (
      <div onClick={stop} className="flex flex-col gap-2">
        {Header}
        <div className="flex items-center gap-2 px-2 pb-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
          Đang phân tích âm thanh…
        </div>
      </div>
    );
  }

  if (status === 'ready' && !renderable) {
    return (
      <div onClick={stop} className="flex flex-col gap-2">
        {Header}
        <div className="px-2 pb-2 text-sm text-red-400">Kết quả phân tích không đọc được.</div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div onClick={stop} className="flex flex-col gap-2">
        {Header}
        <div className="flex items-center justify-between gap-3 px-2 pb-2 text-sm text-red-400">
          <span>{error || 'Không phân tích được câu này.'}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="flex shrink-0 items-center gap-1 rounded-md border border-red-500/30 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === 'ready' && analysis && renderable) {
    return (
      <div onClick={stop} className="flex h-full min-h-0 flex-col gap-2">
        {Header}

        {/* Pinned: the line stays put while the notes below it scroll. */}
        <div className="shrink-0 px-1 text-[17px] leading-loose">
          {analysis.chunks.map((chunk, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="mx-1.5 text-gray-600">|</span>}
              <Chunk chunk={chunk} />
            </React.Fragment>
          ))}
        </div>

        {analysis.notes.length > 0 && (
          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto border-t border-gray-800 px-1 pt-2.5 pb-1">
            {analysis.notes.map((note, i) => (
              <NoteRow key={i} note={note} />
            ))}
          </div>
        )}

        {/* A clean read is a real result, not an empty state - say so instead of showing nothing. */}
        {analysis.notes.length === 0 && (
          <div className="shrink-0 border-t border-gray-800 px-1 pt-2 text-[13px] text-gray-500">
            Câu này người nói đọc rõ, không có chỗ nối hay nuốt âm đáng chú ý.
          </div>
        )}
      </div>
    );
  }

  return null;
}
