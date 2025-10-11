import { type NextRequest, NextResponse } from 'next/server';
import { env } from '~/env';

/**
 * CORS configuration for API routes
 * Restricts origins based on environment
 */
export const corsConfig = {
  allowedOrigins:
    env.NODE_ENV === 'production'
      ? [env.NEXT_PUBLIC_APP_URL] // Only allow production domain in production
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3000',
          env.NEXT_PUBLIC_APP_URL,
        ], // Allow local dev origins in development

  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // 24 hours
  credentials: true,
};

/**
 * Apply CORS headers to a response
 */
export function applyCorsHeaders(
  response: NextResponse,
  origin: string | null
): NextResponse {
  // Check if origin is allowed
  const isAllowedOrigin = origin
    ? corsConfig.allowedOrigins.some((allowed) => {
        if (allowed.includes('*')) {
          // Support wildcard patterns
          const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
          return pattern.test(origin);
        }
        return allowed === origin;
      })
    : false;

  if (isAllowedOrigin && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }

  response.headers.set(
    'Access-Control-Allow-Methods',
    corsConfig.allowedMethods.join(', ')
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    corsConfig.allowedHeaders.join(', ')
  );
  response.headers.set(
    'Access-Control-Expose-Headers',
    corsConfig.exposedHeaders.join(', ')
  );
  response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());

  if (corsConfig.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreflightRequest(req: NextRequest): NextResponse {
  const origin = req.headers.get('origin');
  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(response, origin);
}

/**
 * Wrap an API handler with CORS support
 */
export function withCors(
  handler: (req: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const origin = req.headers.get('origin');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return handleCorsPreflightRequest(req);
    }

    // Execute the actual handler
    const response = await handler(req);

    // Apply CORS headers to the response
    return applyCorsHeaders(response, origin);
  };
}
