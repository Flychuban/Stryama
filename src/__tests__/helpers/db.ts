import type { PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import { vi } from 'vitest';

/**
 * Deep mock of Prisma Client for testing
 * This allows us to mock database interactions without a real database
 */
export const prismaMock =
  mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaClient>;

/**
 * Reset all Prisma mocks to initial state
 * Called after each test to ensure clean state
 */
export function resetDb() {
  mockReset(prismaMock);
}

/**
 * Mock the server/db module to return our mock Prisma client
 * This ensures all imports of `db` use the mock
 */
vi.mock('~/server/db', () => ({
  db: prismaMock,
}));
