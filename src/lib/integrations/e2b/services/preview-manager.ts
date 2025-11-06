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
 * Setup ONLY infrastructure files (package.json, vite.config.ts, tsconfig.json)
 * This is called BEFORE Claude runs to prepare the sandbox
 * Claude will create all application files (index.html, src/*, etc.)
 */
export async function setupInfrastructure(
  sandbox: Sandbox,
  framework: Framework,
  projectName: string
): Promise<ServiceResult<boolean>> {
  try {
    const workDir = '/project';

    console.log(
      `[Preview] Setting up ${framework} infrastructure files (package.json, configs)`
    );

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
 * Setup project with package.json and config files
 * @deprecated Use setupInfrastructure() instead - this function creates entry points that should be Claude's responsibility
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      console.error('[Preview] ❌ npm install failed:', installResult.stderr);
      return {
        success: false,
        data: false,
        error: `npm install failed: ${installResult.stderr}`,
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
    console.error('[Preview] ❌ Failed to install dependencies:', error);

    // Provide more specific error messages
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
        const setupResult = await setupInfrastructure(
          sandbox,
          framework,
          projectId
        );

        if (!setupResult.success) {
          throw new PreviewServerStartError(
            `Failed to setup infrastructure: ${setupResult.error}`,
            { projectId, framework }
          );
        }

        // Step 2: Install dependencies (only if needed)
        const installResult = await installDependencies(sandbox);

        if (!installResult.success) {
          throw new PreviewServerStartError(
            `Failed to install dependencies: ${installResult.error}`,
            { projectId, framework }
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
        { sandboxId: sandbox.sandboxId, projectId, framework }
      );
    }

    console.log('[Preview] ✅ Application files validated - index.html exists');

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
