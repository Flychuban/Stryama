import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * Test endpoint for Sentry server-side error tracking
 * Visit: http://localhost:3000/api/test-sentry-server
 */
export async function GET() {
  try {
    // Test 1: Capture a simple error
    Sentry.captureException(new Error('Test server error from API route'));

    // Test 2: Capture with context
    Sentry.captureException(new Error('Test error with context'), {
      tags: { test: 'server-api' },
      extra: { timestamp: new Date().toISOString() },
    });

    // Test 3: Throw an actual error (will be caught by Sentry automatically)
    throw new Error('Test uncaught server error');
  } catch (error) {
    // Re-throw to let Next.js handle it (Sentry will capture it via instrumentation)
    throw error;
  }

  return NextResponse.json({ error: 'This should not be reached' });
}
