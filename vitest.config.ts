import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node', // Use 'jsdom' for React component tests
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/__tests__/**',
        'src/app/**', // Exclude Next.js app dir (test via E2E)
        'src/types/**',
        'src/env.js',
        'src/middleware.ts', // Clerk middleware (tested by Clerk)
        'src/components/**', // UI components (test via E2E later)
      ],
      thresholds: {
        // Phase 1: Critical services layer (modelSelection, usageTracking, rateLimiter, file-saver)
        // Current coverage: ~3.5% overall (but 95+ tests with 100% coverage on critical services)
        // Setting conservative thresholds to prevent regressions
        // Phase 2 will add router tests to reach 20-30%
        lines: 3,
        functions: 4,
        branches: 3,
        statements: 3,
      },
    },
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
    },
  },
});
