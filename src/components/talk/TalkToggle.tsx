'use client';

/** A small on/off chip for Talk settings. */
export function TalkToggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1 ${on ? 'border-gray-500 bg-gray-800 text-gray-100' : 'border-gray-800 text-gray-400 hover:text-gray-100'}`}
    >
      {children}
    </button>
  );
}
