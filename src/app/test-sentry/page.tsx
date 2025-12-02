'use client';

import { useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Sentry Test Dashboard
 * Visit: http://localhost:3000/test-sentry
 *
 * This page provides various tests to verify Sentry integration
 */
export default function SentryTestPage() {
  const [results, setResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setResults((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  // Test 1: Client-side error
  const testClientError = () => {
    try {
      addResult('Testing client-side error...');
      Sentry.captureException(new Error('Test client-side error'));
      addResult('✅ Client error sent to Sentry (check console in dev mode)');
    } catch (error) {
      addResult(`❌ Failed: ${String(error)}`);
    }
  };

  // Test 2: Client error with context
  const testClientErrorWithContext = () => {
    try {
      addResult('Testing client error with context...');
      Sentry.captureException(new Error('Test error with user context'), {
        tags: { test: 'client-context', page: 'test-sentry' },
        extra: { timestamp: new Date().toISOString() },
        level: 'warning',
      });
      addResult('✅ Client error with context sent to Sentry');
    } catch (error) {
      addResult(`❌ Failed: ${String(error)}`);
    }
  };

  // Test 3: Uncaught client error (will be caught by error boundary)
  const testUncaughtError = () => {
    addResult('Testing uncaught error (will trigger error boundary)...');
    throw new Error('Test uncaught client error');
  };

  // Test 4: Server API error
  const testServerError = async () => {
    try {
      addResult('Testing server API error...');
      await fetch('/api/test-sentry-server');
      addResult('Request sent (check Network tab)');
    } catch (error) {
      addResult(`Server error triggered: ${String(error)}`);
    }
  };

  // Test 5: tRPC error
  const testTRPCError = () => {
    addResult('Testing tRPC error...');
    // This will fail with UNAUTHORIZED if not signed in
    // which should be captured by Sentry tRPC middleware
  };

  // Test 6: User identification
  const testUserIdentification = () => {
    const user = Sentry.getCurrentScope().getUser();
    if (user) {
      addResult(`✅ User identified: ${user.id} (${user.email ?? 'no email'})`);
    } else {
      addResult('⚠️ No user identified (you may not be signed in)');
    }
  };

  // Test 7: Performance transaction
  const testPerformance = () => {
    addResult('Testing performance monitoring...');
    const transaction = Sentry.startSpan(
      {
        name: 'test-transaction',
        op: 'test',
      },
      () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000000; i++) {
          sum += i;
        }
        return sum;
      }
    );
    addResult(`✅ Performance transaction completed: ${transaction}`);
  };

  // Test 8: Message (non-error event)
  const testMessage = () => {
    addResult('Testing message event...');
    Sentry.captureMessage('Test message from Sentry test page', 'info');
    addResult('✅ Message sent to Sentry');
  };

  return (
    <div className="container mx-auto max-w-4xl p-8">
      <h1 className="mb-8 text-4xl font-bold">
        Sentry Integration Test Dashboard
      </h1>

      <div className="mb-8 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Development Mode:</strong> Sentry events are logged to console
          but not sent to Sentry.io.
          <br />
          Look for <code>[Sentry] Would send:</code> messages in the browser
          console.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Test 1 */}
        <Card>
          <CardHeader>
            <CardTitle>1. Client-Side Error</CardTitle>
            <CardDescription>Test basic client error capture</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={testClientError} className="w-full">
              Test Client Error
            </Button>
          </CardContent>
        </Card>

        {/* Test 2 */}
        <Card>
          <CardHeader>
            <CardTitle>2. Error with Context</CardTitle>
            <CardDescription>
              Test error with tags and extra data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={testClientErrorWithContext} className="w-full">
              Test Error with Context
            </Button>
          </CardContent>
        </Card>

        {/* Test 3 */}
        <Card>
          <CardHeader>
            <CardTitle>3. Uncaught Error</CardTitle>
            <CardDescription>
              Triggers error boundary (will crash page)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testUncaughtError}
              variant="destructive"
              className="w-full"
            >
              Test Uncaught Error
            </Button>
          </CardContent>
        </Card>

        {/* Test 4 */}
        <Card>
          <CardHeader>
            <CardTitle>4. Server API Error</CardTitle>
            <CardDescription>Test server-side error tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={testServerError} className="w-full">
              Test Server Error
            </Button>
          </CardContent>
        </Card>

        {/* Test 5 */}
        <Card>
          <CardHeader>
            <CardTitle>5. tRPC Error</CardTitle>
            <CardDescription>
              Test tRPC middleware error tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={testTRPCError} className="w-full">
              Test tRPC Error
            </Button>
          </CardContent>
        </Card>

        {/* Test 6 */}
        <Card>
          <CardHeader>
            <CardTitle>6. User Identification</CardTitle>
            <CardDescription>Check if user context is set</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testUserIdentification}
              variant="outline"
              className="w-full"
            >
              Check User Context
            </Button>
          </CardContent>
        </Card>

        {/* Test 7 */}
        <Card>
          <CardHeader>
            <CardTitle>7. Performance Monitoring</CardTitle>
            <CardDescription>Test custom performance span</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={testPerformance}
              variant="outline"
              className="w-full"
            >
              Test Performance
            </Button>
          </CardContent>
        </Card>

        {/* Test 8 */}
        <Card>
          <CardHeader>
            <CardTitle>8. Message Event</CardTitle>
            <CardDescription>Test non-error message capture</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={testMessage} variant="outline" className="w-full">
              Test Message
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results Console */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>Console output from tests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-slate-900 p-4 font-mono text-sm text-slate-100">
            {results.length === 0 ? (
              <p className="text-slate-400">
                No tests run yet. Click buttons above to test.
              </p>
            ) : (
              results.map((result, index) => (
                <div key={index} className="mb-1">
                  {result}
                </div>
              ))
            )}
          </div>
          {results.length > 0 && (
            <Button
              onClick={() => setResults([])}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              Clear Results
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How to Verify</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="mb-2 font-semibold">In Development Mode:</h3>
            <ol className="ml-4 list-decimal space-y-1 text-sm">
              <li>Open browser DevTools Console (F12)</li>
              <li>Click test buttons above</li>
              <li>
                Look for{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                  [Sentry] Would send:
                </code>{' '}
                messages
              </li>
              <li>Verify event details in console logs</li>
            </ol>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">In Production Mode:</h3>
            <ol className="ml-4 list-decimal space-y-1 text-sm">
              <li>
                Build and start:{' '}
                <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                  pnpm build && pnpm start
                </code>
              </li>
              <li>Visit this page and click test buttons</li>
              <li>
                Go to{' '}
                <a
                  href="https://sentry.io"
                  target="_blank"
                  className="text-blue-600 underline"
                >
                  sentry.io
                </a>
              </li>
              <li>Navigate to your project → Issues</li>
              <li>Verify errors appear with correct context</li>
            </ol>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">What to Check:</h3>
            <ul className="ml-4 list-disc space-y-1 text-sm">
              <li>✅ Stack traces are unminified (source maps working)</li>
              <li>✅ User context is attached (if signed in)</li>
              <li>✅ Tags and extra data are present</li>
              <li>✅ Server errors appear separately from client errors</li>
              <li>✅ Performance transactions show up in Performance tab</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
