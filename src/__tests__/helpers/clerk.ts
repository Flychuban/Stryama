import { vi } from 'vitest';

/**
 * Default mock Clerk user for testing
 */
export const mockClerkUser = {
  userId: 'user_test123',
  sessionId: 'sess_test123',
  orgId: null,
  sessionClaims: {},
};

/**
 * Mock the Clerk auth() function with custom overrides
 * @param overrides - Partial user object to override defaults
 */
export function mockAuth(overrides: Partial<typeof mockClerkUser> = {}) {
  const authData = { ...mockClerkUser, ...overrides };

  vi.mock('@clerk/nextjs/server', async () => {
    const actual = await vi.importActual('@clerk/nextjs/server');
    return {
      ...actual,
      auth: vi.fn(() => Promise.resolve(authData)),
      currentUser: vi.fn(() =>
        Promise.resolve({
          id: authData.userId,
          publicMetadata: { plan: 'FREE' },
          firstName: 'Test',
          lastName: 'User',
          emailAddresses: [{ emailAddress: 'test@example.com' }],
        })
      ),
    };
  });

  return authData;
}

/**
 * Mock unauthenticated state (no user logged in)
 */
export function mockUnauthenticated() {
  vi.mock('@clerk/nextjs/server', async () => {
    const actual = await vi.importActual('@clerk/nextjs/server');
    return {
      ...actual,
      auth: vi.fn(() => Promise.resolve({ userId: null })),
      currentUser: vi.fn(() => Promise.resolve(null)),
    };
  });
}

/**
 * Create mock Clerk user with specific plan
 * @param plan - User plan tier (FREE, BUILDER, PRO)
 */
export function mockClerkUserWithPlan(plan: 'FREE' | 'BUILDER' | 'PRO') {
  return mockAuth({
    userId: `user_${plan.toLowerCase()}_123`,
  });
}
