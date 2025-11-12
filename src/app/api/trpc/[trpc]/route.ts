import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest } from 'next/server';

import { appRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';

/**
 * Route configuration for Vercel deployment
 *
 * - runtime: 'nodejs' - Use Node.js runtime (required for Claude Agent SDK CLI execution)
 * - maxDuration: 300 - Maximum execution time in seconds (5 minutes for Pro plan)
 *
 * This timeout allows for long-running AI generation and streaming processes.
 * The Claude Agent SDK spawns a CLI process that requires the Node.js runtime.
 */
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes (requires Vercel Pro plan)

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
  return createTRPCContext({
    headers: req.headers,
  });
};

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`
            );
          }
        : undefined,
  });

export { handler as GET, handler as POST };
