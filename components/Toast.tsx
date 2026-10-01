'use client';

import React, { useEffect } from 'react';
import { Check, Info, X } from 'lucide-react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`toast toast-${type}`} role="status">
      <span className="toast-icon" aria-hidden>
        {type === 'success' && <Check size={16} />}
        {type === 'error' && <X size={16} />}
        {type === 'info' && <Info size={16} />}
      </span>
      <span className="toast-message flex-1 text-sm font-medium">{message}</span>
      <button type="button" className="toast-close opacity-80 hover:opacity-100 p-1" onClick={onClose} aria-label="Close">
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
