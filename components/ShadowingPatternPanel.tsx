'use client';

import React, { useState } from 'react';
import { Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import type { ShadowingPatternAnalysis } from '@/types';
import type { ShadowingPatternStatus } from '@/hooks/useShadowingPatternAnalysis';

interface ShadowingPatternPanelProps {
  status: ShadowingPatternStatus;
  analysis: ShadowingPatternAnalysis | null;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}

const TABS = [
  { key: 'stressRhythm', label: 'Trọng âm' },
  { key: 'intonationPitch', label: 'Ngữ điệu' },
  { key: 'connectedSpeech', label: 'Nối âm' },
  { key: 'chunking', label: 'Ngắt cụm' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function TabBody({ tab, analysis }: { tab: TabKey; analysis: ShadowingPatternAnalysis }) {
  if (tab === 'stressRhythm') {
    const { summary, stressedWords, notes } = analysis.stressRhythm;
    return (
      <>
        <p>{summary}</p>
        {stressedWords.length > 0 && (
          <p className="mt-1 text-xs text-gray-400">Nhấn: {stressedWords.join(', ')}</p>
        )}
        {notes && <p className="mt-1 text-xs text-gray-500">{notes}</p>}
      </>
    );
  }
  if (tab === 'intonationPitch') {
    const { summary, pattern, notes } = analysis.intonationPitch;
    return (
      <>
        <p>{summary}</p>
        <p className="mt-1 text-xs text-gray-400">Pattern: {pattern}</p>
        {notes && <p className="mt-1 text-xs text-gray-500">{notes}</p>}
      </>
    );
  }
  if (tab === 'connectedSpeech') {
    const { summary, features } = analysis.connectedSpeech;
    return (
      <>
        <p>{summary}</p>
        {features.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1 text-xs text-gray-400">
            {features.map((f, i) => (
              <li key={i}>
                <span className="font-medium text-gray-300">{f.type}</span> - {f.example}: {f.explanation}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
  const { summary, groups, pauseNotes } = analysis.chunking;
  return (
    <>
      <p>{summary}</p>
      {groups.length > 0 && <p className="mt-1 text-xs text-gray-400">{groups.join(' / ')}</p>}
      {pauseNotes && <p className="mt-1 text-xs text-gray-500">{pauseNotes}</p>}
    </>
  );
}

/** Card content for the shadowing-pattern explanation feature (Stage 7: tabbed, hosted in a side panel / bottom sheet). */
export function ShadowingPatternPanel({ status, analysis, error, onRetry, onClose }: ShadowingPatternPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('stressRhythm');
  // Stop clicks inside the panel from bubbling to the sentence row's onSentenceClick.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const Header = (
    <div className="flex items-center gap-1 border-b border-gray-800 px-1 pb-1">
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

  if (status === 'ready' && analysis) {
    return (
      <div onClick={stop} className="flex flex-col gap-2">
        {Header}
        <div className="flex items-center gap-1 border-b border-gray-800 px-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-2 py-1 text-xs whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeTab === t.key
                  ? 'text-emerald-400 border-emerald-400'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="px-2 text-sm text-gray-300 leading-relaxed overflow-hidden">
          <TabBody tab={activeTab} analysis={analysis} />
        </div>
      </div>
    );
  }

  return null;
}
