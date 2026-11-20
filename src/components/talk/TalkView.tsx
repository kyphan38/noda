'use client';

import { useEffect, useState } from 'react';

import { TalkTopicView } from '@/components/talk/TalkTopicView';
import { TALK_PRESETS, presetTopicId, type TalkPreset } from '@/lib/talk/presets';
import { warmUpVoices } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';
import { TALK_LEVELS, type TalkLevel, type TalkTopic } from '@/lib/talk/types';
import type { TopicRequest } from '@/lib/db';

const LEVEL_KEY = 'noda.talk.level';

function readLevel(): TalkLevel {
  try {
    const v = localStorage.getItem(LEVEL_KEY);
    return TALK_LEVELS.find((l) => l === v) ?? 'B2';
  } catch {
    return 'B2';
  }
}

function newCustomId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Topic list: built-in topics at your level, your own topics, and a form to add one. */
export function TalkView() {
  const [level, setLevel] = useState<TalkLevel>('B2');
  const [saved, setSaved] = useState<TalkTopic[] | null>(null);
  const [open, setOpen] = useState<TalkTopic | null>(null);
  const [making, setMaking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLevel(readLevel());
    warmUpVoices();
    getTalkStore()
      .listTopics()
      .then(setSaved)
      .catch(() => setSaved([]));
  }, []);

  const pickLevel = (l: TalkLevel) => {
    setLevel(l);
    try {
      localStorage.setItem(LEVEL_KEY, l);
    } catch {
      // Private mode: the level is kept for this visit only.
    }
  };

  const openTopic = async (req: TopicRequest) => {
    setError(null);
    setMaking(req.topicId);
    try {
      const topic = await getTalkStore().ensureTopic(req);
      setSaved((prev) => [...(prev ?? []).filter((t) => t.id !== topic.id), topic]);
      setOpen(topic);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the topic.');
    } finally {
      setMaking(null);
    }
  };

  const openPreset = (p: TalkPreset) =>
    openTopic({ topicId: presetTopicId(p.id, level), kind: 'preset', presetId: p.id, title: p.title, description: p.description, level });

  if (open) {
    return (
      <TalkTopicView
        topic={open}
        onBack={() => setOpen(null)}
        onChange={(t) => {
          setOpen(t);
          setSaved((prev) => (prev ?? []).map((x) => (x.id === t.id ? t : x)));
        }}
        onDelete={() => {
          setSaved((prev) => (prev ?? []).filter((x) => x.id !== open.id));
          setOpen(null);
        }}
      />
    );
  }

  const savedIds = new Set((saved ?? []).map((t) => t.id));
  const custom = (saved ?? []).filter((t) => t.kind === 'custom' && t.level === level);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2" role="radiogroup" aria-label="Level">
        {TALK_LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={level === l}
            onClick={() => pickLevel(l)}
            className={`rounded-lg border px-3 py-1 text-sm transition-colors ${
              level === l ? 'border-blue-500 bg-blue-500/15 text-blue-300' : 'border-gray-800 text-gray-400 hover:text-gray-100'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <NewTopicForm busy={making !== null} onCreate={(title, description) => openTopic({ topicId: newCustomId(), kind: 'custom', title, description, level })} />

      {custom.length > 0 && (
        <TopicList title="Your topics">
          {custom.map((t) => (
            <TopicRow key={t.id} title={t.title} hint={t.description} ready busy={making === t.id} onOpen={() => setOpen(t)} />
          ))}
        </TopicList>
      )}

      <TopicList title="Topics">
        {TALK_PRESETS.map((p) => {
          const id = presetTopicId(p.id, level);
          return (
            <TopicRow key={id} title={p.title} hint={p.description} ready={savedIds.has(id)} busy={making === id} disabled={making !== null} onOpen={() => void openPreset(p)} />
          );
        })}
      </TopicList>
    </div>
  );
}

function TopicList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-gray-400">{title}</h2>
      <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">{children}</ul>
    </section>
  );
}

function TopicRow(props: { title: string; hint: string; ready: boolean; busy: boolean; disabled?: boolean; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        disabled={props.disabled}
        onClick={props.onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/60 disabled:cursor-wait"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-gray-100">{props.title}</span>
          <span className="block truncate text-xs text-gray-500">{props.hint}</span>
        </span>
        <span className="shrink-0 text-xs text-gray-500">{props.busy ? <span className="breathe">Making…</span> : props.ready ? '' : 'New'}</span>
      </button>
    </li>
  );
}

function NewTopicForm({ busy, onCreate }: { busy: boolean; onCreate: (title: string, description: string) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Enter a topic first.');
      return;
    }
    onCreate(title.trim(), description.trim());
    setTitle('');
    setDescription('');
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <input
        value={title}
        maxLength={80}
        onChange={(e) => {
          setTitle(e.target.value);
          setError(null);
        }}
        placeholder="Your own topic: Explain a slow API to my team"
        className="w-full rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
      />
      <textarea
        value={description}
        maxLength={400}
        rows={2}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Details (optional)"
        className="w-full resize-none rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-red-400">{error}</span>
        <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
          Make topic
        </button>
      </div>
    </form>
  );
}
