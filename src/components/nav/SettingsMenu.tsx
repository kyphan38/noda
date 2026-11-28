'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { BookOpen, Download, LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react';

import { BackgroundMusicSettings } from '@/components/nav/BackgroundMusicSettings';
import { useExportAll } from '@/hooks/useExportAll';
import { themeStore, type Theme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

const row = 'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white';

/** Gear button with theme, background music, export, guide and log out. */
export function SettingsMenu({ placement, onLogout, className }: { placement: 'rail' | 'bar'; onLogout: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.get, themeStore.getServer);
  const ThemeIcon = THEME_ICONS[theme];
  const { exporting, exportAll } = useExportAll();

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

  return (
    <div ref={box} className={cn('relative', className)}>
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] transition-colors',
          open ? 'text-white' : 'text-gray-500 hover:text-gray-100'
        )}
      >
        <span className={cn('rounded-full px-3 py-0.5', open && 'bg-gray-800')}>
          <Settings size={20} aria-hidden />
        </span>
        {placement === 'bar' && <span>Settings</span>}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-[60] w-60 rounded-xl border border-gray-700 bg-gray-900 py-1',
            placement === 'rail' ? 'bottom-0 left-full ml-2' : 'bottom-full right-1 mb-2'
          )}
        >
          {/* Shared look: Theme is one row of words, system · light · dark. */}
          <div className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300">
            <ThemeIcon size={16} aria-hidden />
            <span className="flex-1">Theme</span>
            <span role="radiogroup" aria-label="Theme" className="flex gap-1.5 text-xs">
              {THEMES.map((t, i) => (
                <span key={t} className="flex gap-1.5">
                  {i > 0 && <span className="text-gray-600" aria-hidden>·</span>}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={theme === t}
                    onClick={() => themeStore.set(t)}
                    className={theme === t ? 'font-medium text-gray-100' : 'text-gray-500 hover:text-gray-100'}
                  >
                    {t}
                  </button>
                </span>
              ))}
            </span>
          </div>
          <BackgroundMusicSettings />
          <button type="button" className={row} disabled={exporting} onClick={() => void exportAll()}>
            <Download size={16} aria-hidden /> {exporting ? 'Exporting…' : 'Export data'}
          </button>
          <Link href="/guide" className={cn(row, "after:content-['›']")} onClick={() => setOpen(false)}>
            <BookOpen size={16} aria-hidden /> Guide
          </Link>
          <button
            type="button"
            className={row}
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut size={16} aria-hidden /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
