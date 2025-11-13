/**
 * Environment Variable Cleaner for Claude Agent SDK
 *
 * The Claude Agent SDK spawns a CLI process as a child process. In Vercel's
 * serverless environment, certain environment variables from the Next.js
 * runtime cause the child process to exit with code 1.
 *
 * This utility removes problematic environment variables before spawning
 * the CLI, ensuring clean execution.
 *
 * @see https://github.com/anthropics/claude-code/issues - Verified fix from GitHub
 */

/**
 * Returns a cleaned copy of process.env safe for spawning child processes.
 *
 * **Removed Variables:**
 * - `NODE_OPTIONS` - Node.js runtime options that interfere with child processes
 * - `VSCODE_INSPECTOR_OPTIONS` - VS Code debugging flags
 * - `NODE_INSPECT`, `NODE_INSPECT_BRK` - Node.js inspector flags
 * - `_NEXT_PRIVATE_PREBUNDLED_REACT` - Next.js internal variable
 *
 * **Added/Modified Variables:**
 * - `CLAUDE_CODE_ENTRYPOINT=sdk-ts` - Required by Claude Agent SDK
 * - `HOME=/tmp` - Redirect home directory to /tmp (Vercel serverless fix)
 * - `TMPDIR=/tmp` - Ensure temp directory points to writable location
 *
 * **Why HOME=/tmp is needed:**
 * The CLI creates `~/.claude/debug` directory for logging. In Vercel's serverless
 * environment, the filesystem is read-only except `/tmp`. Setting `HOME=/tmp`
 * allows the CLI to successfully create `/tmp/.claude/debug`.
 *
 * @returns Clean environment object safe for child process spawning
 *
 * @example
 * ```typescript
 * const sdkStream = query({
 *   options: {
 *     env: getCleanEnvironment(),
 *   }
 * });
 * ```
 */
export function getCleanEnvironment(): NodeJS.ProcessEnv {
  // Create a copy to avoid mutating process.env
  const cleanEnv = { ...process.env };

  // Remove Node.js debugging and inspection variables
  // These cause "exit code 1" errors when inherited by child processes
  delete cleanEnv.NODE_OPTIONS;
  delete cleanEnv.VSCODE_INSPECTOR_OPTIONS;
  delete cleanEnv.NODE_INSPECT;
  delete cleanEnv.NODE_INSPECT_BRK;

  // Remove Next.js internal variables that may interfere
  delete cleanEnv._NEXT_PRIVATE_PREBUNDLED_REACT;

  // Ensure SDK entrypoint is set (required by Claude Agent SDK)
  cleanEnv.CLAUDE_CODE_ENTRYPOINT ??= 'sdk-ts';

  // CRITICAL FIX: Set HOME to /tmp for serverless environments
  // The CLI tries to create ~/.claude/debug directory for logging
  // In Vercel's serverless environment, the filesystem is read-only except /tmp
  // Setting HOME=/tmp allows the CLI to create /tmp/.claude/debug successfully
  cleanEnv.HOME = '/tmp';
  cleanEnv.TMPDIR = '/tmp';

  return cleanEnv;
}
