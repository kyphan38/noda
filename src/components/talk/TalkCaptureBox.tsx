'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { capturesToNotes, cleanCapture, recentCaptures, type TalkCapture } from '@/lib/talk/capture';
import { getTalkStore } from '@/lib/talk/store';

type Props = {
  busy?: boolean;
  /** Makes a topic from the notes; resolves with its id, or null when it failed. */
  onPractice?: (notes: string) => Promise<string | null>;
};

/** Save something you could not say in a real talk, in a few seconds. Any language. Then practice them as a topic. */
export function TalkCaptureBox({ busy = false, onPractice }: Props) {
  const [rows, setRows] = useState<TalkCapture[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getTalkStore()
      .listCaptures()
      .then((r) => alive && setRows(recentCaptures(r)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = cleanCapture(text);
    if (!clean) return setError('Type what you wanted to say.');
    try {
      const row = await getTalkStore().addCapture(clean);
      setRows((r) => recentCaptures([row, ...r]));
      setText('');
    } catch {
      setError('Could not save. Try again.');
    }
  };

  const unused = rows.filter((r) => !r.usedInTopicId);

  const practice = async () => {
    if (!onPractice || unused.length === 0) return;
    const ids = unused.map((r) => r.id);
    const topicId = await onPractice(capturesToNotes(unused));
    if (!topicId) return;
    setRows((r) => r.map((x) => (ids.includes(x.id) ? { ...x, usedInTopicId: topicId } : x)));
    void getTalkStore().markCapturesUsed(ids, topicId).catch(() => {});
  };

  const remove = (id: string) => {
    setRows((r) => r.filter((x) => x.id !== id));
    void getTalkStore().deleteCapture(id).catch(() => {});
  };

  return (
    <section className="space-y-2 rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <form onSubmit={save} className="flex gap-2">
        <input
          value={text}
          maxLength={300}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder="Got stuck? Note it here"
          className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-transparent px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-900 hover:bg-white">
          Save
        </button>
      </form>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setOpen(!open)} className="text-xs text-gray-500 hover:text-gray-100">
              {open ? 'Hide' : `Saved (${rows.length})`}
            </button>
            {onPractice && unused.length > 0 && (
              <button type="button" disabled={busy} onClick={() => void practice()} className="text-xs text-gray-300 hover:text-gray-100 disabled:cursor-wait">
                Practice these ({unused.length})
              </button>
            )}
          </div>
          {open && (
            <ul className="space-y-1">
              {rows.map((r) => (
                <li key={r.id} className={`flex items-start gap-2 text-sm ${r.usedInTopicId ? 'text-gray-600' : 'text-gray-300'}`}>
                  <span className="min-w-0 flex-1">{r.text}</span>
                  <button type="button" aria-label={`Delete ${r.text}`} onClick={() => remove(r.id)} className="mt-0.5 text-gray-600 hover:text-gray-100">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
