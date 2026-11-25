'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Static export has no server redirects, so old pages forward on the client. */
export function RedirectTo({ href }: { href: string }) {
  const router = useRouter();
  useEffect(() => router.replace(href), [router, href]);
  return null;
}
