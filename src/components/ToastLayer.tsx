'use client';

import React, { useState } from 'react';

import { usePresence } from '@/hooks/usePresence';
import { Toast, type ToastAction } from './Toast';

/** Matches `.toast.is-leaving` in globals.css. */
const EXIT_MS = 200;

export interface ToastData {
  message: string;
  type: 'success' | 'error' | 'info';
  action?: ToastAction;
  durationMs?: number;
}

/**
 * Renders the current toast and keeps the last one a moment after it closes,
 * so it can slide out instead of vanishing.
 */
export function ToastLayer({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  // Derived during render, so the leaving toast never blinks out for a frame.
  const [last, setLast] = useState<ToastData | null>(toast);
  if (toast && toast !== last) setLast(toast);

  const { mounted, leaving } = usePresence(toast !== null, EXIT_MS);
  const shown = toast ?? last;
  if (!mounted || !shown) return null;

  return (
    <Toast
      // A new message is a new toast: its own entry animation and timer.
      key={`${shown.type}:${shown.message}`}
      message={shown.message}
      type={shown.type}
      action={shown.action}
      durationMs={shown.durationMs}
      leaving={leaving}
      onClose={onClose}
    />
  );
}
