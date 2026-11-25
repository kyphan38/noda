'use client';

import type { ReactNode } from 'react';

import { LoginView } from '@/components/auth/LoginView';
import { AppShell } from '@/components/nav/AppNav';
import { useAuthGate } from '@/hooks/useAuthGate';

/**
 * Shell for a page beside the main lesson screen: sign-in gate, title, and the app's nav.
 * `wide` gives a computer screen room for two columns; phones are the same.
 */
export function AuthPage({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  const { isMounted, authState, logout } = useAuthGate();
  if (!isMounted || authState === 'loading') return null;
  if (authState !== 'authenticated') return <LoginView appName="noda" subtitle="Listen, write, then speak." />;
  return (
    <AppShell onLogout={() => void logout()}>
      <main className="min-h-0 flex-1 overflow-y-auto">
        {/* The top padding clears the iPhone status bar when noda runs from the home screen. */}
        {/* Wide pages fill exactly the screen height, so a talk can keep its bar at the bottom without any extra scroll. */}
        {/* Every page title sits in the same 36rem column at the same height (see WelcomeScreen). */}
        <div className={`mx-auto w-full ${wide ? 'flex min-h-full max-w-[38rem] flex-col gap-8 md:max-w-5xl' : 'max-w-[38rem] space-y-8'} px-4 pt-[max(2.5rem,env(safe-area-inset-top))] ${wide ? 'pb-0' : 'pb-10 sm:pb-16'} sm:pt-16`}>
          <h1 className={`text-2xl font-semibold text-gray-100 ${wide ? 'mx-auto w-full max-w-xl' : ''}`}>{title}</h1>
          {wide ? <div className="flex flex-1 flex-col">{children}</div> : children}
        </div>
      </main>
    </AppShell>
  );
}
