import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export type MobileViewportState = {
  /** False until client has measured viewport (avoid desktop flash on phone). */
  decided: boolean;
  /** True when width is under the desktop breakpoint. */
  isMobile: boolean;
};

/**
 * Single client-side measurement for desktop-only gate + listeners on resize.
 */
export function useMobileViewport(): MobileViewportState {
  const [state, setState] = React.useState<MobileViewportState>({
    decided: false,
    isMobile: false,
  });

  React.useEffect(() => {
    // Read the media query, not innerWidth: an iOS home-screen app can report a desktop
    // innerWidth on launch, and the query may never fire 'change' to correct it.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const sync = () => {
      const isMobile = mql.matches;
      setState((prev) => (prev.decided && prev.isMobile === isMobile ? prev : { decided: true, isMobile }));
    };
    mql.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    sync();
    return () => {
      mql.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);

  return state;
}

/**
 * True on touch-first devices (phones, iPads), whatever their width. `useMobileViewport`
 * goes by width, so an iPad (>= 768px) counts as desktop there - but it still has no
 * Enter key outside a text field, so touch-only controls key off this instead.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)');
    const sync = () => setCoarse(mql.matches);
    mql.addEventListener('change', sync);
    sync();
    return () => mql.removeEventListener('change', sync);
  }, []);

  return coarse;
}
