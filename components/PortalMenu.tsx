'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function PortalMenu({
  menuId,
  open,
  anchorRef,
  onClose,
  widthClassName = 'w-40',
  children,
}: {
  menuId: string;
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  widthClassName?: string;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      const panel = document.getElementById(menuId);
      if (panel?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, anchorRef, menuId, onClose]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      id={menuId}
      role="menu"
      className={`fixed ${widthClassName} bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[210] py-1 overflow-hidden`}
      style={{ top: pos.top, right: pos.right }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

