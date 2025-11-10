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
import type { ServiceResult, PreviewResult } from '../types';
import {
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
 * Setup ONLY infrastructure files (package.json, vite.config.ts, tsconfig.json)
 * This is called BEFORE Claude runs to prepare the sandbox
 * Claude will create all application files (index.html, src/*, etc.)
 */
export async function setupInfrastructure(
  sandbox: Sandbox,
  projectName: string
): Promise<ServiceResult<boolean>> {
  try {
    const workDir = '/project';

    console.log(
      `[Preview] Setting up React+Vite infrastructure files (package.json, configs)`
    );

    // Check if package.json already exists
    const checkPackageJson = await sandbox.commands.run(
      `test -f ${workDir}/package.json && echo "exists" || echo "missing"`
    );
    const packageJsonExists = checkPackageJson.stdout.trim() === 'exists';

    // Generate and write package.json if it doesn't exist
    if (!packageJsonExists) {
      console.log('[Preview] Creating package.json');
      const packageJsonContent = generatePackageJson({
        name: projectName,
      });

      await sandbox.files.write(`${workDir}/package.json`, packageJsonContent);
    } else {
      console.log('[Preview] package.json already exists, skipping');
    }

    // Generate and write config files (vite.config, tsconfig, etc.)
    const configFiles = generateConfigFiles();

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

    console.log(
      '[Preview] ✅ Infrastructure setup complete - ready for Claude to generate application files'
    );

    return {
      success: true,
      data: true,
      error: null,
    };
  } catch (error) {
    console.error('[Preview] Failed to setup infrastructure:', error);
    return {
      success: false,
      data: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to setup infrastructure',
    };
  }
}

/**
 * Ensure npm is available in the sandbox environment
 * This is critical for resumed sandboxes that may have lost PATH configuration
 */
async function ensureNpmAvailable(
  sandbox: Sandbox
): Promise<ServiceResult<boolean>> {
  try {
    console.log('[Preview] 🔍 Checking npm availability...');

    // CRITICAL: Test if npm can actually EXECUTE, not just if binary exists
    // Test in /project directory (same context as npm install) to catch PATH issues
    const npmCheck = await sandbox.commands.run(
      'cd /project && npm --version',
      { timeoutMs: 10000 }
    );

    if (npmCheck.exitCode !== 0) {
      console.error(
        `[Preview] npm not available (exit code ${npmCheck.exitCode}):`,
        npmCheck.stderr || npmCheck.stdout
      );
      return {
        success: false,
        data: false,
        error: `npm command failed to execute (exit code ${npmCheck.exitCode}). Error: ${npmCheck.stderr || npmCheck.stdout}`,
      };
    }

    const version = npmCheck.stdout.trim();
    console.log(`[Preview] ✅ npm is available and executable: v${version}`);

    return {
      success: true,
      data: true,
      error: null,
    };
  } catch (error) {
    console.error('[Preview] Failed to check npm availability:', error);
    return {
      success: false,
      data: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to check npm availability',
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

    // CRITICAL: Check if npm is available before attempting to install
    // This prevents exit code 127 (command not found) errors in resumed sandboxes
    const npmCheckResult = await ensureNpmAvailable(sandbox);

    if (!npmCheckResult.success) {
      console.error(
        '[Preview] ❌ Cannot install dependencies - npm not available:',
        npmCheckResult.error
      );
      return {
        success: false,
        data: false,
        error: npmCheckResult.error ?? 'npm command not found in sandbox',
      };
    }

    console.log(
      '[Preview] 📦 Installing dependencies (this may take 5-10 minutes for large projects)...'
    );

    const startTime = Date.now();

    // Run npm install with extended timeout for large projects
    // React projects can have 100+ dependencies requiring 5-8 minutes
    const installResult = await sandbox.commands.run(
      `cd ${workDir} && npm install`,
      {
        timeoutMs: 600000, // 10 minutes timeout (increased from 3 minutes)
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (installResult.exitCode !== 0) {
      console.error(
        `[Preview] npm install failed (exit code ${installResult.exitCode}):`,
        installResult.stderr || installResult.stdout
      );
      return {
        success: false,
        data: false,
        error: `npm install failed (exit ${installResult.exitCode}): ${installResult.stderr || installResult.stdout}`,
      };
    }

    console.log(
      `[Preview] ✅ Dependencies installed successfully in ${duration}s`
    );

    return {
      success: true,
      data: true,
      error: null,
    };
  } catch (error) {
    console.error('[Preview] Failed to install dependencies:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('deadline_exceeded')
    ) {
      return {
        success: false,
        data: false,
        error:
          'npm install timed out after 10 minutes. The project may have too many dependencies. Try reducing dependencies or contact support.',
      };
    }

    return {
      success: false,
      data: false,
      error: `Failed to install dependencies: ${errorMessage}`,
    };
  }
}

/**
 * Starts a preview development server in the E2B sandbox
 *
 * @param sandbox - The E2B sandbox instance
 * @param projectId - The project ID for logging/tracking
 * @param files - Project files (kept for compatibility, not used for detection)
 * @returns ServiceResult with preview URL and metadata
 */
export async function startPreviewServer(
  sandbox: Sandbox,
  projectId: string,
  files: readonly File[]
): Promise<ServiceResult<PreviewResult>> {
  try {
    // Use hard-coded React+Vite configuration
    const port = getFrameworkPort();
    const command = 'npm run dev'; // Command without npm install (done separately)

    console.log(
      `[Preview] Starting React+Vite preview for project ${projectId}`,
      {
        port,
        command,
      }
    );

    const workDir = '/project';

    // Check if dev server is already running (Claude might have started it)
    const checkProcess = await sandbox.commands.run(
      `lsof -ti:${port} || echo "none"`,
      { timeoutMs: 5000 }
    );
    const existingPid = checkProcess.stdout.trim();
    const serverAlreadyRunning = existingPid !== 'none' && existingPid !== '';

    if (serverAlreadyRunning) {
      console.log(
        `[Preview] Dev server already running on port ${port} (PID: ${existingPid})`
      );
      console.log(
        `[Preview] Skipping infrastructure setup and dev server start - Claude already handled it`
      );
    } else {
      console.log(
        `[Preview] No dev server running, setting up infrastructure and starting server`
      );

      // Check if dependencies are already installed and valid
      const checkNodeModules = await sandbox.commands.run(
        `test -d ${workDir}/node_modules && test -n "$(ls -A ${workDir}/node_modules 2>/dev/null)" && echo "exists" || echo "missing"`,
        { timeoutMs: 5000 }
      );
      const nodeModulesExists = checkNodeModules.stdout.trim() === 'exists';

      if (nodeModulesExists) {
        console.log(
          `[Preview] ✅ Dependencies already installed (node_modules exists and is not empty) - skipping setup`
        );
      } else {
        console.log(
          `[Preview] 📦 Dependencies not found or invalid, running full setup...`
        );

        // Step 1: Ensure infrastructure files exist (package.json, configs)
        // Note: Claude should have already created all application files (index.html, src/*, etc.)
        // We only create infrastructure if missing
        const setupResult = await setupInfrastructure(sandbox, projectId);

        if (!setupResult.success) {
          throw new PreviewServerStartError(
            `Failed to setup infrastructure: ${setupResult.error}`,
            { projectId }
          );
        }

        // Step 2: Install dependencies (only if needed)
        const installResult = await installDependencies(sandbox);

        if (!installResult.success) {
          throw new PreviewServerStartError(
            `Failed to install dependencies: ${installResult.error}`,
            { projectId }
          );
        }
      }

      // Step 3: Start the dev server
      const process = await sandbox.commands.run(
        `cd ${workDir} && ${command}`,
        {
          background: true,
          envs: {
            CI: 'true',
            PORT: port.toString(),
          },
        }
      );

      previewProcesses.set(sandbox.sandboxId, {
        pid: process.pid,
        port: port,
      });

      console.log(`[Preview] Process started with PID ${process.pid}`);
    }

    // CRITICAL: Validate E2B sandbox is accessible before generating preview URL
    console.log('[Preview] Validating E2B sandbox is accessible...');
    try {
      const sandboxInfo = await sandbox.getInfo();
      console.log(
        `[Preview] ✅ Sandbox validated - E2B ID: ${sandboxInfo.sandboxId}, Status: running`
      );
    } catch (error) {
      throw new PreviewServerStartError(
        `E2B sandbox is not accessible. The sandbox may have been destroyed or expired. Please try regenerating your code.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { sandboxId: sandbox.sandboxId, projectId, error }
      );
    }

    const host = sandbox.getHost(port);
    const previewUrl = `https://${host}`;

    console.log(`[Preview] Preview URL generated: ${previewUrl}`);

    // Validate that essential application files exist before running health check
    // This prevents waiting 30s for health check when files are clearly missing
    console.log('[Preview] Validating application files exist in sandbox...');
    const checkIndexHtml = await sandbox.commands.run(
      `test -f ${workDir}/index.html && echo "exists" || echo "missing"`,
      { timeoutMs: 5000 }
    );
    const indexHtmlExists = checkIndexHtml.stdout.trim() === 'exists';

    if (!indexHtmlExists) {
      throw new PreviewServerStartError(
        'Application files not found in sandbox. index.html is missing. This usually means files were written to a different sandbox than the one being used for preview.',
        { sandboxId: sandbox.sandboxId, projectId }
      );
    }

    console.log('[Preview] ✅ Application files validated - index.html exists');

    const healthCheckResult = await checkPreviewHealth(previewUrl);

    if (!healthCheckResult.success) {
      throw new PreviewHealthCheckError(
        healthCheckResult.error ?? 'Preview health check failed',
        { url: previewUrl }
      );
    }

    console.log(`[Preview] Preview server is ready at ${previewUrl}`);

    // Return successful result
    return {
      success: true,
      data: {
        url: previewUrl,
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
  files: readonly File[]
): Promise<ServiceResult<PreviewResult>> {
  await stopPreviewServer(sandbox);

  return startPreviewServer(sandbox, projectId, files);
}
