'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);

    // Capture error in Sentry
    Sentry.captureException(error, {
      tags: { errorBoundary: 'route-error' },
      contexts: { error: { digest: error.digest } },
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-destructive">Error</h1>
        <h2 className="mt-4 text-2xl font-semibold">Something went wrong!</h2>
        <p className="mt-2 text-muted-foreground">
          {error.message || 'An unexpected error occurred'}
        </p>
        <Button onClick={() => reset()} className="mt-6">
          Try again
        </Button>
      </div>
    </div>
  );
}
