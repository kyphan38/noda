'use client';

import { useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

import { drawerOffset, drawerShouldClose, reducedMotion } from '@/lib/motion';

const LOCK_PX = 8;
const OUT_MS = 180;
const BACK_MS = 200;

type Drag = {
  id: number;
  x: number;
  y: number;
  lastX: number;
  lastT: number;
  v: number;
  dx: number;
  axis: 'x' | 'y' | null;
};

/**
 * Swipe a left-edge drawer closed with a finger. The drawer follows the
 * finger and the dim layer fades with it. Writes styles through refs, so no
 * render per move. Touch and pen only: a mouse would fight the folder
 * drag and drop, and has the close button and the dim layer anyway.
 *
 * `translate` (not `transform`) is the property the drawer's open and closed
 * classes use, so the inline value hands over to the class with no jump.
 */
export function useDrawerSwipe({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const dim = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
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

  const follow = useCallback((offset: number, width: number, transition: string) => {
    const p = panel.current;
    const d = dim.current;
    if (p) {
      p.style.transition = transition;
      p.style.translate = offset === 0 ? '' : `${offset}px`;
    }
    if (d) {
      d.style.transition = transition.replace('translate', 'opacity');
      d.style.opacity = offset >= 0 ? '' : String(Math.max(0, 1 + offset / width));
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || e.pointerType === 'mouse' || !e.isPrimary) return;
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      drag.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastT: e.timeStamp,
        v: 0,
        dx: 0,
        axis: null,
      };
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (d.axis === null) {
        if (Math.hypot(dx, dy) < LOCK_PX) return;
        // Mostly vertical: it is a scroll of the lesson list, not ours.
        if (Math.abs(dy) >= Math.abs(dx)) {
          drag.current = null;
          return;
        }
        d.axis = 'x';
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }
      const dt = e.timeStamp - d.lastT;
      if (dt > 0) d.v = (e.clientX - d.lastX) / dt;
      d.lastX = e.clientX;
      d.lastT = e.timeStamp;
      d.dx = dx;
      follow(drawerOffset(dx), panel.current?.offsetWidth ?? 1, 'none');
    },
    [follow],
  );

  const onPointerEnd = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      drag.current = null;
      if (d.axis !== 'x') return;
      const width = panel.current?.offsetWidth ?? 1;
      const done = e.type === 'pointerup' && drawerShouldClose(d.dx, width, d.v);

      if (!done) {
        follow(0, width, `translate ${BACK_MS}ms var(--ease-soft)`);
        timer.current = setTimeout(() => {
          if (panel.current) panel.current.style.transition = '';
          if (dim.current) dim.current.style.transition = '';
        }, BACK_MS + 20);
        return;
      }
      if (reducedMotion()) {
        latestClose.current();
        follow(0, width, '');
        return;
      }
      // Slide the rest of the way out from where the finger let go.
      follow(-width, width, `translate ${OUT_MS}ms ease-in`);
      timer.current = setTimeout(() => {
        // Close first, then drop the inline styles: the class now holds the
        // same closed position, so nothing flashes back open.
        flushSync(() => latestClose.current());
        if (panel.current) {
          panel.current.style.transition = '';
          panel.current.style.translate = '';
        }
        if (dim.current) {
          dim.current.style.transition = '';
          dim.current.style.opacity = '';
        }
      }, OUT_MS);
    },
    [follow],
  );

  return {
    panel,
    dim,
    panelProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      // Horizontal moves reach us; vertical ones scroll the list.
      style: enabled ? ({ touchAction: 'pan-y' } as const) : undefined,
    },
  };
}
