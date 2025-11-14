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
import { getFrameworkPort } from '../utils/framework-detector';
import {
  PreviewTimeoutError,
  PreviewHealthCheckError,
  PreviewServerStartError,
} from '../errors';
import {
  generatePackageJson,
  generateConfigFiles,
} from '../utils/package-generator';
import {
  detectDependencies,
  logDetectedDependencies,
} from '../utils/dependency-detector';

const HEALTH_CHECK_CONFIG = {
  INTERVAL_MS: 2000,
  MAX_TIMEOUT_MS: 30000,
  MAX_ATTEMPTS: 15,
} as const;

/**
 * Log entry structure for dev server output
 */
type LogEntry = {
  timestamp: number;
  type: 'stdout' | 'stderr';
  line: string;
};

/**
 * Preview process information including logs
 */
type PreviewProcessInfo = {
  pid: number;
  port: number;
  logs: LogEntry[];
  lastActivity: number;
};

/**
 * Map to store running preview processes by sandbox ID
 * This allows us to track and kill preview servers when needed
 * Also stores stdout/stderr logs for debugging
 */
const previewProcesses = new Map<string, PreviewProcessInfo>();

/**
 * Maximum number of log lines to store per process (prevent memory bloat)
 */
const MAX_LOG_LINES = 200;

/**
 * Time-to-live for process tracking entries (30 minutes)
 * After this time of inactivity, entries are removed to prevent memory leaks
 */
const PROCESS_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Interval for running cleanup of stale process entries (5 minutes)
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Clean up stale process entries from the previewProcesses Map
 * Removes entries that haven't been active for longer than PROCESS_TTL_MS
 */
function cleanupStaleProcesses(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sandboxId, info] of previewProcesses.entries()) {
    if (now - info.lastActivity > PROCESS_TTL_MS) {
      previewProcesses.delete(sandboxId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(
      `[Preview] Cleaned up ${cleanedCount} stale process tracking entries`
    );
  }
}

// Set up periodic cleanup to prevent memory leaks
// Only run in server environment (not during build or in browser)
if (typeof setInterval !== 'undefined' && typeof process !== 'undefined') {
  const cleanupTimer = setInterval(cleanupStaleProcesses, CLEANUP_INTERVAL_MS);

  // Prevent the timer from keeping the process alive
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
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
 * Setup ONLY infrastructure files (package.json, vite.config.ts, tsconfig.json)
 * This is called BEFORE Claude runs to prepare the sandbox
 * Claude will create all application files (index.html, src/*, etc.)
 *
 * @param sandbox - E2B sandbox instance
 * @param projectName - Name for package.json
 * @param files - Optional array of files to scan for dependencies
 */
export async function setupInfrastructure(
  sandbox: Sandbox,
  projectName: string,
  files?: readonly File[]
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

      // Detect dependencies from files if provided
      let detectedDeps = { dependencies: {}, devDependencies: {} };
      if (files && files.length > 0) {
        console.log(
          `[Preview] Scanning ${files.length} files for npm dependencies...`
        );
        detectedDeps = detectDependencies(files);
        logDetectedDependencies(detectedDeps, '[Preview]');
      }

      const packageJsonContent = generatePackageJson({
        name: projectName,
        additionalDependencies: detectedDeps.dependencies,
        additionalDevDependencies: detectedDeps.devDependencies,
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
 * @param sandboxId - Optional sandbox ID for checking metadata
 * @returns ServiceResult with preview URL and metadata
 */
export async function startPreviewServer(
  sandbox: Sandbox,
  projectId: string,
  files: readonly File[],
  sandboxId?: string,
  forceRestart = false
): Promise<ServiceResult<PreviewResult>> {
  const startTime = Date.now();
  console.log(`[Preview] 🚀 ========== START PREVIEW SERVER ==========`);
  console.log(`[Preview] Project ID: ${projectId}`);
  console.log(`[Preview] Sandbox ID: ${sandboxId ?? 'unknown'}`);
  console.log(`[Preview] E2B Sandbox ID: ${sandbox.sandboxId}`);
  console.log(`[Preview] Files provided: ${files.length}`);
  console.log(`[Preview] Timestamp: ${new Date().toISOString()}`);

  try {
    // Use hard-coded React+Vite configuration
    const port = getFrameworkPort();
    const command = 'npm run dev'; // Command without npm install (done separately)

    console.log(
      `[Preview] 🔧 Configuration: port=${port}, command="${command}"`
    );

    const workDir = '/project';
    console.log(`[Preview] Working directory: ${workDir}`);

    // Validate port number to prevent command injection
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new PreviewServerStartError(
        `Invalid port number: ${port}. Port must be an integer between 1 and 65535.`,
        { projectId, port }
      );
    }

    // CRITICAL FIX: Check if preview URL is responding FIRST (HTTP-first approach)
    // This is more reliable than port checks because Claude's server might be starting
    // but not yet bound to the port when lsof runs
    // SKIP this check if forceRestart=true (called from restartPreviewServer)
    const host = sandbox.getHost(port);
    const previewUrl = `https://${host}`;
    let serverAlreadyRunning = false;

    if (!forceRestart) {
      console.log(
        `[Preview] 🌐 ========== CHECKING EXISTING SERVER ==========`
      );
      console.log(`[Preview] 🔍 Testing HTTP endpoint for existing server...`);
      console.log(`[Preview] Preview URL: ${previewUrl}`);
      console.log(`[Preview] Host: ${host}`);
      console.log(`[Preview] Port: ${port}`);

      // Try HTTP health check with multiple retries (Claude might have just started the server)
      // Wait up to 15 seconds for server to become responsive
      const maxRetries = 5;
      const delays = [2000, 3000, 3000, 4000, 3000]; // Total: 15 seconds
      console.log(
        `[Preview] Will perform ${maxRetries} health checks over ${delays.reduce((a, b) => a + b, 0) / 1000}s`
      );

      const healthCheckStartTime = Date.now();
      for (let i = 0; i < maxRetries; i++) {
        console.log(
          `[Preview] 🔍 Health check attempt ${i + 1}/${maxRetries}...`
        );
        const checkStartTime = Date.now();
        const isHealthy = await isPreviewHealthy(previewUrl);
        const checkDuration = Date.now() - checkStartTime;

        console.log(
          `[Preview] Health check ${i + 1} result: ${isHealthy ? '✅ HEALTHY' : '❌ NOT HEALTHY'} (${checkDuration}ms)`
        );

        if (isHealthy) {
          const totalCheckTime = Date.now() - healthCheckStartTime;
          console.log(
            `[Preview] ✅ Dev server is already running and responding!`
          );
          console.log(
            `[Preview] Found existing server after ${i + 1} attempts in ${totalCheckTime}ms`
          );
          serverAlreadyRunning = true;
          break;
        }

        if (i < maxRetries - 1) {
          const delay = delays[i];
          console.log(
            `[Preview] ⏳ Server not responding, waiting ${delay}ms before retry ${i + 2}/${maxRetries}...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.log(
            `[Preview] ❌ Server not responding after ${maxRetries} attempts`
          );
        }
      }

      const totalHealthCheckTime = Date.now() - healthCheckStartTime;
      console.log(
        `[Preview] 🏁 HTTP check completed in ${totalHealthCheckTime}ms: ${serverAlreadyRunning ? '✅ SERVER RUNNING' : '❌ NO SERVER'}`
      );
    } else {
      console.log(
        `[Preview] ⚡ FORCE RESTART mode - skipping health check, will start fresh server`
      );
    }

    if (serverAlreadyRunning) {
      const totalDuration = Date.now() - startTime;
      console.log(`[Preview] ✅ ========== SERVER ALREADY RUNNING ==========`);
      console.log(
        `[Preview] Skipping infrastructure setup and dev server start`
      );
      console.log(`[Preview] Total time: ${totalDuration}ms`);
      console.log(`[Preview] Returning existing server URL: ${previewUrl}`);
    } else {
      console.log(`[Preview] 🔧 ========== SETTING UP NEW SERVER ==========`);
      console.log(
        `[Preview] No existing server found, will set up infrastructure and start dev server`
      );

      // SAFETY: Kill any zombie processes that might be on the port but not responding
      // This prevents "Port already in use" errors from dead/hanging processes
      console.log(
        `[Preview] 🧹 Cleaning up any zombie processes on port ${port}...`
      );
      const killStartTime = Date.now();
      try {
        const killResult = await sandbox.commands.run(
          `lsof -ti:${port} | xargs -r kill -9 2>/dev/null || true`,
          { timeoutMs: 3000 }
        );
        const killDuration = Date.now() - killStartTime;
        if (killResult.exitCode === 0 && killResult.stdout.trim()) {
          console.log(
            `[Preview] ✅ Cleaned up zombie process(es) on port ${port} (${killDuration}ms)`
          );
          console.log(`[Preview] Killed PIDs: ${killResult.stdout.trim()}`);
        } else {
          console.log(
            `[Preview] ✅ No zombie processes found (${killDuration}ms)`
          );
        }
      } catch (error) {
        const killDuration = Date.now() - killStartTime;
        console.log(
          `[Preview] ℹ️  Cleanup not needed or failed (${killDuration}ms):`,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      // Check if dependencies are already installed and valid
      console.log(`[Preview] 🔍 Checking if node_modules already exists...`);
      const checkStartTime = Date.now();
      const checkNodeModules = await sandbox.commands.run(
        `test -d ${workDir}/node_modules && test -n "$(ls -A ${workDir}/node_modules 2>/dev/null)" && echo "exists" || echo "missing"`,
        { timeoutMs: 5000 }
      );
      const checkDuration = Date.now() - checkStartTime;
      const nodeModulesExists = checkNodeModules.stdout.trim() === 'exists';
      console.log(
        `[Preview] node_modules check (${checkDuration}ms): ${nodeModulesExists ? '✅ EXISTS' : '❌ MISSING'}`
      );

      if (nodeModulesExists) {
        console.log(
          `[Preview] ✅ Dependencies already installed - skipping setup`
        );
        console.log(
          `[Preview] This is likely a resumed sandbox with existing state`
        );
      } else {
        console.log(
          `[Preview] 📦 ========== INSTALLING DEPENDENCIES ==========`
        );
        console.log(
          `[Preview] Dependencies not found or invalid, running full setup...`
        );

        // Step 1: Ensure infrastructure files exist (package.json, configs)
        // Note: Claude should have already created all application files (index.html, src/*, etc.)
        // We only create infrastructure if missing
        // Pass files array to detect dependencies from generated code
        console.log(`[Preview] 🏗️  Step 1: Setting up infrastructure files...`);
        const infraStartTime = Date.now();
        const setupResult = await setupInfrastructure(
          sandbox,
          projectId,
          files
        );
        const infraDuration = Date.now() - infraStartTime;

        if (!setupResult.success) {
          console.error(
            `[Preview] ❌ Infrastructure setup failed after ${infraDuration}ms: ${setupResult.error}`
          );
          throw new PreviewServerStartError(
            `Failed to setup infrastructure: ${setupResult.error}`,
            { projectId }
          );
        }
        console.log(
          `[Preview] ✅ Infrastructure setup complete (${infraDuration}ms)`
        );

        // Step 2: Install dependencies (only if needed)
        console.log(`[Preview] 📦 Step 2: Installing npm dependencies...`);
        const installStartTime = Date.now();
        const installResult = await installDependencies(sandbox);
        const installDuration = Date.now() - installStartTime;

        if (!installResult.success) {
          console.error(
            `[Preview] ❌ npm install failed after ${(installDuration / 1000).toFixed(1)}s: ${installResult.error}`
          );
          throw new PreviewServerStartError(
            `Failed to install dependencies: ${installResult.error}`,
            { projectId }
          );
        }
        console.log(
          `[Preview] ✅ Dependencies installed successfully (${(installDuration / 1000).toFixed(1)}s)`
        );
      }

      // Step 3: Start the dev server with log capture
      console.log(`[Preview] 🚀 ========== STARTING DEV SERVER ==========`);
      console.log(`[Preview] Command: ${command}`);
      console.log(`[Preview] Port: ${port}`);
      console.log(`[Preview] Working directory: ${workDir}`);

      const processInfo: PreviewProcessInfo = {
        pid: 0, // Will be updated after process starts
        port: port,
        logs: [],
        lastActivity: Date.now(),
      };

      // Store process info early so handlers can access it
      console.log(
        `[Preview] 📝 Registering process info for sandbox ${sandbox.sandboxId}`
      );
      previewProcesses.set(sandbox.sandboxId, processInfo);

      let logLineCount = 0;
      const MAX_INITIAL_LOGS = 20; // Log first 20 lines to console for diagnostics
      console.log(
        `[Preview] 📊 Will log first ${MAX_INITIAL_LOGS} stdout lines and all stderr to console`
      );

      console.log(
        `[Preview] 🔄 Executing command: cd ${workDir} && ${command}`
      );
      const processStartTime = Date.now();
      const process = await sandbox.commands.run(
        `cd ${workDir} && ${command}`,
        {
          background: true,
          envs: {
            CI: 'true',
            PORT: port.toString(),
          },
          onStdout: (data) => {
            const lines = data.split('\n').filter((line) => line.trim() !== '');
            for (const line of lines) {
              const entry: LogEntry = {
                timestamp: Date.now(),
                type: 'stdout',
                line: line,
              };

              // Add to logs array (keep only last MAX_LOG_LINES)
              processInfo.logs.push(entry);
              if (processInfo.logs.length > MAX_LOG_LINES) {
                processInfo.logs.shift();
              }

              processInfo.lastActivity = Date.now();

              // Log first few lines to console for immediate diagnostics
              if (logLineCount < MAX_INITIAL_LOGS) {
                console.log(`[Preview] [stdout] ${line}`);
                logLineCount++;
                if (logLineCount === MAX_INITIAL_LOGS) {
                  console.log(
                    `[Preview] (reached max initial logs, suppressing further stdout unless important)`
                  );
                }
              }

              // Detect when Vite server is ready
              if (line.includes('ready in') || line.includes('Local:')) {
                console.log(`[Preview] ✅ 🎉 Vite server ready: ${line}`);
              }
            }
          },
          onStderr: (data) => {
            const lines = data.split('\n').filter((line) => line.trim() !== '');
            for (const line of lines) {
              const entry: LogEntry = {
                timestamp: Date.now(),
                type: 'stderr',
                line: line,
              };

              // Add to logs array (keep only last MAX_LOG_LINES)
              processInfo.logs.push(entry);
              if (processInfo.logs.length > MAX_LOG_LINES) {
                processInfo.logs.shift();
              }

              processInfo.lastActivity = Date.now();

              // Always log stderr to console (errors are critical)
              console.error(`[Preview] [stderr] ${line}`);

              // Detect compilation errors
              if (
                line.toLowerCase().includes('error') &&
                !line.includes('0 error')
              ) {
                console.error(
                  `[Preview] ❌ 🚨 Compilation error detected: ${line}`
                );
              }
            }
          },
        }
      );
      const processCreationDuration = Date.now() - processStartTime;

      // Update PID after process starts
      processInfo.pid = process.pid;

      console.log(
        `[Preview] ✅ Dev server process spawned in ${processCreationDuration}ms`
      );
      console.log(`[Preview] Process PID: ${process.pid}`);
      console.log(`[Preview] Background: true`);
      console.log(`[Preview] Environment: CI=true, PORT=${port}`);
      console.log(
        `[Preview] Log capture active - storing last ${MAX_LOG_LINES} lines`
      );
    }

    // CRITICAL: Validate E2B sandbox is accessible before generating preview URL
    console.log(`[Preview] 🔍 ========== VALIDATING SANDBOX ==========`);
    console.log(`[Preview] Checking E2B sandbox accessibility...`);
    const sandboxCheckStartTime = Date.now();
    try {
      const sandboxInfo = await sandbox.getInfo();
      const sandboxCheckDuration = Date.now() - sandboxCheckStartTime;
      console.log(
        `[Preview] ✅ Sandbox validated in ${sandboxCheckDuration}ms`
      );
      console.log(`[Preview] E2B ID: ${sandboxInfo.sandboxId}`);
      console.log(`[Preview] Status: running`);
    } catch (error) {
      const sandboxCheckDuration = Date.now() - sandboxCheckStartTime;
      console.error(
        `[Preview] ❌ Sandbox validation failed after ${sandboxCheckDuration}ms`
      );
      console.error(`[Preview] Error:`, error);
      throw new PreviewServerStartError(
        `E2B sandbox is not accessible. The sandbox may have been destroyed or expired. Please try regenerating your code.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { sandboxId: sandbox.sandboxId, projectId, error }
      );
    }

    // Note: host and previewUrl already declared at the top for HTTP checks
    console.log(`[Preview] 🌐 Preview URL: ${previewUrl}`);

    // Validate that essential application files exist before running health check
    // This prevents waiting 30s for health check when files are clearly missing
    console.log(
      `[Preview] 🔍 Validating application files exist in sandbox...`
    );
    const fileCheckStartTime = Date.now();
    const checkIndexHtml = await sandbox.commands.run(
      `test -f ${workDir}/index.html && echo "exists" || echo "missing"`,
      { timeoutMs: 5000 }
    );
    const fileCheckDuration = Date.now() - fileCheckStartTime;
    const indexHtmlExists = checkIndexHtml.stdout.trim() === 'exists';

    console.log(
      `[Preview] File check (${fileCheckDuration}ms): index.html ${indexHtmlExists ? '✅ EXISTS' : '❌ MISSING'}`
    );

    if (!indexHtmlExists) {
      console.error(
        `[Preview] ❌ CRITICAL: index.html not found in ${workDir}`
      );
      console.error(
        `[Preview] This indicates files were written to wrong sandbox or not written at all`
      );
      throw new PreviewServerStartError(
        'Application files not found in sandbox. index.html is missing. This usually means files were written to a different sandbox than the one being used for preview.',
        { sandboxId: sandbox.sandboxId, projectId }
      );
    }

    console.log(`[Preview] ✅ Application files validated`);

    // Check if we received any log output (diagnostic for silent failures)
    console.log(`[Preview] 📊 ========== DEV SERVER DIAGNOSTICS ==========`);
    const processInfo = previewProcesses.get(sandbox.sandboxId);
    if (processInfo && !serverAlreadyRunning) {
      // Wait 5 seconds for dev server to start producing output
      console.log(
        `[Preview] ⏳ Waiting 5s for dev server to produce output...`
      );
      const logWaitStartTime = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const logWaitDuration = Date.now() - logWaitStartTime;

      console.log(
        `[Preview] 📊 After ${(logWaitDuration / 1000).toFixed(1)}s wait:`
      );
      console.log(
        `[Preview] Total log lines captured: ${processInfo.logs.length}`
      );
      console.log(
        `[Preview] Last activity: ${new Date(processInfo.lastActivity).toISOString()}`
      );

      if (processInfo.logs.length === 0) {
        console.error(
          `[Preview] ❌ WARNING: No output received from dev server after ${(logWaitDuration / 1000).toFixed(1)}s!`
        );
        console.error(
          '[Preview] This may indicate the dev server failed to start or is hanging.'
        );
        console.error(`[Preview] Process PID: ${processInfo.pid}`);
        console.error(
          `[Preview] This could be due to: missing dependencies, syntax errors, or npm issues`
        );
      } else {
        console.log(
          `[Preview] ✅ Received ${processInfo.logs.length} log lines from dev server`
        );
        const stdoutCount = processInfo.logs.filter(
          (log) => log.type === 'stdout'
        ).length;
        const stderrCount = processInfo.logs.filter(
          (log) => log.type === 'stderr'
        ).length;
        console.log(
          `[Preview] Breakdown: ${stdoutCount} stdout, ${stderrCount} stderr`
        );

        // Check for specific error patterns
        console.log(`[Preview] 🔍 Analyzing logs for errors...`);
        const errorLogs = processInfo.logs.filter(
          (log) =>
            log.type === 'stderr' &&
            log.line.toLowerCase().includes('error') &&
            !log.line.includes('0 error')
        );

        if (errorLogs.length > 0) {
          console.error(
            `[Preview] ❌ Found ${errorLogs.length} error(s) in dev server logs (showing first 5):`
          );
          errorLogs.slice(0, 5).forEach((log, index) => {
            console.error(`[Preview]   ${index + 1}. ${log.line}`);
          });

          // CRITICAL: Check if error is "Port already in use" - if so, another server is running
          const portInUseError = errorLogs.some(
            (log) =>
              log.line.toLowerCase().includes('port') &&
              log.line.toLowerCase().includes('already in use')
          );

          if (portInUseError) {
            console.log(
              `[Preview] 🔍 "Port already in use" detected - checking if another server is now responding...`
            );

            // Wait a moment for the other server to fully start
            const recoveryWaitStartTime = Date.now();
            await new Promise((resolve) => setTimeout(resolve, 3000));
            const recoveryWaitDuration = Date.now() - recoveryWaitStartTime;

            // Check if the preview URL is now responding
            console.log(
              `[Preview] Testing if other server is healthy (after ${recoveryWaitDuration}ms wait)...`
            );
            const isNowHealthy = await isPreviewHealthy(previewUrl);
            if (isNowHealthy) {
              console.log(
                `[Preview] ✅ Another dev server is running and responding - using that instead`
              );
              console.log(
                `[Preview] This is a race condition but we recovered successfully`
              );
              // Don't throw an error, just use the existing server
              // The health check below will pass and we'll return success
              return {
                success: true,
                data: {
                  url: previewUrl,
                  port,
                  startTime: new Date(),
                },
                error: null,
              };
            } else {
              console.error(
                `[Preview] ❌ Port is in use but server is not responding - this is a problem`
              );
              console.error(
                `[Preview] Possible zombie process or startup failure`
              );
            }
          }
        } else {
          console.log(`[Preview] ✅ No errors detected in logs`);
        }

        // Check if Vite reported ready
        console.log(`[Preview] 🔍 Checking if Vite reported ready...`);
        const viteReady = processInfo.logs.some(
          (log) =>
            log.type === 'stdout' &&
            (log.line.includes('ready in') || log.line.includes('Local:'))
        );

        if (viteReady) {
          console.log(
            `[Preview] ✅ Vite server reported ready in logs - good sign!`
          );
        } else {
          console.warn(
            `[Preview] ⚠️ Vite has not reported ready yet - compilation may still be in progress`
          );
          console.warn(
            `[Preview] Will proceed with health check but server might not be ready`
          );
        }
      }
    } else {
      console.log(
        `[Preview] ℹ️  Skipping log diagnostics (server already running or no process info)`
      );
    }

    console.log(`[Preview] 🏥 ========== FINAL HEALTH CHECK ==========`);
    console.log(`[Preview] Testing preview URL: ${previewUrl}`);
    console.log(
      `[Preview] Max attempts: ${HEALTH_CHECK_CONFIG.MAX_ATTEMPTS}, Interval: ${HEALTH_CHECK_CONFIG.INTERVAL_MS}ms`
    );
    const finalHealthStartTime = Date.now();
    const healthCheckResult = await checkPreviewHealth(previewUrl);
    const finalHealthDuration = Date.now() - finalHealthStartTime;

    if (!healthCheckResult.success) {
      console.error(
        `[Preview] ❌ HEALTH CHECK FAILED after ${(finalHealthDuration / 1000).toFixed(1)}s`
      );
      console.error(`[Preview] Error: ${healthCheckResult.error}`);
      console.error(
        `[Preview] The preview server is not responding to HTTP requests`
      );
      throw new PreviewHealthCheckError(
        healthCheckResult.error ?? 'Preview health check failed',
        { url: previewUrl }
      );
    }

    console.log(
      `[Preview] ✅ Health check passed in ${(finalHealthDuration / 1000).toFixed(1)}s`
    );

    const totalDuration = Date.now() - startTime;
    console.log(`[Preview] 🎉 ========== PREVIEW SERVER READY ==========`);
    console.log(`[Preview] Preview URL: ${previewUrl}`);
    console.log(`[Preview] Port: ${port}`);
    console.log(`[Preview] Total time: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`[Preview] Timestamp: ${new Date().toISOString()}`);

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
    const totalDuration = Date.now() - startTime;
    console.error(`[Preview] ❌ ========== PREVIEW START FAILED ==========`);
    console.error(
      `[Preview] Failed after ${(totalDuration / 1000).toFixed(1)}s`
    );
    console.error(`[Preview] Error:`, error);
    console.error(
      `[Preview] Error type:`,
      error?.constructor?.name ?? 'Unknown'
    );
    console.error(
      `[Preview] Error message:`,
      error instanceof Error ? error.message : 'Unknown error'
    );

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

    // Get last 100 log lines (most recent)
    const MAX_RETURN_LOGS = 100;
    const recentLogs = processInfo.logs.slice(-MAX_RETURN_LOGS);

    // Format logs with timestamps
    const formattedLogs = recentLogs
      .map((entry) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const prefix = entry.type === 'stderr' ? '[ERROR]' : '[INFO]';
        return `${timestamp} ${prefix} ${entry.line}`;
      })
      .join('\n');

    // Count stderr vs stdout lines
    const stderrCount = recentLogs.filter((e) => e.type === 'stderr').length;
    const stdoutCount = recentLogs.filter((e) => e.type === 'stdout').length;

    // Build summary header
    const header = [
      `=== Preview Server Logs ===`,
      `PID: ${processInfo.pid}`,
      `Port: ${processInfo.port}`,
      `Total logs: ${processInfo.logs.length} (showing last ${recentLogs.length})`,
      `Stdout: ${stdoutCount} lines | Stderr: ${stderrCount} lines`,
      `Last activity: ${new Date(processInfo.lastActivity).toISOString()}`,
      `=========================\n`,
    ].join('\n');

    const fullOutput = header + formattedLogs;

    return {
      success: true,
      data: fullOutput || 'No logs captured yet',
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
    const port = getFrameworkPort(); // Get the port (5173 for Vite)

    console.log(`[Preview] 🛑 Stopping any processes on port ${port}...`);

    // Find and kill any process using the port
    // Try multiple methods to ensure compatibility across different environments
    // 1. fuser (most common in containers)
    // 2. lsof (if available)
    // 3. pkill by name pattern
    const killCommand = `
      (fuser -k -9 ${port}/tcp 2>/dev/null || true) && \
      (lsof -ti:${port} 2>/dev/null | xargs -r kill -9 2>/dev/null || true) && \
      (pkill -9 -f 'vite.*${port}' 2>/dev/null || true)
    `.trim();

    const result = await sandbox.commands.run(killCommand, {
      timeoutMs: 5000,
    });

    console.log(`[Preview] Kill command output:`, {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    });

    // Clean up from in-memory map (if it exists)
    const processInfo = previewProcesses.get(sandbox.sandboxId);
    if (processInfo) {
      previewProcesses.delete(sandbox.sandboxId);
      console.log(
        `[Preview] Cleaned up process from cache (PID: ${processInfo.pid})`
      );
    }

    // Give the OS a moment to release the port
    await new Promise((resolve) => setTimeout(resolve, 500));

    console.log(`[Preview] ✅ Port ${port} cleared`);

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
  sandboxId?: string
): Promise<ServiceResult<PreviewResult>> {
  console.log(`[Preview] 🔄 ========== RESTART PREVIEW SERVER ==========`);
  console.log(`[Preview] Project ID: ${projectId}`);
  console.log(`[Preview] Sandbox ID: ${sandboxId ?? 'unknown'}`);
  console.log(`[Preview] E2B Sandbox ID: ${sandbox.sandboxId}`);
  console.log(`[Preview] Timestamp: ${new Date().toISOString()}`);

  console.log(`[Preview] Step 1: Stopping existing server...`);
  const stopStartTime = Date.now();
  await stopPreviewServer(sandbox);
  const stopDuration = Date.now() - stopStartTime;
  console.log(`[Preview] ✅ Server stopped successfully (${stopDuration}ms)`);

  console.log(`[Preview] Step 2: Starting new server with force restart...`);
  const startStartTime = Date.now();
  const result = await startPreviewServer(
    sandbox,
    projectId,
    files,
    sandboxId,
    true // forceRestart=true to skip health check and start fresh
  );
  const startDuration = Date.now() - startStartTime;

  if (result.success) {
    console.log(
      `[Preview] ✅ Server restarted successfully in ${(startDuration / 1000).toFixed(1)}s`
    );
    console.log(`[Preview] 🏁 ========== RESTART COMPLETE ==========`);
  } else {
    console.error(
      `[Preview] ❌ Server restart failed after ${(startDuration / 1000).toFixed(1)}s`
    );
    console.error(`[Preview] Error: ${result.error}`);
  }

  return result;
}
