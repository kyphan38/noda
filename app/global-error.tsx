'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[noda] root error:', error.message, error.digest ?? '');
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-950 p-6 text-gray-100 antialiased">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex')}>
            Home
          </Link>
        </div>
      </body>
    </html>
  );
}
