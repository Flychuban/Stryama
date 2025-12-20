/**
 * Resolves the path to the Claude Agent SDK CLI executable.
 * Tries standard path first (Production), then pnpm structure (local dev).
 *
 * @throws Error if CLI not found
 */
import path from 'path';
import fs from 'fs';

export function resolveClaudeCLIPath(): string {
  const standardPath = path.join(
    process.cwd(),
    'node_modules',
    '@anthropic-ai',
    'claude-agent-sdk',
    'cli.js'
  );

  if (fs.existsSync(standardPath)) {
    return standardPath;
  }

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
        return pnpmPath;
      }
    }
  }

  throw new Error(
    'Failed to resolve Claude Agent SDK CLI path. ' +
      'Ensure @anthropic-ai/claude-agent-sdk is installed and ' +
      'outputFileTracingIncludes is configured in next.config.js'
  );
}
