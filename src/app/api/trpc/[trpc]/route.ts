import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest, NextResponse } from 'next/server';

import { env } from '~/env';
import { applyCorsHeaders, handleCorsPreflightRequest } from '~/lib/cors';
import { appRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers,
  });
};

const handler = async (req: NextRequest) => {
  const origin = req.headers.get('origin');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // Handle tRPC request
  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError:
      env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`
            );
          }
        : undefined,
  });

  // Apply CORS headers to response
  const nextResponse = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  return applyCorsHeaders(nextResponse, origin);
};

export { handler as GET, handler as POST, handler as OPTIONS };
