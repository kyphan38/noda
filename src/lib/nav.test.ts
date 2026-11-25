import { describe, expect, it, vi } from 'vitest';

import { navFocusStore, reviewTabFromSearch, spaceForPath } from './nav';

describe('spaceForPath', () => {
  it('maps paths to spaces', () => {
    expect(spaceForPath('/')).toBe('listen');
    expect(spaceForPath('')).toBe('listen');
    expect(spaceForPath(null)).toBe('listen');
    expect(spaceForPath('/talk/')).toBe('talk');
    expect(spaceForPath('/talk')).toBe('talk');
    expect(spaceForPath('/review/')).toBe('review');
  });

  it('keeps old review pages in Review', () => {
    expect(spaceForPath('/mistakes/')).toBe('review');
    expect(spaceForPath('/speaking')).toBe('review');
  });

  it('returns null for other pages', () => {
    expect(spaceForPath('/guide/')).toBeNull();
  });
});

describe('reviewTabFromSearch', () => {
  it('reads a known tab', () => {
    expect(reviewTabFromSearch('?tab=speaking')).toBe('speaking');
  });
  it('ignores unknown or missing tabs', () => {
    expect(reviewTabFromSearch('?tab=nope')).toBeNull();
    expect(reviewTabFromSearch('')).toBeNull();
  });
});

describe('navFocusStore', () => {
  it('stays focused until every screen leaves', () => {
    const fn = vi.fn();
    const off = navFocusStore.subscribe(fn);
    expect(navFocusStore.get()).toBe(false);
    const a = navFocusStore.enter();
    const b = navFocusStore.enter();
    a();
    expect(navFocusStore.get()).toBe(true);
    b();
    b();
    expect(navFocusStore.get()).toBe(false);
    expect(fn).toHaveBeenCalledTimes(4);
    off();
  });
});
