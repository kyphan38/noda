// Motion helpers with no React, so vitest can cover them.

/** Users who ask for less motion, and Node (tests, static export build), skip motion. */
export function reducedMotion(): boolean {
  return typeof matchMedia === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}
