'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[noda] route error:', error.message, error.digest ?? '');
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 bg-gray-950 px-4 py-16 text-gray-100">
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
    </div>
  );
}
