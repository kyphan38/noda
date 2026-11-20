'use client';

import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

import { TalkLearn } from '@/components/talk/TalkLearn';
import { TalkSession } from '@/components/talk/TalkSession';
import { stageAtLeast, summarizeSets } from '@/lib/talk/phrase-stage';
import { speak } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';
import type { TalkPhraseProgress, TalkTopic } from '@/lib/talk/types';

type Props = { topic: TalkTopic; onBack: () => void; onChange: (t: TalkTopic) => void; onDelete: () => void };

/** One topic: its sets, how many phrases of each you know, and the way into Learn. */
export function TalkTopicView({ topic, onBack, onChange, onDelete }: Props) {
  const [progress, setProgress] = useState<Map<string, TalkPhraseProgress> | null>(null);
  const [openSet, setOpenSet] = useState<number | null>(null);
  const [learning, setLearning] = useState<number | null>(null);
  const [talking, setTalking] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getTalkStore()
      .listProgress(topic.id)
      .then((m) => alive && setProgress(m))
      .catch(() => alive && setProgress(new Map()));
    return () => {
      alive = false;
    };
  }, [topic.id]);

  const sets = summarizeSets(topic.phrases, progress ?? new Map());

  if (talking !== null && progress) {
    return <TalkSession topic={topic} setIndex={talking} progress={progress} onProgress={setProgress} onExit={() => setTalking(null)} />;
  }
  if (learning !== null && progress) {
    return (
      <TalkLearn
        topic={topic}
        setIndex={learning}
        progress={progress}
        onProgress={setProgress}
        onExit={() => setLearning(null)}
      />
    );
  }

  const toggleRemoved = async (phraseId: string, removed: boolean) => {
    const phrases = await getTalkStore().setPhraseRemoved(topic, phraseId, removed);
    onChange({ ...topic, phrases });
  };

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="text-sm text-gray-400 hover:text-gray-100">
        ← Topics
      </button>
      <div>
        <h2 className="text-lg font-medium text-gray-100">
          {topic.title} <span className="ml-1 text-xs text-gray-500">{topic.level}</span>
        </h2>
        <p className="text-sm text-gray-400">
          With {topic.persona.name}, {topic.persona.role}
        </p>
      </div>

      {progress === null ? (
        <p className="breathe text-sm text-gray-500">Loading…</p>
      ) : (
        <ul className="space-y-3">
          {sets.map((s) => (
            <li key={s.setIndex} className="rounded-xl border border-gray-800 bg-gray-900/60">
              <div className="flex items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setOpenSet(openSet === s.setIndex ? null : s.setIndex)} className="min-w-0 flex-1 text-left">
                  <span className="text-sm text-gray-100">Set {s.setIndex + 1}</span>
                  <span className="ml-2 text-xs text-gray-500 tabular-nums">
                    {s.learned}/{s.total} learned
                  </span>
                </button>
                <button type="button" onClick={() => setLearning(s.setIndex)} className="rounded-lg border border-gray-700 px-3 py-1 text-sm text-gray-300 hover:text-gray-100">
                  {s.learned === s.total ? 'Review' : 'Learn'}
                </button>
                <button type="button" onClick={() => setTalking(s.setIndex)} className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500">
                  Talk
                </button>
              </div>
              {openSet === s.setIndex && (
                <ul className="divide-y divide-gray-800 border-t border-gray-800">
                  {topic.phrases
                    .filter((p) => p.setIndex === s.setIndex)
                    .map((p) => (
                      <li key={p.id} className={`flex items-center gap-3 px-4 py-2 ${p.removed ? 'opacity-40' : ''}`}>
                        <button type="button" aria-label={`Play ${p.text}`} onClick={() => speak(p.text)} className="text-gray-500 hover:text-gray-100">
                          <Volume2 className="h-4 w-4" />
                        </button>
                        <span className="min-w-0 flex-1">
                          <span className="text-sm text-gray-100">{p.text}</span>
                          {stageAtLeast(progress.get(p.id)?.stage, 'recalled') && <span className="ml-2 text-xs text-green-400">✓</span>}
                          <span className="block text-xs text-gray-500">{p.meaning}</span>
                        </span>
                        <button type="button" onClick={() => void toggleRemoved(p.id, !p.removed)} className="text-xs text-gray-500 hover:text-gray-100">
                          {p.removed ? 'Bring back' : 'Hide'}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {topic.kind === 'custom' && (
        <button
          type="button"
          onClick={() => {
            if (!window.confirm(`Delete "${topic.title}" and its phrases?`)) return;
            void getTalkStore()
              .deleteTopic(topic.id)
              .then(onDelete);
          }}
          className="text-xs text-gray-500 hover:text-red-400"
        >
          Delete topic
        </button>
      )}
    </div>
  );
}
