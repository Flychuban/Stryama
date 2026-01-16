import type { Sandbox } from '@e2b/code-interpreter';
import { logger } from '~/lib/utils/logger';

/**
 * Quickly check if a port is free without performing cleanup
 * This is a fast pre-check to avoid unnecessary cleanup operations
 *
 * @param sandbox - E2B sandbox instance
 * @param port - Port number to check
 * @returns true if port is free, false if in use or check fails
 */
export async function isPortFree(
  sandbox: Sandbox,
  port: number
): Promise<boolean> {
  try {
    const result = await sandbox.commands.run(`lsof -ti:${port}`, {
      timeoutMs: 2000,
    });

    if (result.exitCode === 0) {
      return false;
    }

    if (result.exitCode === 1) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Robust port cleanup with verification
 * Kills any process on the specified port and verifies it's truly free
 *
 * @param sandbox - E2B sandbox instance
 * @param port - Port to clean up
 * @param maxWaitMs - Maximum time to wait for port release (default 5000ms)
 * @returns True if port is free, false otherwise
 */
export async function cleanupPortWithVerification(
  sandbox: Sandbox,
  port: number,
  maxWaitMs = 5000
): Promise<boolean> {
  const startTime = Date.now();

  if (await isPortFree(sandbox, port)) {
    logger.debug(`[Preview] ✅ Port ${port} already free, skipping cleanup`);
    return true;
  }

  logger.debug(`[Preview] 🧹 Starting robust port ${port} cleanup...`);

  const killCommands = [
    `fuser -k -9 ${port}/tcp 2>/dev/null`,
    `lsof -ti:${port} 2>/dev/null | xargs -r kill -9 2>/dev/null`,
    `pkill -9 -f 'vite.*${port}' 2>/dev/null`,
    `pkill -9 -f 'npm.*dev' 2>/dev/null`,
    `pkill -9 -f 'node.*vite' 2>/dev/null`,
  ];

  for (const cmd of killCommands) {
    try {
      await sandbox.commands.run(`${cmd} || true`, { timeoutMs: 3000 });
    } catch {
      // Ignore errors - command may fail if no matching process
    }
  }

  const pollDelays = [500, 1000, 1500, 2000];
  let totalWaited = 0;

  for (const delay of pollDelays) {
    if (totalWaited + delay > maxWaitMs) break;

    await new Promise((resolve) => setTimeout(resolve, delay));
    totalWaited += delay;

    try {
      const checkResult = await sandbox.commands.run(
        `lsof -ti:${port} 2>/dev/null || echo "FREE"`,
        { timeoutMs: 3000 }
      );

      const output = checkResult.stdout.trim();
      if (output === 'FREE' || output === '') {
        const duration = Date.now() - startTime;
        logger.debug(`[Preview] ✅ Port ${port} is free after ${duration}ms`);
        return true;
      }

      logger.debug(
        `[Preview] ⏳ Port ${port} still in use (waited ${totalWaited}ms), PIDs: ${output}`
      );

      await sandbox.commands.run(
        `kill -9 ${output.split('\n').join(' ')} 2>/dev/null || true`,
        { timeoutMs: 2000 }
      );
    } catch {
      // Check failed, continue waiting
    }
  }

  try {
    const finalCheck = await sandbox.commands.run(
      `lsof -ti:${port} 2>/dev/null || echo "FREE"`,
      { timeoutMs: 3000 }
    );

    const isFree =
      finalCheck.stdout.trim() === 'FREE' || finalCheck.stdout.trim() === '';
    const duration = Date.now() - startTime;

    if (isFree) {
      logger.debug(`[Preview] ✅ Port ${port} freed after ${duration}ms`);
    } else {
      logger.warn(
        `[Preview] ⚠️ Port ${port} still in use after ${duration}ms: ${finalCheck.stdout.trim()}`
      );
    }

    return isFree;
  } catch {
    return false;
  }
}
