'use client';

export function MobileUnsupported() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-gray-100 px-8 text-center">
      <p className="text-2xl font-semibold tracking-tight text-white mb-3">Noda.</p>
      <p className="text-base text-gray-400 max-w-sm leading-relaxed">
        This app does not work on phones. Please open Noda on a computer or tablet (larger screen).
      </p>
    </div>
  );
}
