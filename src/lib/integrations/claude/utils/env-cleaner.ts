/**
 * Returns environment variables safe for spawning the Claude CLI child process.
 *
 * Fixes:
 * - Sets HOME=/tmp (CLI creates ~/.claude/debug, needs writable directory in serverless)
 * - Removes Node.js debugging flags that may interfere with child processes
 * - Sets CLAUDE_CODE_ENTRYPOINT for SDK
 */
export function getCleanEnvironment(): NodeJS.ProcessEnv {
  const cleanEnv = { ...process.env };

  delete cleanEnv.NODE_OPTIONS;
  delete cleanEnv.VSCODE_INSPECTOR_OPTIONS;
  delete cleanEnv.NODE_INSPECT;
  delete cleanEnv.NODE_INSPECT_BRK;
  delete cleanEnv._NEXT_PRIVATE_PREBUNDLED_REACT;

  cleanEnv.CLAUDE_CODE_ENTRYPOINT ??= 'sdk-ts';
  cleanEnv.HOME = '/tmp';
  cleanEnv.TMPDIR = '/tmp';

  return cleanEnv;
}
