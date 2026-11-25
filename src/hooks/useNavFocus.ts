'use client';

import { useEffect } from 'react';

import { navFocusStore } from '@/lib/nav';

/** While mounted (and active), hides the phone's bottom bar to give the screen more room. */
export function useNavFocus(active = true) {
  useEffect(() => (active ? navFocusStore.enter() : undefined), [active]);
}
