'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('Global error:', error);

    // Capture error in Sentry
    Sentry.captureException(error, {
      tags: { errorBoundary: 'global-error' },
      contexts: { error: { digest: error.digest } },
    });
  }, [error]);

  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(to bottom right, #f3f4f6, #e5e7eb)',
            padding: '2rem',
            fontFamily:
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              maxWidth: '600px',
              background: 'white',
              padding: '3rem 2rem',
              borderRadius: '1rem',
              boxShadow:
                '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Error Icon - Using SVG directly to avoid client-side imports */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: '#fee2e2',
                marginBottom: '1.5rem',
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            {/* Error Title */}
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: '700',
                color: '#111827',
                marginBottom: '1rem',
              }}
            >
              Critical Error
            </h1>

            {/* Error Message */}
            <p
              style={{
                fontSize: '1.125rem',
                color: '#4b5563',
                marginBottom: '0.5rem',
              }}
            >
              {isDevelopment
                ? error.message || 'An unexpected error occurred'
                : 'Something went wrong. Our team has been notified.'}
            </p>

            {/* Error Digest (for support) */}
            {error.digest && (
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#9ca3af',
                  marginBottom: '2rem',
                }}
              >
                Error ID: {error.digest}
              </p>
            )}

            {/* Try Again Button */}
            <button
              onClick={() => reset()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                fontWeight: '500',
                color: 'white',
                background: '#3b82f6',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                marginTop: '1rem',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#2563eb';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#3b82f6';
              }}
            >
              Try Again
            </button>

            {/* Additional Help Text */}
            <p
              style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginTop: '2rem',
              }}
            >
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
