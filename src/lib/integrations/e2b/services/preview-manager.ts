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
import type { File, Framework } from '@prisma/client';
import type { ServiceResult, PreviewResult, PreviewConfig } from '../types';
import { FrameworkType } from '@/lib/integrations/claude/types';
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
import {
  generatePackageJson,
  generateConfigFiles,
  generateEntryPointFiles,
} from '../utils/package-generator';

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
 * Map FrameworkType to Prisma Framework enum
 */
function mapFrameworkType(frameworkType: string): Framework {
  const upperFramework = frameworkType.toUpperCase();
  if (
    upperFramework === 'REACT' ||
    upperFramework === 'NEXTJS' ||
    upperFramework === 'VUE' ||
    upperFramework === 'VANILLA'
  ) {
    return upperFramework as Framework;
  }
  // Default to VANILLA for custom/unknown frameworks
  return 'VANILLA' as Framework;
}

/**
 * Map Prisma Framework enum back to FrameworkType enum
 */
function mapToFrameworkType(framework: Framework): FrameworkType {
  switch (framework) {
    case 'REACT':
      return FrameworkType.REACT;
    case 'NEXTJS':
      return FrameworkType.NEXTJS;
    case 'VUE':
      // VUE is not in FrameworkType enum, map to VANILLA
      return FrameworkType.VANILLA;
    case 'VANILLA':
      return FrameworkType.VANILLA;
    default:
      return FrameworkType.VANILLA;
  }
}

/**
 * Setup project with package.json and config files
 */
async function setupProjectFiles(
  sandbox: Sandbox,
  framework: Framework,
  projectName: string
): Promise<ServiceResult<boolean>> {
  try {
    const workDir = '/project';

    console.log(`[Preview] Setting up ${framework} project files`);

    // Check if package.json already exists
    const checkPackageJson = await sandbox.commands.run(
      `test -f ${workDir}/package.json && echo "exists" || echo "missing"`
    );
    const packageJsonExists = checkPackageJson.stdout.trim() === 'exists';

    // Generate and write package.json if it doesn't exist
    if (!packageJsonExists) {
      console.log('[Preview] Creating package.json');
      const packageJsonContent = generatePackageJson(framework, {
        name: projectName,
      });

      await sandbox.files.write(`${workDir}/package.json`, packageJsonContent);
    } else {
      console.log('[Preview] package.json already exists, skipping');
    }

    // Generate and write config files (vite.config, tsconfig, etc.)
    const configFiles = generateConfigFiles(framework);

    for (const [filename, content] of Object.entries(configFiles)) {
      const checkConfig = await sandbox.commands.run(
        `test -f ${workDir}/${filename} && echo "exists" || echo "missing"`
      );
      const configExists = checkConfig.stdout.trim() === 'exists';

      if (!configExists) {
        console.log(`[Preview] Creating ${filename}`);
        await sandbox.files.write(`${workDir}/${filename}`, content);
      } else {
        console.log(`[Preview] ${filename} already exists, skipping`);
      }
    }

    // Generate and write entry point files (index.html, main.tsx, App.tsx, etc.)
    // These are essential for the dev server to serve content
    const entryPointFiles = generateEntryPointFiles(framework);

    for (const [filename, content] of Object.entries(entryPointFiles)) {
      const checkFile = await sandbox.commands.run(
        `test -f ${workDir}/${filename} && echo "exists" || echo "missing"`
      );
      const fileExists = checkFile.stdout.trim() === 'exists';

      if (!fileExists) {
        console.log(`[Preview] Creating entry point: ${filename}`);

        // Create directory if needed (for src/ files)
        if (filename.includes('/')) {
          const dir = filename.substring(0, filename.lastIndexOf('/'));
          await sandbox.commands.run(`mkdir -p ${workDir}/${dir}`);
        }

        await sandbox.files.write(`${workDir}/${filename}`, content);
      } else {
        console.log(
          `[Preview] Entry point ${filename} already exists, skipping`
        );
      }
    }

    return {
      success: true,
      data: true,
      error: null,
    };
  } catch (error) {
    console.error('[Preview] Failed to setup project files:', error);
    return {
      success: false,
      data: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to setup project files',
    };
  }
}

/**
 * Install npm dependencies
 */
async function installDependencies(
  sandbox: Sandbox
): Promise<ServiceResult<boolean>> {
  try {
    const workDir = '/project';

    console.log(
      '[Preview] Installing dependencies (this may take a moment)...'
    );

    // Run npm install with a timeout
    const installResult = await sandbox.commands.run(
      `cd ${workDir} && npm install`,
      {
        timeoutMs: 180000, // 3 minutes timeout
      }
    );

    if (installResult.exitCode !== 0) {
      console.error('[Preview] npm install failed:', installResult.stderr);
      return {
        success: false,
        data: false,
        error: `npm install failed: ${installResult.stderr}`,
      };
    }

    console.log('[Preview] Dependencies installed successfully');

    return {
      success: true,
      data: true,
      error: null,
    };
  } catch (error) {
    console.error('[Preview] Failed to install dependencies:', error);
    return {
      success: false,
      data: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to install dependencies',
    };
  }
}

/**
 * Starts a preview development server in the E2B sandbox
 *
 * @param sandbox - The E2B sandbox instance
 * @param projectId - The project ID for logging/tracking
 * @param files - Project files to detect framework
 * @param projectFramework - Optional: The framework from project settings (preferred over detection)
 * @returns ServiceResult with preview URL and metadata
 */
export async function startPreviewServer(
  sandbox: Sandbox,
  projectId: string,
  files: readonly File[],
  projectFramework?: Framework
): Promise<ServiceResult<PreviewResult>> {
  try {
    // Use project framework if provided, otherwise detect from files
    const framework =
      projectFramework ??
      mapFrameworkType(generatePreviewConfig(files).framework);

    // Get port based on framework (use Vite port 5173 for all Vite-based projects)
    const port = framework === 'NEXTJS' ? 3000 : 5173;

    // Command should NOT include npm install as we do that separately
    const command = 'npm run dev';

    console.log(`[Preview] Starting preview for project ${projectId}`, {
      framework,
      port,
      command,
    });

    const workDir = '/project';

    // Step 1: Setup package.json, config files, and entry points
    const setupResult = await setupProjectFiles(sandbox, framework, projectId);

    if (!setupResult.success) {
      throw new PreviewServerStartError(
        `Failed to setup project files: ${setupResult.error}`,
        { projectId, framework }
      );
    }

    // Step 2: Install dependencies
    const installResult = await installDependencies(sandbox);

    if (!installResult.success) {
      throw new PreviewServerStartError(
        `Failed to install dependencies: ${installResult.error}`,
        { projectId, framework }
      );
    }

    // Step 3: Start the dev server
    const process = await sandbox.commands.run(`cd ${workDir} && ${command}`, {
      background: true,
      envs: {
        CI: 'true',
        PORT: port.toString(),
      },
    });

    previewProcesses.set(sandbox.sandboxId, {
      pid: process.pid,
      port: port,
    });

    console.log(`[Preview] Process started with PID ${process.pid}`);

    const host = sandbox.getHost(port);
    const previewUrl = `https://${host}`;

    console.log(`[Preview] Preview URL generated: ${previewUrl}`);

    const healthCheckResult = await checkPreviewHealth(previewUrl);

    if (!healthCheckResult.success) {
      throw new PreviewHealthCheckError(
        healthCheckResult.error ?? 'Preview health check failed',
        { url: previewUrl, framework }
      );
    }

    console.log(`[Preview] Preview server is ready at ${previewUrl}`);

    // Return successful result
    return {
      success: true,
      data: {
        url: previewUrl,
        framework: mapToFrameworkType(framework),
        port,
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
  files: readonly File[],
  projectFramework?: Framework
): Promise<ServiceResult<PreviewResult>> {
  await stopPreviewServer(sandbox);

  return startPreviewServer(sandbox, projectId, files, projectFramework);
}
