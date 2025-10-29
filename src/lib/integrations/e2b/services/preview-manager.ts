/**
 * Preview Manager Service
 *
 * Handles preview server lifecycle management in E2B sandboxes:
 * - Starting development servers based on framework type
 * - Generating public preview URLs
 * - Health checking preview servers
 * - Managing preview server processes
 */

import type { Sandbox } from '@e2b/code-interpreter';
import type { File } from '@prisma/client';
import type { ServiceResult, PreviewResult, PreviewConfig } from '../types';
import {
  detectFramework,
  getFrameworkPort,
  getFrameworkCommand,
} from '../utils/framework-detector';
import {
  PreviewTimeoutError,
  PreviewHealthCheckError,
  PreviewServerStartError,
} from '../errors';

const HEALTH_CHECK_CONFIG = {
  INTERVAL_MS: 2000,
  MAX_TIMEOUT_MS: 30000,
  MAX_ATTEMPTS: 15,
} as const;

/**
 * Map to store running preview processes by sandbox ID
 * This allows us to track and kill preview servers when needed
 */
const previewProcesses = new Map<string, { pid: number; port: number }>();

function generatePreviewConfig(files: readonly File[]): PreviewConfig {
  const framework = detectFramework(files);
  const port = getFrameworkPort(framework);
  const command = getFrameworkCommand(framework);

  return {
    framework,
    port,
    command,
  };
}

async function isPreviewHealthy(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000), // 5 second timeout per request
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkPreviewHealth(
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

/**
 * Starts a preview development server in the E2B sandbox
 *
 * @param sandbox - The E2B sandbox instance
 * @param projectId - The project ID for logging/tracking
 * @param files - Project files to detect framework
 * @returns ServiceResult with preview URL and metadata
 */
export async function startPreviewServer(
  sandbox: Sandbox,
  projectId: string,
  files: readonly File[]
): Promise<ServiceResult<PreviewResult>> {
  try {
    const config = generatePreviewConfig(files);

    console.log(`[Preview] Starting preview for project ${projectId}`, {
      framework: config.framework,
      port: config.port,
      command: config.command,
    });

    const workDir = '/project';

    const process = await sandbox.commands.run(
      `cd ${workDir} && ${config.command}`,
      {
        background: true,
        envs: {
          CI: 'true',
          PORT: config.port.toString(),
        },
      }
    );

    previewProcesses.set(sandbox.sandboxId, {
      pid: process.pid,
      port: config.port,
    });

    console.log(`[Preview] Process started with PID ${process.pid}`);

    const host = sandbox.getHost(config.port);
    const previewUrl = `https://${host}`;

    console.log(`[Preview] Preview URL generated: ${previewUrl}`);

    const healthCheckResult = await checkPreviewHealth(previewUrl);

    if (!healthCheckResult.success) {
      throw new PreviewHealthCheckError(
        healthCheckResult.error ?? 'Preview health check failed',
        { url: previewUrl, framework: config.framework }
      );
    }

    console.log(`[Preview] Preview server is ready at ${previewUrl}`);

    // Return successful result
    return {
      success: true,
      data: {
        url: previewUrl,
        framework: config.framework,
        port: config.port,
        startTime: new Date(),
      },
      error: null,
    };
  } catch (error) {
    console.error(`[Preview] Failed to start preview server:`, error);

    if (
      error instanceof PreviewTimeoutError ||
      error instanceof PreviewHealthCheckError ||
      error instanceof PreviewServerStartError
    ) {
      throw error;
    }

    throw new PreviewServerStartError(
      `Failed to start preview server: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { error, projectId }
    );
  }
}

export async function getPreviewLogs(
  sandbox: Sandbox
): Promise<ServiceResult<string>> {
  try {
    const processInfo = previewProcesses.get(sandbox.sandboxId);

    if (!processInfo) {
      return {
        success: false,
        data: null,
        error: 'No preview process found for this sandbox',
      };
    }

    return {
      success: true,
      data: `Preview server running on port ${processInfo.port} (PID: ${processInfo.pid})`,
      error: null,
    };
  } catch (error) {
    console.error('[Preview] Failed to get preview logs:', error);
    return {
      success: false,
      data: null,
      error:
        error instanceof Error ? error.message : 'Failed to get preview logs',
    };
  }
}

export async function stopPreviewServer(
  sandbox: Sandbox
): Promise<ServiceResult<boolean>> {
  try {
    const processInfo = previewProcesses.get(sandbox.sandboxId);

    if (!processInfo) {
      return {
        success: true,
        data: true,
        error: null,
      };
    }

    await sandbox.commands.run(`kill ${processInfo.pid}`);

    previewProcesses.delete(sandbox.sandboxId);

    console.log(`[Preview] Preview server stopped (PID: ${processInfo.pid})`);

    return {
      success: true,
      data: true,
      error: null,
    };
  } catch (error) {
    console.error('[Preview] Failed to stop preview server:', error);
    return {
      success: false,
      data: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to stop preview server',
    };
  }
}

export async function restartPreviewServer(
  sandbox: Sandbox,
  projectId: string,
  files: readonly File[]
): Promise<ServiceResult<PreviewResult>> {
  await stopPreviewServer(sandbox);

  return startPreviewServer(sandbox, projectId, files);
}
