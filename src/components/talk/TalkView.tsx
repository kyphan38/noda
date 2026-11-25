'use client';

import { useEffect, useState } from 'react';
import { Plus, Shuffle } from 'lucide-react';

import { TalkCaptureBox } from '@/components/talk/TalkCaptureBox';
import { TalkTopicView } from '@/components/talk/TalkTopicView';
import { TalkDrills } from '@/components/talk/drills/TalkDrills';
import { TalkWeekCard } from '@/components/talk/TalkWeekCard';
import { TALK_CATEGORIES, TALK_PRESETS, presetTopicId, randomPreset, type TalkPreset } from '@/lib/talk/presets';
import { warmUpVoices } from '@/lib/talk/speak';
import { getTalkStore } from '@/lib/talk/store';
import { TALK_LEVELS, type TalkLevel, type TalkTopic } from '@/lib/talk/types';
import type { TopicRequest } from '@/lib/db';

const LEVEL_KEY = 'noda.talk.level';
const TAB_KEY = 'noda.talk.tab';
const SECTION_KEY = 'noda.talk.section';
type Section = 'topics' | 'drills';

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: kept for this visit only.
  }
}

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
  const [tab, setTab] = useState('Work');
  const [section, setSection] = useState<Section>('topics');
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    setLevel(readLevel());
    try {
      const t = localStorage.getItem(TAB_KEY) ?? 'Work';
      // Drills used to be a tab next to the categories.
      setTab(t === 'drills' || t === 'starred' ? 'Work' : t);
      setSection(localStorage.getItem(SECTION_KEY) === 'drills' || t === 'drills' ? 'drills' : 'topics');
    } catch {
      // Private mode: start on Work.
    }
    warmUpVoices();
    getTalkStore()
      .listTopics()
      .then(setSaved)
      .catch(() => setSaved([]));
  }, []);

  const pickLevel = (l: TalkLevel) => {
    setLevel(l);
    save(LEVEL_KEY, l);
  };

  const pickTab = (id: string) => {
    setTab(id);
    save(TAB_KEY, id);
  };

  const pickSection = (s: Section) => {
    setSection(s);
    save(SECTION_KEY, s);
  };

  const openTopic = async (req: TopicRequest): Promise<TalkTopic | null> => {
    setError(null);
    setMaking(req.topicId);
    try {
      const topic = await getTalkStore().ensureTopic(req);
      setSaved((prev) => [...(prev ?? []).filter((t) => t.id !== topic.id), topic]);
      setOpen(topic);
      return topic;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the topic.');
      return null;
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

  const categories: { id: string; label: string }[] = [
    ...(custom.length > 0 ? [{ id: 'yours', label: 'Yours' }] : []),
    ...TALK_CATEGORIES.map((c) => ({ id: c, label: c })),
  ];
  const current = categories.find((t) => t.id === tab)?.id ?? categories[0].id;
  const chip = (on: boolean) =>
    `shrink-0 rounded-lg border px-2.5 py-1 text-xs transition-colors ${on ? 'border-gray-500 bg-gray-800 text-gray-100' : 'border-gray-800 text-gray-400 hover:text-gray-100'}`;
  const select =
    'rounded-lg border border-gray-800 bg-gray-950 px-2.5 py-1.5 text-sm text-gray-100 focus:border-gray-500 focus:outline-none';

  return (
    <div className="mx-auto w-full max-w-xl pb-10 sm:pb-16 space-y-5">
      <TalkWeekCard />

      <div className="flex items-center gap-2">
        <div className="flex gap-1" role="tablist">
          {(['topics', 'drills'] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => pickSection(id)} className={chip(section === id)}>
              {id === 'topics' ? 'Topics' : 'Drills'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            title="Surprise me"
            aria-label="Surprise me"
            disabled={making !== null}
            onClick={() => void openPreset(randomPreset())}
            className={chip(false)}
          >
            <Shuffle className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" aria-expanded={showNew} onClick={() => setShowNew((v) => !v)} className={`${chip(showNew)} inline-flex items-center gap-1`}>
            <Plus className="h-3.5 w-3.5" aria-hidden /> New
          </button>
        </div>
      </div>

      {showNew && (
        <div className="space-y-3">
          <NewTopicForm
            busy={making !== null}
            onCreate={(title, description, notes) =>
              void openTopic({ topicId: newCustomId(), kind: 'custom', title, description, level, ...(notes ? { notes, notesKind: 'context' as const } : {}) })
            }
          />
          <TalkCaptureBox
            busy={making !== null}
            onPractice={async (notes) =>
              (await openTopic({ topicId: newCustomId(), kind: 'custom', title: 'Things I got stuck on', description: '', level, notes, notesKind: 'stuck' }))?.id ?? null
            }
          />
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {section === 'drills' && <TalkDrills />}
      {section === 'topics' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <select aria-label="Category" value={current} onChange={(e) => pickTab(e.target.value)} className={`${select} min-w-0 flex-1`}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <select aria-label="Level" value={level} onChange={(e) => pickLevel(e.target.value as TalkLevel)} className={select}>
              {TALK_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          {current === 'yours' ? (
            <TopicList>
              {custom.map((t) => (
                <TopicRow key={t.id} title={t.title} hint={t.description} ready busy={making === t.id} onOpen={() => setOpen(t)} />
              ))}
            </TopicList>
          ) : (
            <TopicList>
              {TALK_PRESETS.filter((p) => p.category === current).map((p) => {
                const id = presetTopicId(p.id, level);
                return (
                  <TopicRow key={id} title={p.title} hint={p.description} ready={savedIds.has(id)} busy={making === id} disabled={making !== null} onOpen={() => void openPreset(p)} />
                );
              })}
            </TopicList>
          )}
        </div>
      )}
    </div>
  );
}

function TopicList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">{children}</ul>;
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

function NewTopicForm({ busy, onCreate }: { busy: boolean; onCreate: (title: string, description: string, notes: string) => void }) {
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Enter a topic first.');
      return;
    }
    onCreate(title.trim(), description.trim(), notes.trim());
    setNotes('');
    setShowNotes(false);
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
        placeholder="Your own topic: Ask my neighbor to turn the music down"
        className="w-full rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
      />
      <textarea
        value={description}
        maxLength={400}
        rows={2}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Details (optional)"
        className="w-full resize-none rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
      />
      {showNotes ? (
        <textarea
          value={notes}
          maxLength={2000}
          rows={5}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste your notes: an agenda, a ticket, what happened. The talk is built from them."
          className="w-full resize-y rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
        />
      ) : (
        <button type="button" onClick={() => setShowNotes(true)} className="text-xs text-gray-500 hover:text-gray-100">
          + Add your notes (meeting prep)
        </button>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-red-400">{error}</span>
        <button type="submit" disabled={busy} className="rounded-lg bg-gray-100 font-medium text-gray-900 hover:bg-white px-3 py-1.5 text-sm disabled:opacity-50">
          Make topic
        </button>
      </div>
    </form>
  );
}
