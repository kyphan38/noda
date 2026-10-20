// Motion helpers with no React, so vitest can cover them.

/** Users who ask for less motion, and Node (tests, static export build), skip motion. */
export function reducedMotion(): boolean {
  return typeof matchMedia === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Close the drawer past a third of its width, or on a fast flick left. */
export function drawerShouldClose(dx: number, width: number, velocityPxPerMs: number): boolean {
  return dx < -width / 3 || velocityPxPerMs < -0.5;
}

/** Dragging right past the open position only moves a little. */
export function drawerOffset(dx: number): number {
  return dx <= 0 ? dx : dx * 0.2;
}
