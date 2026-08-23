'use client';

import React from 'react';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import type { ShadowingPatternAnalysis } from '@/types';
import type { ShadowingPatternStatus } from '@/hooks/useShadowingPatternAnalysis';

interface ShadowingPatternPanelProps {
  status: ShadowingPatternStatus;
  analysis: ShadowingPatternAnalysis | null;
  error: string | null;
  onRetry: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/80">{title}</span>
      <div className="text-sm text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

/** Renders the 4-section shadowing-pattern explanation below a sentence (Stage 5). */
export function ShadowingPatternPanel({ status, analysis, error, onRetry }: ShadowingPatternPanelProps) {
  // Stop clicks inside the panel from bubbling to the sentence row's onSentenceClick.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  if (status === 'loading') {
    return (
      <div
        onClick={stop}
        className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5 text-sm text-gray-400"
      >
        <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
        Đang phân tích âm thanh…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        onClick={stop}
        className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-400"
      >
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
    );
  }

  if (status === 'ready' && analysis) {
    return (
      <div
        onClick={stop}
        className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-3"
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Shadowing pattern
        </div>

        <Section title="Trọng âm & Nhịp điệu">
          <p>{analysis.stressRhythm.summary}</p>
          {analysis.stressRhythm.stressedWords.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Nhấn: {analysis.stressRhythm.stressedWords.join(', ')}
            </p>
          )}
          {analysis.stressRhythm.notes && (
            <p className="mt-1 text-xs text-gray-500">{analysis.stressRhythm.notes}</p>
          )}
        </Section>

        <Section title="Ngữ điệu & Cao độ">
          <p>{analysis.intonationPitch.summary}</p>
          <p className="mt-1 text-xs text-gray-400">Pattern: {analysis.intonationPitch.pattern}</p>
          {analysis.intonationPitch.notes && (
            <p className="mt-1 text-xs text-gray-500">{analysis.intonationPitch.notes}</p>
          )}
        </Section>

        <Section title="Nối âm">
          <p>{analysis.connectedSpeech.summary}</p>
          {analysis.connectedSpeech.features.length > 0 && (
            <ul className="mt-1 flex flex-col gap-1 text-xs text-gray-400">
              {analysis.connectedSpeech.features.map((f, i) => (
                <li key={i}>
                  <span className="font-medium text-gray-300">{f.type}</span> — {f.example}: {f.explanation}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Ngắt cụm">
          <p>{analysis.chunking.summary}</p>
          {analysis.chunking.groups.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">{analysis.chunking.groups.join(' / ')}</p>
          )}
          {analysis.chunking.pauseNotes && (
            <p className="mt-1 text-xs text-gray-500">{analysis.chunking.pauseNotes}</p>
          )}
        </Section>
      </div>
    );
  }

  return null;
}
