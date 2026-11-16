import { useEffect, type RefObject } from 'react';

/**
 * Closes the header overflow menu on outside click; parent should reset open state when selection changes.
 */
export function useHeaderItemMenuClickOutside(
  menuOpen: boolean,
  setMenuOpen: (open: boolean) => void,
  headerMenuRef: RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (headerMenuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen, setMenuOpen, headerMenuRef]);
}
