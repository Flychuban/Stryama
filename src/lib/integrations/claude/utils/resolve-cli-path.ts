/**
 * Claude CLI Path Resolver
 *
 * Resolves the path to the Claude Agent SDK CLI executable.
 * This is required for Vercel serverless deployments where the SDK cannot
 * auto-detect the CLI path in pnpm's complex directory structure.
 *
 * Works with outputFileTracingIncludes in next.config.js which ensures
 * cli.js is included in the deployment bundle.
 */

import path from 'path';
import fs from 'fs';

/**
 * Resolves the absolute path to the Claude Agent SDK CLI executable.
 *
 * This function constructs the path to cli.js using multiple strategies
 * to ensure it works in both local development and Vercel production.
 *
 * **Why this is needed:**
 * - In Vercel's serverless environment with pnpm, the SDK is installed at:
 *   `/var/task/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@VERSION/...`
 * - The SDK's auto-detection fails in this environment
 * - Explicitly setting the path ensures it works in both local and production
 * - outputFileTracingIncludes ensures cli.js is in the deployment bundle
 *
 * @returns Absolute path to cli.js
 * @throws Error if the SDK CLI cannot be found
 *
 * @example
 * ```typescript
 * const cliPath = resolveClaudeCLIPath();
 * // Returns: "/var/task/node_modules/@anthropic-ai/claude-agent-sdk/cli.js"
 * ```
 */
export function resolveClaudeCLIPath(): string {
  // Strategy 1: Try standard node_modules structure (works after outputFileTracingIncludes)
  const standardPath = path.join(
    process.cwd(),
    'node_modules',
    '@anthropic-ai',
    'claude-agent-sdk',
    'cli.js'
  );

  if (fs.existsSync(standardPath)) {
    console.log(
      `[Claude CLI Resolver] Found CLI at standard path: ${standardPath}`
    );
    return standardPath;
  }

  // Strategy 2: Try pnpm structure (local development)
  const pnpmPattern = path.join(process.cwd(), 'node_modules', '.pnpm');

  if (fs.existsSync(pnpmPattern)) {
    const pnpmDirs = fs.readdirSync(pnpmPattern);
    const sdkDir = pnpmDirs.find((dir) =>
      dir.startsWith('@anthropic-ai+claude-agent-sdk@')
    );

    if (sdkDir) {
      const pnpmPath = path.join(
        pnpmPattern,
        sdkDir,
        'node_modules',
        '@anthropic-ai',
        'claude-agent-sdk',
        'cli.js'
      );

      if (fs.existsSync(pnpmPath)) {
        console.log(
          `[Claude CLI Resolver] Found CLI at pnpm path: ${pnpmPath}`
        );
        return pnpmPath;
      }
    }
  }

  // If neither strategy works, throw error
  throw new Error(
    'Failed to resolve Claude Agent SDK CLI path. ' +
      'Ensure @anthropic-ai/claude-agent-sdk is installed and ' +
      'outputFileTracingIncludes is configured in next.config.js'
  );
}
