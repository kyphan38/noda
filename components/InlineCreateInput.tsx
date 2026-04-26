'use client';

import React, { useEffect, useRef, useState } from 'react';

export function InlineCreateInput({
  placeholder,
  autoFocus = true,
  onCommit,
  onCancel,
  className,
}: {
  placeholder: string;
  autoFocus?: boolean;
  onCommit: (value: string) => void | Promise<void>;
  onCancel: () => void;
  className?: string;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [autoFocus]);

  const commit = () => {
    const v = value.trim();
    if (!v) return;
    void onCommit(v);
    onCancel();
  };

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-950 border border-gray-700 text-gray-100 text-xs rounded px-2 py-1 outline-none focus:border-emerald-500/60 placeholder:text-gray-600"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={onCancel}
      />
    </form>
  );
}

