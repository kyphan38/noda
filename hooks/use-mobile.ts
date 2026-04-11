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
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const sync = () => {
      setState({ decided: true, isMobile: window.innerWidth < MOBILE_BREAKPOINT });
    };
    mql.addEventListener('change', sync);
    sync();
    return () => mql.removeEventListener('change', sync);
  }, []);

  return state;
}
