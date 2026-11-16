'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';

import { getFirebaseAuth } from '@/lib/auth/firebase-client';
import { hasAllowlistConfig, isAllowedUser } from '@/lib/auth/allowed-user';

export type AuthState = 'loading' | 'authenticated' | 'unauthorized';

/**
 * Who may use the app: signed in and on the allowlist (when one is set).
 * E2E mode (dev only) skips sign-in. `isMounted` is false until the first effect.
 */
export function useAuthGate() {
  const [isMounted, setIsMounted] = useState(false);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const isE2EMode =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_E2E_MODE === 'true';

  useEffect(() => {
    setIsMounted(true);

    if (isE2EMode) {
      setAuthState('authenticated');
      return;
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!hasAllowlistConfig()) {
        setAuthState(user ? 'authenticated' : 'unauthorized');
        return;
      }
      if (!user) {
        setAuthState('unauthorized');
        return;
      }
      if (isAllowedUser(user)) {
        setAuthState('authenticated');
        return;
      }
      await signOut(auth);
      setAuthState('unauthorized');
    });
    return () => unsub();
  }, [isE2EMode]);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setAuthState('unauthorized');
  }, []);

  return { isMounted, authState, isE2EMode, logout };
}
