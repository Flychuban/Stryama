import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { resetDb } from './helpers/db';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CLERK_SECRET_KEY = 'sk_test_mock123';
process.env.ANTHROPIC_API_KEY = 'sk-ant-mock123';
process.env.E2B_API_KEY = 'e2b_mock123';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock123';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Reset mocks after each test
afterEach(() => {
  resetDb();
  vi.clearAllMocks();
});

// Suppress console errors in tests (optional - makes test output cleaner)
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterAll(() => {
  vi.restoreAllMocks();
});
