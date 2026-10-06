'use client';

import { useEffect } from 'react';

import { registerServiceWorker } from '@/lib/sw';

/**
 * Registers the service worker for the whole app.
 *
 * Copied from fina. Renders nothing. Lives in the root layout so it runs on
 * the sign-in screen too.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
