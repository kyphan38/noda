'use client';

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { reducedMotion } from '@/lib/motion';

/** Matches `.app-modal-panel.is-leaving` / `.app-modal-backdrop.is-leaving` in globals.css. */
const EXIT_MS = 200;

/**
 * Backdrop + centered panel shared by every modal. Closing by the backdrop or
 * Esc plays the exit animation first, then calls `onClose`. Buttons inside
 * call their own handlers and the modal goes at once: the toast that follows
 * is the feedback, so nobody waits on an animation.
 */
export function ModalShell({
  onClose,
  labelledBy,
  backdropClassName,
  panelClassName,
  closeOnBackdrop = true,
  portal = false,
  children,
}: {
  onClose: () => void;
  labelledBy?: string;
  /** z-index, tint, padding, blur of the backdrop. */
  backdropClassName: string;
  /** Background, border, padding, width of the panel. */
  panelClassName: string;
  /** Off for a form where a stray click outside would lose typed work. */
  closeOnBackdrop?: boolean;
  /** Render into `document.body`. Only for callers that render after mount. */
  portal?: boolean;
  children: ReactNode;
}) {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestClose = useRef(onClose);

  useEffect(() => {
    latestClose.current = onClose;
  }, [onClose]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const close = useCallback(() => {
    if (leaving) return;
    if (reducedMotion()) {
      latestClose.current();
      return;
    }
    setLeaving(true);
    timer.current = setTimeout(() => latestClose.current(), EXIT_MS);
  }, [leaving]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const content = (
    <div
      role="presentation"
      className={[
        'app-modal-backdrop fixed inset-0 flex items-center justify-center',
        backdropClassName,
        leaving ? 'is-leaving pointer-events-none' : '',
      ].join(' ')}
      onMouseDown={
        closeOnBackdrop
          ? (e) => {
              if (e.target === e.currentTarget) close();
            }
          : undefined
      }
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={['app-modal-panel', panelClassName, leaving ? 'is-leaving' : ''].join(' ')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return portal ? createPortal(content, document.body) : content;
}
