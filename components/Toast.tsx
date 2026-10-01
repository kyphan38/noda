'use client';

import React, { useEffect } from 'react';
import { Check, Info, X } from 'lucide-react';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  /** Optional button, e.g. Undo. Clicking it also closes the toast. */
  action?: ToastAction;
  durationMs?: number;
}

export function Toast({ message, type, onClose, action, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, durationMs);
    return () => clearTimeout(timer);
  }, [onClose, durationMs]);

  return (
    <div className={`toast toast-${type}`} role="status">
      <span className="toast-icon" aria-hidden>
        {type === 'success' && <Check size={16} />}
        {type === 'error' && <X size={16} />}
        {type === 'info' && <Info size={16} />}
      </span>
      <span className="toast-message flex-1 text-sm font-medium">{message}</span>
      {action && (
        <button
          type="button"
          className="toast-action shrink-0 rounded-md px-2 py-1 text-sm font-semibold underline-offset-2 hover:underline"
          onClick={() => {
            action.onClick();
            onClose();
          }}
        >
          {action.label}
        </button>
      )}
      <button type="button" className="toast-close opacity-80 hover:opacity-100 p-1" onClick={onClose} aria-label="Close">
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
