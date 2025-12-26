import { vi } from 'vitest';

/**
 * Mock E2B Sandbox for testing
 */

/**
 * Mock sandbox instance with common methods
 */
export const mockSandbox = {
  id: 'sandbox_test123',
  getInfo: vi.fn(() =>
    Promise.resolve({
      templateId: 'base',
      alias: 'test-sandbox',
    })
  ),
  filesystem: {
    read: vi.fn((_path: string) =>
      Promise.resolve({
        content: `// Mock file content`,
      })
    ),
    write: vi.fn((_path: string, _content: string) => Promise.resolve()),
    list: vi.fn((_path: string) =>
      Promise.resolve([
        { name: 'src', isDir: true },
        { name: 'package.json', isDir: false },
      ])
    ),
  },
  commands: {
    run: vi.fn((_command: string) =>
      Promise.resolve({
        stdout: 'Command executed successfully',
        stderr: '',
        exitCode: 0,
      })
    ),
  },
  close: vi.fn(() => Promise.resolve()),
  setTimeout: vi.fn(),
};

/**
 * Mock E2B Sandbox creation
 */
export function mockE2BSandbox(overrides: Partial<typeof mockSandbox> = {}) {
  const sandbox = { ...mockSandbox, ...overrides };

  vi.mock('@e2b/code-interpreter', () => ({
    Sandbox: vi.fn(() => Promise.resolve(sandbox)),
    CodeInterpreter: vi.fn(() => Promise.resolve(sandbox)),
  }));

  return sandbox;
}

/**
 * Mock E2B error scenarios
 */
export function mockE2BError(errorMessage = 'Failed to create sandbox') {
  vi.mock('@e2b/code-interpreter', () => ({
    Sandbox: vi.fn(() => Promise.reject(new Error(errorMessage))),
  }));
}

/**
 * Mock file structure returned by E2B
 */
export const mockE2BFileStructure = [
  {
    path: 'src/App.tsx',
    content:
      'import React from "react";\n\nexport default function App() {\n  return <div>Hello</div>;\n}',
    language: 'typescript',
  },
  {
    path: 'src/index.css',
    content: 'body { margin: 0; padding: 0; }',
    language: 'css',
  },
  {
    path: 'index.html',
    content:
      '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
    language: 'html',
  },
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'test-app',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    }),
    language: 'json',
  },
];

/**
 * Mock infrastructure files that should be filtered out
 */
export const mockInfrastructureFiles = [
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'tsconfig.json',
  'components.json',
  'src/lib/utils.ts',
];

/**
 * Mock preview URL response
 */
export const mockPreviewUrl = 'https://sandbox-test123.e2b.dev';

/**
 * Mock E2B API key validation
 */
export function mockE2BApiKeyInvalid() {
  vi.mock('@e2b/code-interpreter', () => ({
    Sandbox: vi.fn(() => Promise.reject(new Error('Invalid API key'))),
  }));
}
