import type { Sandbox } from '@e2b/code-interpreter';
import type { File } from '@prisma/client';
import type { ServiceResult } from '../../types';
import {
  generatePackageJson,
  generateConfigFiles,
  generateShadcnUtilities,
} from '../../utils/package-generator';
import {
  detectDependencies,
  logDetectedDependencies,
} from '../../utils/dependency-detector';
import { logger } from '~/lib/utils/logger';

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

    logger.debug(
      `[Preview] Setting up React+Vite infrastructure files (package.json, configs)`
    );

    const checkPackageJson = await sandbox.commands.run(
      `test -f ${workDir}/package.json && echo "exists" || echo "missing"`
    );
    const packageJsonExists = checkPackageJson.stdout.trim() === 'exists';

    if (!packageJsonExists) {
      logger.debug('[Preview] Creating package.json');

      let detectedDeps = { dependencies: {}, devDependencies: {} };
      if (files && files.length > 0) {
        logger.debug(
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
      logger.debug('[Preview] package.json already exists, skipping');
    }

    const configFiles = generateConfigFiles();

    for (const [filename, content] of Object.entries(configFiles)) {
      const checkConfig = await sandbox.commands.run(
        `test -f ${workDir}/${filename} && echo "exists" || echo "missing"`
      );
      const configExists = checkConfig.stdout.trim() === 'exists';

      if (!configExists) {
        logger.debug(`[Preview] Creating ${filename}`);
        await sandbox.files.write(`${workDir}/${filename}`, content);
      } else {
        logger.debug(`[Preview] ${filename} already exists, skipping`);
      }
    }

    logger.debug('[Preview] Setting up Shadcn utilities');
    const shadcnUtils = generateShadcnUtilities();

    for (const [filepath, content] of Object.entries(shadcnUtils)) {
      const checkFile = await sandbox.commands.run(
        `test -f ${workDir}/${filepath} && echo "exists" || echo "missing"`
      );
      const fileExists = checkFile.stdout.trim() === 'exists';

      if (!fileExists) {
        logger.debug(`[Preview] Creating ${filepath}`);
        await sandbox.files.write(`${workDir}/${filepath}`, content);
      } else {
        logger.debug(`[Preview] ${filepath} already exists, skipping`);
      }
    }

    logger.debug(
      '[Preview] ✅ Infrastructure setup complete - ready for Claude to generate application files'
    );

    return {
      success: true,
      data: true,
      error: null,
    };
  } catch (error) {
    logger.error('[Preview] Failed to setup infrastructure:', error);
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
export async function ensureNpmAvailable(
  sandbox: Sandbox
): Promise<ServiceResult<boolean>> {
  try {
    logger.debug('[Preview] 🔍 Checking npm availability...');

    const npmCheck = await sandbox.commands.run(
      'cd /project && npm --version',
      { timeoutMs: 10000 }
    );

    if (npmCheck.exitCode !== 0) {
      logger.error(
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
    logger.debug(`[Preview] ✅ npm is available and executable: v${version}`);

    return {
      success: true,
      data: true,
      error: null,
    };
  } catch (error) {
    logger.error('[Preview] Failed to check npm availability:', error);
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
export async function installDependencies(
  sandbox: Sandbox
): Promise<ServiceResult<boolean>> {
  try {
    const workDir = '/project';

    const npmCheckResult = await ensureNpmAvailable(sandbox);

    if (!npmCheckResult.success) {
      logger.error(
        '[Preview] ❌ Cannot install dependencies - npm not available:',
        npmCheckResult.error
      );
      return {
        success: false,
        data: false,
        error: npmCheckResult.error ?? 'npm command not found in sandbox',
      };
    }

    logger.debug(
      '[Preview] 📦 Installing dependencies (this may take 5-10 minutes for large projects)...'
    );

    const startTime = Date.now();

    const installResult = await sandbox.commands.run(
      `cd ${workDir} && npm install`,
      {
        timeoutMs: 600000,
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (installResult.exitCode !== 0) {
      logger.error(
        `[Preview] npm install failed (exit code ${installResult.exitCode}):`,
        installResult.stderr || installResult.stdout
      );
      return {
        success: false,
        data: false,
        error: `npm install failed (exit ${installResult.exitCode}): ${installResult.stderr || installResult.stdout}`,
      };
    }

    logger.debug(
      `[Preview] ✅ Dependencies installed successfully in ${duration}s`
    );

    return {
      success: true,
      data: true,
      error: null,
    };
  } catch (error) {
    logger.error('[Preview] Failed to install dependencies:', error);

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
