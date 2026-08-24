'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ShadowingConfirmPopoverProps {
  onConfirm: () => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

function usePopoverPosition(triggerRef: React.RefObject<HTMLButtonElement | null>, isOpen: boolean) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({
        top: rect.top - 6,
        left: rect.left + rect.width / 2,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, triggerRef]);

  return pos;
}

/**
 * Confirm-before-generate popover (cost guard). Anchored to the specific row's sparkle
 * button that triggered it. Only mounts when `confirmingSentenceId === sentence.id`
 * (see TranscriptSentence), so each row renders its own but a local, ephemeral one.
 */
export function ShadowingConfirmPopover({ onConfirm, onClose, triggerRef }: ShadowingConfirmPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const pos = usePopoverPosition(triggerRef, true);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose, triggerRef]);

  if (!pos) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translate(-50%, -100%)',
      }}
      className="z-[9999] flex flex-col gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 shadow-lg max-w-[220px]"
    >
      <p className="text-xs text-gray-300">Câu này chưa được AI phân tích. Gọi AI phân tích chứ?</p>
      <div className="flex justify-end gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="px-2 py-1 text-xs rounded-md bg-gray-800 text-gray-400 hover:text-white"
        >
          Hủy
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onConfirm();
          }}
          className="px-2 py-1 text-xs rounded-md bg-emerald-500/90 text-gray-900 font-medium hover:bg-emerald-400"
        >
          Phân tích
        </button>
      </div>
    </div>,
    document.body
  );
}
