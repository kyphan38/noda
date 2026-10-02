'use client';

import { useEffect } from 'react';

import { registerServiceWorker } from '@/lib/sw';

/**
 * Dang ky service worker cho TOAN APP.
 *
 * Copy tu fina. Khong render gi. Dat o root layout de no chay ke ca tren
 * man hinh dang nhap.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    void registerServiceWorker();
  }, []);
  return null;
}
