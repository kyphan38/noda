'use client';

import { useEffect, useRef, useState } from 'react';
import { FolderPlus, Music2, Plus } from 'lucide-react';

const row = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white';

/** The one "+" in the sidebar: a new lesson or a new folder. */
export function SidebarAddMenu({ onNewLesson, onNewFolder }: { onNewLesson: () => void; onNewFolder: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        aria-label="New"
        title="New lesson or folder"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-800 text-gray-300 hover:border-gray-600 hover:text-white"
      >
        <Plus size={18} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-gray-700 bg-gray-900 py-1">
          <button type="button" role="menuitem" className={row} onClick={pick(onNewLesson)}>
            <Music2 size={15} aria-hidden /> New lesson
          </button>
          <button type="button" role="menuitem" className={row} onClick={pick(onNewFolder)}>
            <FolderPlus size={15} aria-hidden /> New folder
          </button>
        </div>
      )}
    </div>
  );
}
