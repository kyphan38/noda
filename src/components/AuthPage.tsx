'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { LoginView } from '@/components/auth/LoginView';
import { useAuthGate } from '@/hooks/useAuthGate';

/**
 * Shell for a page beside the main lesson screen: sign-in gate, title, a way back.
 * `wide` gives a computer screen room for two columns; phones are the same.
 */
export function AuthPage({ title, wide = false, children }: { title: string; wide?: boolean; children: ReactNode }) {
  const { isMounted, authState } = useAuthGate();
  if (!isMounted || authState === 'loading') return null;
  if (authState !== 'authenticated') return <LoginView appName="noda" subtitle="Listen, write, then speak." />;
  return (
    <main className="h-dvh overflow-y-auto">
      {/* The top padding clears the iPhone status bar when noda runs from the home screen. */}
      {/* Wide pages fill exactly the screen height, so a talk can keep its bar at the bottom without any extra scroll. */}
      <div className={`mx-auto w-full ${wide ? 'flex min-h-full max-w-xl flex-col gap-8 md:max-w-5xl' : 'max-w-xl space-y-8'} px-4 pt-[max(2.5rem,env(safe-area-inset-top))] ${wide ? 'pb-0' : 'pb-10 sm:pb-16'} sm:pt-16`}>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-100">{title}</h1>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-100">
            Back to noda
          </Link>
        </div>
        {wide ? <div className="flex flex-1 flex-col">{children}</div> : children}
      </div>
    </main>
  );
}
