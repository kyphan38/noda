'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';

import { LoginView } from '@/components/auth/LoginView';
import { useAuthGate } from '@/hooks/useAuthGate';

/** Shell for a page beside the main lesson screen: sign-in gate, title, a way back. */
export function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  const { isMounted, authState } = useAuthGate();
  if (!isMounted || authState === 'loading') return null;
  if (authState !== 'authenticated') return <LoginView appName="noda" subtitle="Listen, write, then speak." />;
  return (
    <main className="min-h-screen overflow-y-auto">
      <div className="mx-auto w-full max-w-xl space-y-8 px-4 py-10 sm:py-16">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold text-gray-100">{title}</h1>
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-100">
            Back to noda
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}
