'use client';

// 1. External libraries
import { type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

// 4. UI components
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// 6. Local components
import { ErrorBoundary } from './ErrorBoundary';

type AIErrorBoundaryProps = {
  children: ReactNode;
};

export function AIErrorBoundary({ children }: AIErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, resetError) => (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              AI Generation Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We encountered an error while generating your application. This
              could be due to:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Network connectivity issues</li>
              <li>Invalid or too complex prompt</li>
              <li>Temporary service interruption</li>
            </ul>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="font-mono text-xs text-destructive">
                {error.message}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={resetError}>Try Again</Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
