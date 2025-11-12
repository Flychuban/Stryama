/**
 * Claude CLI Path Resolver
 *
 * Dynamically resolves the path to the Claude Agent SDK CLI executable.
 * This is required for Vercel serverless deployments where the SDK cannot
 * auto-detect the CLI path in pnpm's complex directory structure.
 */

import path from 'path';

/**
 * Resolves the absolute path to the Claude Agent SDK CLI executable.
 *
 * This function uses Node.js's require.resolve() to dynamically find the
 * SDK installation directory, then constructs the path to cli.js.
 *
 * **Why this is needed:**
 * - In Vercel's serverless environment with pnpm, the SDK is installed at:
 *   `/var/task/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@VERSION/...`
 * - The SDK's auto-detection fails in this environment
 * - Explicitly setting the path ensures it works in both local and production
 *
 * @returns Absolute path to cli.js
 * @throws Error if the SDK package cannot be resolved
 *
 * @example
 * ```typescript
 * const cliPath = resolveClaudeCLIPath();
 * // Returns: "/var/task/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.1.27.../cli.js"
 * ```
 */
export function resolveClaudeCLIPath(): string {
  try {
    // Resolve the SDK package entry point (sdk.mjs)
    const sdkPath = require.resolve('@anthropic-ai/claude-agent-sdk');

    // Get the SDK package directory
    const sdkDir = path.dirname(sdkPath);

    // Construct the path to cli.js
    const cliPath = path.join(sdkDir, 'cli.js');

    console.log(`[Claude CLI Resolver] SDK path: ${sdkPath}`);
    console.log(`[Claude CLI Resolver] CLI path: ${cliPath}`);

    return cliPath;
  } catch (error) {
    console.error('[Claude CLI Resolver] Failed to resolve CLI path:', error);
    throw new Error(
      `Failed to resolve Claude Agent SDK CLI path: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
