import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';
import { prismaMock } from './db';
import { mockClerkUser } from './clerk';
import type { AppRouter } from '~/server/api/root';

/**
 * Type helpers for tRPC router
 */
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

/**
 * Create a mock tRPC context for testing
 * This simulates the context that would be passed to tRPC procedures
 */
export function createMockTRPCContext(
  overrides: Partial<{
    userId: string | null;
    sessionId: string | null;
    headers: Headers;
  }> = {}
) {
  return {
    db: prismaMock,
    auth: {
      userId: overrides.userId ?? mockClerkUser.userId,
      sessionId: overrides.sessionId ?? mockClerkUser.sessionId,
      orgId: null,
      sessionClaims: {},
    },
    headers: overrides.headers ?? new Headers(),
  };
}

/**
 * Create a tRPC caller for testing
 * This allows you to call tRPC procedures directly without HTTP
 *
 * @example
 * const caller = createTestCaller(createMockTRPCContext());
 * const result = await caller.ai.initializeGeneration({ prompt: 'test' });
 */
export function createTestCaller(ctx = createMockTRPCContext()) {
  // Import appRouter dynamically to avoid circular dependencies
  // In actual tests, you'll import this from the router file
  // For now, this is a placeholder structure
  return {
    ctx,
    // Actual implementation will use createCallerFactory from tRPC
  };
}

/**
 * Mock tRPC context for authenticated user
 */
export const mockAuthenticatedContext = createMockTRPCContext({
  userId: 'user_test123',
});

/**
 * Mock tRPC context for unauthenticated user
 */
export const mockUnauthenticatedContext = createMockTRPCContext({
  userId: null,
  sessionId: null,
});
