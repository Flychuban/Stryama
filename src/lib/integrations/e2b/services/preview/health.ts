import type { Sandbox } from '@e2b/code-interpreter';
import type { ServiceResult } from '../../types';
import type { LogEntry } from './types';
import { HEALTH_CHECK_CONFIG, previewProcesses } from './config';
import { logger } from '~/lib/utils/logger';

/**
 * Check if preview server is healthy AND serving actual Vite content
 * This prevents false positives where port is open but Vite is still compiling
 *
 * @param url - Preview URL to check
 * @returns true if server is responding with valid Vite HTML content, false otherwise
 */
export async function isPreviewHealthy(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(HEALTH_CHECK_CONFIG.HTTP_TIMEOUT_MS),
    });

    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/html')) {
      logger.debug(
        `[Preview Health] ❌ Wrong content type: ${contentType ?? 'none'} (expected text/html)`
      );
      return false;
    }

    const html = await response.text();

    const isE2BError =
      html.includes('Closed Port Error') ||
      html.includes('no service running on port') ||
      html.includes('Connection refused on port');

    if (isE2BError) {
      logger.debug(
        `[Preview Health] ❌ E2B error page detected - Vite not ready yet`
      );
      return false;
    }

    const hasRootDiv = html.includes('<div id="root">');
    const hasModuleScript = html.includes('type="module"');
    const hasSrcMain =
      html.includes('src/main') ||
      html.includes('/src/main') ||
      html.includes('src="./main');

    const isViteContent = hasRootDiv && hasModuleScript;

    if (!isViteContent) {
      logger.debug(
        `[Preview Health] ❌ Not valid Vite content (root: ${hasRootDiv}, module: ${hasModuleScript}, main: ${hasSrcMain})`
      );
      logger.debug(
        `[Preview Health] HTML preview: ${html.substring(0, 500)}...`
      );
      return false;
    }

    logger.debug(
      `[Preview Health] ✅ Valid Vite content detected (HTML with root div + module script)`
    );
    return true;
  } catch (error) {
    if (error instanceof Error) {
      logger.debug(`[Preview Health] ❌ Health check failed: ${error.message}`);
    }
    return false;
  }
}

/**
 * Check if a process is still running in the sandbox
 */
export async function isProcessAlive(
  sandbox: Sandbox,
  pid: number
): Promise<boolean> {
  if (!pid || pid === 0) return false;

  try {
    const result = await sandbox.commands.run(`kill -0 ${pid} 2>/dev/null`, {
      timeoutMs: 3000,
    });

    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get detailed diagnostics about why a preview server might not be working
 */
export async function getServerDiagnostics(
  sandbox: Sandbox,
  sandboxId: string,
  port: number
): Promise<{
  processAlive: boolean;
  portInUse: boolean;
  pid: number | null;
  logs: LogEntry[];
}> {
  const processInfo = previewProcesses.get(sandboxId);

  let processAlive = false;
  if (processInfo?.pid) {
    processAlive = await isProcessAlive(sandbox, processInfo.pid);
  }

  let portInUse = false;
  try {
    const portCheck = await sandbox.commands.run(
      `lsof -ti:${port} 2>/dev/null || echo "no process"`,
      { timeoutMs: 3000 }
    );
    portInUse = !portCheck.stdout.includes('no process');
  } catch {
    portInUse = false;
  }

  return {
    processAlive,
    portInUse,
    pid: processInfo?.pid ?? null,
    logs: processInfo?.logs ?? [],
  };
}

export async function checkPreviewHealth(
  url: string,
  maxAttempts: number = HEALTH_CHECK_CONFIG.MAX_ATTEMPTS
): Promise<ServiceResult<boolean>> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const isHealthy = await isPreviewHealthy(url);

    if (isHealthy) {
      return {
        success: true,
        data: true,
        error: null,
      };
    }

    attempts++;

    if (attempts < maxAttempts) {
      await new Promise((resolve) =>
        setTimeout(resolve, HEALTH_CHECK_CONFIG.INTERVAL_MS)
      );
    }
  }

  return {
    success: false,
    data: false,
    error: `Preview health check failed after ${maxAttempts} attempts (${HEALTH_CHECK_CONFIG.MAX_TIMEOUT_MS}ms)`,
  };
}
