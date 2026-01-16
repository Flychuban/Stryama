import type { Sandbox } from '@e2b/code-interpreter';
import type { File } from '@prisma/client';
import type { ServiceResult, PreviewResult } from '../../types';
import type { LogEntry, PreviewProcessInfo } from './types';
import { getFrameworkPort } from '../../utils/framework-detector';
import {
  PreviewTimeoutError,
  PreviewHealthCheckError,
  PreviewServerStartError,
} from '../../errors';
import { logger } from '~/lib/utils/logger';

import { HEALTH_CHECK_CONFIG, MAX_LOG_LINES, previewProcesses } from './config';
import { cleanupPortWithVerification } from './port';
import {
  isPreviewHealthy,
  checkPreviewHealth,
  getServerDiagnostics,
} from './health';
import { setupInfrastructure, installDependencies } from './setup';

export { isPreviewHealthy } from './health';
export { setupInfrastructure } from './setup';
export type { LogEntry, PreviewProcessInfo } from './types';

/**
 * Starts a preview development server in the E2B sandbox
 */
export async function startPreviewServer(
  sandbox: Sandbox,
  projectId: string,
  files: readonly File[],
  sandboxId?: string,
  forceRestart = false
): Promise<ServiceResult<PreviewResult>> {
  const startTime = Date.now();
  logger.debug(`[Preview] 🚀 ========== START PREVIEW SERVER ==========`);
  logger.debug(`[Preview] Project ID: ${projectId}`);
  logger.debug(`[Preview] Sandbox ID: ${sandboxId ?? 'unknown'}`);
  logger.debug(`[Preview] E2B Sandbox ID: ${sandbox.sandboxId}`);
  logger.debug(`[Preview] Files provided: ${files.length}`);
  logger.debug(`[Preview] Timestamp: ${new Date().toISOString()}`);

  try {
    const port = getFrameworkPort();
    const command = 'npm run dev';

    logger.debug(
      `[Preview] 🔧 Configuration: port=${port}, command="${command}"`
    );

    const workDir = '/project';
    logger.debug(`[Preview] Working directory: ${workDir}`);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new PreviewServerStartError(
        `Invalid port number: ${port}. Port must be an integer between 1 and 65535.`,
        { projectId, port }
      );
    }

    const host = sandbox.getHost(port);
    const previewUrl = `https://${host}`;
    let serverAlreadyRunning = false;

    if (!forceRestart) {
      logger.debug(
        `[Preview] 🌐 ========== CHECKING EXISTING SERVER ==========`
      );
      logger.debug(`[Preview] 🔍 Testing HTTP endpoint for existing server...`);
      logger.debug(`[Preview] Preview URL: ${previewUrl}`);
      logger.debug(`[Preview] Host: ${host}`);
      logger.debug(`[Preview] Port: ${port}`);

      const maxRetries = 5;
      const delays = [1000, 1500, 2000, 2000, 1500];
      logger.debug(
        `[Preview] Will perform ${maxRetries} health checks over ${delays.reduce((a, b) => a + b, 0) / 1000}s`
      );

      const healthCheckStartTime = Date.now();
      for (let i = 0; i < maxRetries; i++) {
        logger.debug(
          `[Preview] 🔍 Health check attempt ${i + 1}/${maxRetries}...`
        );
        const checkStartTime = Date.now();
        const isHealthy = await isPreviewHealthy(previewUrl);
        const checkDuration = Date.now() - checkStartTime;

        logger.debug(
          `[Preview] Health check ${i + 1} result: ${isHealthy ? '✅ HEALTHY' : '❌ NOT HEALTHY'} (${checkDuration}ms)`
        );

        if (isHealthy) {
          const totalCheckTime = Date.now() - healthCheckStartTime;
          logger.debug(
            `[Preview] ✅ Dev server is already running and responding!`
          );
          logger.debug(
            `[Preview] Found existing server after ${i + 1} attempts in ${totalCheckTime}ms`
          );
          serverAlreadyRunning = true;
          break;
        }

        if (i < maxRetries - 1) {
          const delay = delays[i];
          logger.debug(
            `[Preview] ⏳ Server not responding, waiting ${delay}ms before retry ${i + 2}/${maxRetries}...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          logger.debug(
            `[Preview] ❌ Server not responding after ${maxRetries} attempts`
          );
        }
      }

      const totalHealthCheckTime = Date.now() - healthCheckStartTime;
      logger.debug(
        `[Preview] 🏁 HTTP check completed in ${totalHealthCheckTime}ms: ${serverAlreadyRunning ? '✅ SERVER RUNNING' : '❌ NO SERVER'}`
      );
    } else {
      logger.debug(
        `[Preview] ⚡ FORCE RESTART mode - performing robust port cleanup before starting fresh server`
      );

      const portCleanupStartTime = Date.now();
      const portIsFree = await cleanupPortWithVerification(sandbox, port, 5000);
      const portCleanupDuration = Date.now() - portCleanupStartTime;

      if (!portIsFree) {
        logger.error(
          `[Preview] ❌ Failed to free port ${port} after ${portCleanupDuration}ms`
        );
        throw new PreviewServerStartError(
          `Port ${port} is still in use after cleanup. The previous dev server may not have terminated properly. Try again in a few seconds.`,
          { projectId, port }
        );
      }

      logger.debug(
        `[Preview] ✅ Port ${port} cleanup complete in ${portCleanupDuration}ms`
      );
    }

    if (serverAlreadyRunning) {
      const totalDuration = Date.now() - startTime;
      logger.debug(`[Preview] ✅ ========== SERVER ALREADY RUNNING ==========`);
      logger.debug(
        `[Preview] Skipping infrastructure setup and dev server start`
      );
      logger.debug(`[Preview] Total time: ${totalDuration}ms`);
      logger.debug(`[Preview] Returning existing server URL: ${previewUrl}`);
    } else {
      logger.debug(`[Preview] 🔧 ========== SETTING UP NEW SERVER ==========`);
      logger.debug(
        `[Preview] No existing server found, will set up infrastructure and start dev server`
      );

      logger.debug(
        `[Preview] 🧹 Cleaning up any zombie processes on port ${port}...`
      );
      const cleanupStartTime = Date.now();
      const portCleared = await cleanupPortWithVerification(
        sandbox,
        port,
        3000
      );
      const cleanupDuration = Date.now() - cleanupStartTime;

      if (portCleared) {
        logger.debug(
          `[Preview] ✅ Port ${port} cleared in ${cleanupDuration}ms`
        );
      } else {
        logger.debug(
          `[Preview] ⚠️ Port ${port} may still have stale processes (${cleanupDuration}ms)`
        );
      }

      logger.debug(`[Preview] 🔍 Checking if node_modules already exists...`);
      const checkStartTime = Date.now();
      const checkNodeModules = await sandbox.commands.run(
        `test -d ${workDir}/node_modules && test -n "$(ls -A ${workDir}/node_modules 2>/dev/null)" && echo "exists" || echo "missing"`,
        { timeoutMs: 5000 }
      );
      const checkDuration = Date.now() - checkStartTime;
      const nodeModulesExists = checkNodeModules.stdout.trim() === 'exists';
      logger.debug(
        `[Preview] node_modules check (${checkDuration}ms): ${nodeModulesExists ? '✅ EXISTS' : '❌ MISSING'}`
      );

      if (nodeModulesExists) {
        logger.debug(
          `[Preview] ✅ Dependencies already installed - skipping setup`
        );
        logger.debug(
          `[Preview] This is likely a resumed sandbox with existing state`
        );
      } else {
        logger.debug(
          `[Preview] 📦 ========== INSTALLING DEPENDENCIES ==========`
        );
        logger.debug(
          `[Preview] Dependencies not found or invalid, running full setup...`
        );

        logger.debug(
          `[Preview] 🏗️  Step 1: Setting up infrastructure files...`
        );
        const infraStartTime = Date.now();
        const setupResult = await setupInfrastructure(
          sandbox,
          projectId,
          files
        );
        const infraDuration = Date.now() - infraStartTime;

        if (!setupResult.success) {
          logger.error(
            `[Preview] ❌ Infrastructure setup failed after ${infraDuration}ms: ${setupResult.error}`
          );
          throw new PreviewServerStartError(
            `Failed to setup infrastructure: ${setupResult.error}`,
            { projectId }
          );
        }
        logger.debug(
          `[Preview] ✅ Infrastructure setup complete (${infraDuration}ms)`
        );

        logger.debug(`[Preview] 📦 Step 2: Installing npm dependencies...`);
        const installStartTime = Date.now();
        const installResult = await installDependencies(sandbox);
        const installDuration = Date.now() - installStartTime;

        if (!installResult.success) {
          logger.error(
            `[Preview] ❌ npm install failed after ${(installDuration / 1000).toFixed(1)}s: ${installResult.error}`
          );
          throw new PreviewServerStartError(
            `Failed to install dependencies: ${installResult.error}`,
            { projectId }
          );
        }
        logger.debug(
          `[Preview] ✅ Dependencies installed successfully (${(installDuration / 1000).toFixed(1)}s)`
        );
      }

      logger.debug(`[Preview] 🚀 ========== STARTING DEV SERVER ==========`);
      logger.debug(`[Preview] Command: ${command}`);
      logger.debug(`[Preview] Port: ${port}`);
      logger.debug(`[Preview] Working directory: ${workDir}`);

      const processInfo: PreviewProcessInfo = {
        pid: 0,
        port: port,
        logs: [],
        lastActivity: Date.now(),
      };

      logger.debug(
        `[Preview] 📝 Registering process info for sandbox ${sandbox.sandboxId}`
      );
      previewProcesses.set(sandbox.sandboxId, processInfo);

      let logLineCount = 0;
      const MAX_INITIAL_LOGS = 20;
      logger.debug(
        `[Preview] 📊 Will log first ${MAX_INITIAL_LOGS} stdout lines and all stderr to console`
      );

      logger.debug(
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

              processInfo.logs.push(entry);
              if (processInfo.logs.length > MAX_LOG_LINES) {
                processInfo.logs.shift();
              }

              processInfo.lastActivity = Date.now();

              if (logLineCount < MAX_INITIAL_LOGS) {
                logger.debug(`[Preview] [stdout] ${line}`);
                logLineCount++;
                if (logLineCount === MAX_INITIAL_LOGS) {
                  logger.debug(
                    `[Preview] (reached max initial logs, suppressing further stdout unless important)`
                  );
                }
              }

              if (line.includes('ready in') || line.includes('Local:')) {
                logger.debug(`[Preview] ✅ 🎉 Vite server ready: ${line}`);
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

              processInfo.logs.push(entry);
              if (processInfo.logs.length > MAX_LOG_LINES) {
                processInfo.logs.shift();
              }

              processInfo.lastActivity = Date.now();

              logger.error(`[Preview] [stderr] ${line}`);

              if (
                line.toLowerCase().includes('error') &&
                !line.includes('0 error')
              ) {
                logger.error(
                  `[Preview] ❌ 🚨 Compilation error detected: ${line}`
                );
              }
            }
          },
        }
      );
      const processCreationDuration = Date.now() - processStartTime;

      processInfo.pid = process.pid;

      logger.debug(
        `[Preview] ✅ Dev server process spawned in ${processCreationDuration}ms`
      );
      logger.debug(`[Preview] Process PID: ${process.pid}`);
      logger.debug(`[Preview] Background: true`);
      logger.debug(`[Preview] Environment: CI=true, PORT=${port}`);
      logger.debug(
        `[Preview] Log capture active - storing last ${MAX_LOG_LINES} lines`
      );
    }

    logger.debug(
      `[Preview] 🔍 ========== VALIDATING SANDBOX & FILES ==========`
    );
    logger.debug(
      `[Preview] Running parallel checks: sandbox accessibility + file existence`
    );
    const validationStartTime = Date.now();

    let sandboxInfo;
    let indexHtmlExists: boolean;

    try {
      const [sandboxInfoResult, fileCheckResult] = await Promise.all([
        sandbox.getInfo(),
        sandbox.commands.run(
          `test -f ${workDir}/index.html && echo "exists" || echo "missing"`,
          { timeoutMs: 5000 }
        ),
      ]);

      sandboxInfo = sandboxInfoResult;
      indexHtmlExists = fileCheckResult.stdout.trim() === 'exists';

      const validationDuration = Date.now() - validationStartTime;
      logger.debug(
        `[Preview] ✅ Parallel validation completed in ${validationDuration}ms`
      );
      logger.debug(`[Preview] Sandbox - E2B ID: ${sandboxInfo.sandboxId}`);
      logger.debug(`[Preview] Sandbox - Status: running`);
      logger.debug(
        `[Preview] Files - index.html: ${indexHtmlExists ? '✅ EXISTS' : '❌ MISSING'}`
      );
    } catch (error) {
      const validationDuration = Date.now() - validationStartTime;
      logger.error(
        `[Preview] ❌ Validation failed after ${validationDuration}ms`
      );
      logger.error(`[Preview] Error:`, error);
      throw new PreviewServerStartError(
        `Sandbox validation failed. The sandbox may have been destroyed or expired. Please try regenerating your code.\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { sandboxId: sandbox.sandboxId, projectId, error }
      );
    }

    logger.debug(`[Preview] 🌐 Preview URL: ${previewUrl}`);

    if (!indexHtmlExists) {
      logger.error(`[Preview] ❌ CRITICAL: index.html not found in ${workDir}`);
      logger.error(
        `[Preview] This indicates files were written to wrong sandbox or not written at all`
      );
      throw new PreviewServerStartError(
        'Application files not found in sandbox. index.html is missing. This usually means files were written to a different sandbox than the one being used for preview.',
        { sandboxId: sandbox.sandboxId, projectId }
      );
    }

    logger.debug(`[Preview] ✅ Application files validated`);

    logger.debug(`[Preview] 📊 ========== DEV SERVER DIAGNOSTICS ==========`);
    const processInfo = previewProcesses.get(sandbox.sandboxId);
    if (processInfo && !serverAlreadyRunning) {
      logger.debug(
        `[Preview] ⏳ Waiting 5s for dev server to produce output...`
      );
      const logWaitStartTime = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const logWaitDuration = Date.now() - logWaitStartTime;

      logger.debug(
        `[Preview] 📊 After ${(logWaitDuration / 1000).toFixed(1)}s wait:`
      );
      logger.debug(
        `[Preview] Total log lines captured: ${processInfo.logs.length}`
      );
      logger.debug(
        `[Preview] Last activity: ${new Date(processInfo.lastActivity).toISOString()}`
      );

      if (processInfo.logs.length === 0) {
        logger.error(
          `[Preview] ❌ WARNING: No output received from dev server after ${(logWaitDuration / 1000).toFixed(1)}s!`
        );
        logger.error(
          '[Preview] This may indicate the dev server failed to start or is hanging.'
        );
        logger.error(`[Preview] Process PID: ${processInfo.pid}`);
        logger.error(
          `[Preview] This could be due to: missing dependencies, syntax errors, or npm issues`
        );
      } else {
        logger.debug(
          `[Preview] ✅ Received ${processInfo.logs.length} log lines from dev server`
        );
        const stdoutCount = processInfo.logs.filter(
          (log) => log.type === 'stdout'
        ).length;
        const stderrCount = processInfo.logs.filter(
          (log) => log.type === 'stderr'
        ).length;
        logger.debug(
          `[Preview] Breakdown: ${stdoutCount} stdout, ${stderrCount} stderr`
        );

        logger.debug(`[Preview] 🔍 Analyzing logs for errors...`);
        const errorLogs = processInfo.logs.filter(
          (log) =>
            log.type === 'stderr' &&
            log.line.toLowerCase().includes('error') &&
            !log.line.includes('0 error')
        );

        if (errorLogs.length > 0) {
          logger.error(
            `[Preview] ❌ Found ${errorLogs.length} error(s) in dev server logs (showing first 5):`
          );
          errorLogs.slice(0, 5).forEach((log, index) => {
            logger.error(`[Preview]   ${index + 1}. ${log.line}`);
          });

          const portInUseError = errorLogs.some(
            (log) =>
              log.line.toLowerCase().includes('port') &&
              log.line.toLowerCase().includes('already in use')
          );

          if (portInUseError) {
            logger.debug(
              `[Preview] 🔍 "Port already in use" detected - checking if another server is now responding...`
            );

            const recoveryWaitStartTime = Date.now();
            await new Promise((resolve) => setTimeout(resolve, 3000));
            const recoveryWaitDuration = Date.now() - recoveryWaitStartTime;

            logger.debug(
              `[Preview] Testing if other server is healthy (after ${recoveryWaitDuration}ms wait)...`
            );
            const isNowHealthy = await isPreviewHealthy(previewUrl);
            if (isNowHealthy) {
              logger.debug(
                `[Preview] ✅ Another dev server is running and responding - using that instead`
              );
              logger.debug(
                `[Preview] This is a race condition but we recovered successfully`
              );
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
              logger.error(
                `[Preview] ❌ Port is in use but server is not responding - this is a problem`
              );
              logger.error(
                `[Preview] Possible zombie process or startup failure`
              );
            }
          }
        } else {
          logger.debug(`[Preview] ✅ No errors detected in logs`);
        }

        logger.debug(`[Preview] 🔍 Checking if Vite reported ready...`);
        const viteReady = processInfo.logs.some(
          (log) =>
            log.type === 'stdout' &&
            (log.line.includes('ready in') || log.line.includes('Local:'))
        );

        if (viteReady) {
          logger.debug(
            `[Preview] ✅ Vite server reported ready in logs - good sign!`
          );
        } else {
          logger.warn(
            `[Preview] ⚠️ Vite has not reported ready yet - compilation may still be in progress`
          );
          logger.warn(
            `[Preview] Will proceed with health check but server might not be ready`
          );
        }
      }
    } else {
      logger.debug(
        `[Preview] ℹ️  Skipping log diagnostics (server already running or no process info)`
      );
    }

    logger.debug(`[Preview] 🏥 ========== FINAL HEALTH CHECK ==========`);
    logger.debug(`[Preview] Testing preview URL: ${previewUrl}`);
    logger.debug(
      `[Preview] Max attempts: ${HEALTH_CHECK_CONFIG.MAX_ATTEMPTS}, Interval: ${HEALTH_CHECK_CONFIG.INTERVAL_MS}ms`
    );
    const finalHealthStartTime = Date.now();
    const healthCheckResult = await checkPreviewHealth(previewUrl);
    const finalHealthDuration = Date.now() - finalHealthStartTime;

    if (!healthCheckResult.success) {
      logger.error(
        `[Preview] ❌ HEALTH CHECK FAILED after ${(finalHealthDuration / 1000).toFixed(1)}s`
      );
      logger.error(`[Preview] Error: ${healthCheckResult.error}`);
      logger.error(
        `[Preview] The preview server is not responding to HTTP requests`
      );

      logger.debug(`[Preview] 🔍 Running diagnostics to identify the issue...`);
      const diagnostics = await getServerDiagnostics(
        sandbox,
        sandbox.sandboxId,
        port
      );

      logger.error(`[Preview] 📊 Server Diagnostics:`);
      logger.error(
        `[Preview]   - Process PID: ${diagnostics.pid ?? 'unknown'}`
      );
      logger.error(
        `[Preview]   - Process Alive: ${diagnostics.processAlive ? '✅ YES' : '❌ NO (crashed or killed)'}`
      );
      logger.error(
        `[Preview]   - Port ${port} In Use: ${diagnostics.portInUse ? '✅ YES' : '❌ NO'}`
      );
      logger.error(
        `[Preview]   - Recent Logs: ${diagnostics.logs.length} lines`
      );

      if (!diagnostics.processAlive && diagnostics.pid) {
        logger.error(
          `[Preview] ⚠️ CRITICAL: Dev server process (PID ${diagnostics.pid}) has CRASHED or was killed!`
        );
      }

      if (!diagnostics.portInUse) {
        logger.error(
          `[Preview] ⚠️ Port ${port} is not in use - server may have failed to start or crashed`
        );
      }

      if (diagnostics.logs.length > 0) {
        logger.error(
          `[Preview] 📄 Last ${Math.min(10, diagnostics.logs.length)} log lines:`
        );
        const recentLogs = diagnostics.logs.slice(-10);
        for (const log of recentLogs) {
          const prefix = log.type === 'stderr' ? '❌' : 'ℹ️';
          logger.error(`[Preview]   ${prefix} [${log.type}] ${log.line}`);
        }
      } else {
        logger.error(
          `[Preview] ⚠️ No logs captured - server may not have started at all`
        );
      }

      throw new PreviewHealthCheckError(
        healthCheckResult.error ?? 'Preview health check failed',
        { url: previewUrl }
      );
    }

    logger.debug(
      `[Preview] ✅ Health check passed in ${(finalHealthDuration / 1000).toFixed(1)}s`
    );

    const totalDuration = Date.now() - startTime;
    logger.debug(`[Preview] 🎉 ========== PREVIEW SERVER READY ==========`);
    logger.debug(`[Preview] Preview URL: ${previewUrl}`);
    logger.debug(`[Preview] Port: ${port}`);
    logger.debug(`[Preview] Total time: ${(totalDuration / 1000).toFixed(1)}s`);
    logger.debug(`[Preview] Timestamp: ${new Date().toISOString()}`);

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
    logger.error(`[Preview] ❌ ========== PREVIEW START FAILED ==========`);
    logger.error(
      `[Preview] Failed after ${(totalDuration / 1000).toFixed(1)}s`
    );
    logger.error(`[Preview] Error:`, error);
    logger.error(
      `[Preview] Error type:`,
      error?.constructor?.name ?? 'Unknown'
    );
    logger.error(
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

    const MAX_RETURN_LOGS = 100;
    const recentLogs = processInfo.logs.slice(-MAX_RETURN_LOGS);

    const formattedLogs = recentLogs
      .map((entry) => {
        const timestamp = new Date(entry.timestamp).toISOString();
        const prefix = entry.type === 'stderr' ? '[ERROR]' : '[INFO]';
        return `${timestamp} ${prefix} ${entry.line}`;
      })
      .join('\n');

    const stderrCount = recentLogs.filter((e) => e.type === 'stderr').length;
    const stdoutCount = recentLogs.filter((e) => e.type === 'stdout').length;

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
    logger.error('[Preview] Failed to get preview logs:', error);
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
  const startTime = Date.now();
  const port = getFrameworkPort();

  logger.debug(`[Preview] 🛑 ========== STOP PREVIEW SERVER ==========`);
  logger.debug(`[Preview] Port: ${port}`);
  logger.debug(`[Preview] E2B Sandbox ID: ${sandbox.sandboxId}`);

  try {
    const processInfo = previewProcesses.get(sandbox.sandboxId);
    if (processInfo) {
      previewProcesses.delete(sandbox.sandboxId);
      logger.debug(
        `[Preview] Cleaned up process from cache (PID: ${processInfo.pid})`
      );
    }

    const portIsFree = await cleanupPortWithVerification(sandbox, port, 5000);

    const duration = Date.now() - startTime;

    if (!portIsFree) {
      logger.warn(
        `[Preview] ⚠️ Port ${port} may still be in use after ${duration}ms cleanup attempt`
      );
    } else {
      logger.debug(
        `[Preview] ✅ Port ${port} confirmed free after ${duration}ms`
      );
    }

    logger.debug(`[Preview] 🏁 ========== STOP COMPLETE ==========`);

    return {
      success: true,
      data: portIsFree,
      error: null,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      `[Preview] ❌ Failed to stop preview server after ${duration}ms:`,
      error
    );
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
  logger.debug(`[Preview] 🔄 ========== RESTART PREVIEW SERVER ==========`);
  logger.debug(`[Preview] Project ID: ${projectId}`);
  logger.debug(`[Preview] Sandbox ID: ${sandboxId ?? 'unknown'}`);
  logger.debug(`[Preview] E2B Sandbox ID: ${sandbox.sandboxId}`);
  logger.debug(`[Preview] Timestamp: ${new Date().toISOString()}`);

  const MAX_RESTART_ATTEMPTS = 3;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= MAX_RESTART_ATTEMPTS; attempt++) {
    logger.debug(
      `[Preview] 🔄 Restart attempt ${attempt}/${MAX_RESTART_ATTEMPTS}...`
    );

    logger.debug(`[Preview] Step 1: Stopping existing server...`);
    const stopStartTime = Date.now();
    await stopPreviewServer(sandbox);
    const stopDuration = Date.now() - stopStartTime;
    logger.debug(
      `[Preview] ✅ Server stopped successfully (${stopDuration}ms)`
    );

    logger.debug(`[Preview] Step 2: Starting new server with force restart...`);
    const startStartTime = Date.now();
    const result = await startPreviewServer(
      sandbox,
      projectId,
      files,
      sandboxId,
      true
    );
    const startDuration = Date.now() - startStartTime;

    if (result.success) {
      logger.debug(
        `[Preview] ✅ Server restarted successfully in ${(startDuration / 1000).toFixed(1)}s (attempt ${attempt})`
      );
      logger.debug(`[Preview] 🏁 ========== RESTART COMPLETE ==========`);
      return result;
    }

    const isPortInUseError =
      result.error?.toLowerCase().includes('port') &&
      result.error?.toLowerCase().includes('already in use');

    if (isPortInUseError && attempt < MAX_RESTART_ATTEMPTS) {
      logger.warn(
        `[Preview] ⚠️ Port still in use after stop (attempt ${attempt}), waiting and retrying...`
      );
      lastError = result.error ?? 'Port already in use';
      const waitTime = attempt * 2000;
      logger.debug(`[Preview] ⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      continue;
    }

    logger.error(
      `[Preview] ❌ Server restart failed after ${(startDuration / 1000).toFixed(1)}s`
    );
    logger.error(`[Preview] Error: ${result.error}`);
    return result;
  }

  logger.error(
    `[Preview] ❌ All ${MAX_RESTART_ATTEMPTS} restart attempts failed`
  );
  return {
    success: false,
    data: null,
    error: `Failed to restart after ${MAX_RESTART_ATTEMPTS} attempts. Last error: ${lastError}`,
  };
}
