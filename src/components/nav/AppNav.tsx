'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartLine, Headphones, MessageCircle } from 'lucide-react';

import { SettingsMenu } from '@/components/nav/SettingsMenu';
import { NAV_SPACES, navFocusStore, spaceForPath, type NavSpace } from '@/lib/nav';
import { cn } from '@/lib/utils';

const ICONS: Record<NavSpace, typeof Headphones> = { listen: Headphones, talk: MessageCircle, review: ChartLine };

function NavLinks({ active }: { active: NavSpace | null }) {
  return NAV_SPACES.map(({ id, label, href }) => {
    const Icon = ICONS[id];
    const on = active === id;
    return (
      <Link
        key={id}
        href={href}
        aria-current={on ? 'page' : undefined}
        className={cn(
          'flex flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] transition-colors',
          on ? 'text-white' : 'text-gray-500 hover:text-gray-100'
        )}
      >
        <span className={cn('rounded-full px-3 py-0.5', on && 'bg-gray-800')}>
          <Icon size={20} aria-hidden />
        </span>
        {label}
      </Link>
    );
  });
}

/** Desktop: a narrow rail on the left. Hidden on a phone. */
export function NavRail({ onLogout, joined = false }: { onLogout: () => void; joined?: boolean }) {
  const active = spaceForPath(usePathname());
  return (
    // Same surface as the sidebar; with the sidebar open the line between them goes, so both read as one panel.
    <nav
      aria-label="Main"
      className={cn(
        'relative z-[55] hidden w-14 shrink-0 flex-col justify-between border-r bg-gray-900 px-1 py-3 md:flex',
        joined ? 'border-transparent' : 'border-gray-800'
      )}
    >
      <div className="flex flex-col gap-1">
        <NavLinks active={active} />
      </div>
      <SettingsMenu placement="rail" onLogout={onLogout} />
    </nav>
  );
}

/** Phone: a tab bar at the bottom. Hidden on desktop and while a lesson or talk is open. */
export function NavBar({ onLogout, alwaysShow = false }: { onLogout: () => void; alwaysShow?: boolean }) {
  const active = spaceForPath(usePathname());
  const focused = useSyncExternalStore(navFocusStore.subscribe, navFocusStore.get, navFocusStore.getServer);
  if (focused && !alwaysShow) return null;
  return (
    <nav
      aria-label="Main"
      className="relative z-30 grid shrink-0 grid-cols-4 border-t border-gray-800 bg-gray-950 px-1 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <NavLinks active={active} />
      <SettingsMenu placement="bar" onLogout={onLogout} />
    </nav>
  );
}

/** Rail + content + bottom bar. The content scrolls on its own. */
export function AppShell({ onLogout, railJoined = false, children }: { onLogout: () => void; railJoined?: boolean; children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-gray-950 text-gray-100 md:flex-row">
      <NavRail onLogout={onLogout} joined={railJoined} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      <NavBar onLogout={onLogout} />
    </div>
  );
}
