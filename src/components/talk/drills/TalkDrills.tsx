'use client';

import { useState } from 'react';

import { Drill432 } from '@/components/talk/drills/Drill432';
import { DrillCapsule } from '@/components/talk/drills/DrillCapsule';
import { DrillRetell } from '@/components/talk/drills/DrillRetell';

const DRILLS = [
  { id: '432', title: '60 · 45 · 30', hint: 'Same answer, less time each round' },
  { id: 'retell', title: 'Read and retell', hint: 'Paste a text, then tell it' },
  { id: 'capsule', title: 'Time Capsule', hint: 'One minute, once a month' },
] as const;
type DrillId = (typeof DRILLS)[number]['id'];

/** Extra speaking drills beside the topic talks. */
export function TalkDrills() {
  const [open, setOpen] = useState<DrillId | null>(null);

  if (open) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setOpen(null)} className="text-sm text-gray-400 hover:text-gray-100">
          ← {DRILLS.find((d) => d.id === open)?.title}
        </button>
        {open === '432' && <Drill432 />}
        {open === 'retell' && <DrillRetell />}
        {open === 'capsule' && <DrillCapsule />}
      </div>
    );
  }
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-gray-400">Drills</h2>
      <ul className="divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-900/60">
        {DRILLS.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => setOpen(d.id)} className="w-full px-4 py-3 text-left hover:bg-gray-800/60">
              <span className="block text-sm text-gray-100">{d.title}</span>
              <span className="block text-xs text-gray-500">{d.hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
