import type { Sandbox as E2BSandbox } from '@e2b/code-interpreter';
import JSZip from 'jszip';
import { NETLIFY_CONFIG } from '../config';
import {
  NetlifyBuildError,
  NetlifyBuildTooLargeError,
  NetlifyConfigError,
} from '../errors';
import type { BuildArtifacts, Framework, FrameworkBuildConfig } from '../types';
import { logger } from '~/lib/utils/logger';

/**
 * Framework build configurations
 */
const FRAMEWORK_BUILD_CONFIGS: Record<Framework, FrameworkBuildConfig> = {
  vite: {
    command: 'npm run build',
    outputDir: '/project/dist',
    name: 'Vite',
  },
  nextjs: {
    command: 'npm run build && npx next export',
    outputDir: '/project/out',
    name: 'Next.js',
  },
  react: {
    command: 'npm run build',
    outputDir: '/project/build',
    name: 'React (CRA)',
  },
  static: {
    command: 'echo "Static project, no build needed"',
    outputDir: '/project',
    name: 'Static',
  },
};

/**
 * NetlifyBuildService - Handles building static files from E2B sandbox
 */
export class NetlifyBuildService {
  /**
   * Build project from E2B sandbox
   *
   * CRITICAL: Uses sandbox.commands.run(), not sandbox.process.start()
   *
   * @param sandbox - Connected E2B sandbox instance
   * @param projectId - Project ID for logging/tracking
   * @returns Build artifacts (files, size, count)
   */
  static async buildFromSandbox(
    sandbox: E2BSandbox,
    projectId: string
  ): Promise<BuildArtifacts> {
    logger.debug(`[Netlify Build] Starting build for project ${projectId}...`);
    const buildStartTime = Date.now();

    try {
      // Step 1: Detect framework
      const framework = await this.detectFramework(sandbox);
      logger.debug(`[Netlify Build] Detected framework: ${framework}`);

      // Step 2: Run build command
      const buildDir = await this.runBuild(sandbox, framework);
      const buildDuration = Date.now() - buildStartTime;
      logger.debug(
        `[Netlify Build] Build completed in ${(buildDuration / 1000).toFixed(1)}s`
      );

      // Step 3: Collect files from build output
      const artifacts = await this.collectBuildFiles(sandbox, buildDir);
      logger.debug(
        `[Netlify Build] Collected ${artifacts.fileCount} files (${(artifacts.totalSize / 1024 / 1024).toFixed(2)}MB)`
      );

      // Step 4: Validate total size
      if (artifacts.totalSize > NETLIFY_CONFIG.deployment.maxBuildSize) {
        throw new NetlifyBuildTooLargeError(
          artifacts.totalSize,
          NETLIFY_CONFIG.deployment.maxBuildSize
        );
      }

      return artifacts;
    } catch (error) {
      const buildDuration = Date.now() - buildStartTime;
      logger.error(
        `[Netlify Build] Build failed after ${(buildDuration / 1000).toFixed(1)}s:`,
        error
      );
      throw error;
    }
  }

  /**
   * Detect framework from package.json in sandbox
   *
   * @param sandbox - E2B sandbox instance
   * @returns Detected framework type
   */
  private static async detectFramework(
    sandbox: E2BSandbox
  ): Promise<Framework> {
    try {
      logger.debug('[Netlify Build] Reading package.json...');

      // Read package.json from /project directory (matches file-sync location)
      const packageJsonContent = await sandbox.files.read(
        `${NETLIFY_CONFIG.build.workDir}/package.json`
      );

      const packageJson = JSON.parse(packageJsonContent) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      logger.debug(
        '[Netlify Build] Package.json dependencies:',
        Object.keys(packageJson.dependencies ?? {}).join(', ')
      );

      // Detect Next.js
      if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
        return 'nextjs';
      }

      // Detect Vite
      if (packageJson.dependencies?.vite || packageJson.devDependencies?.vite) {
        return 'vite';
      }

      // Detect React (create-react-app)
      if (
        packageJson.dependencies?.['react-scripts'] ||
        packageJson.devDependencies?.['react-scripts']
      ) {
        return 'react';
      }

      // Default to static
      logger.warn('[Netlify Build] No framework detected, treating as static');
      return 'static';
    } catch (error) {
      logger.error('[Netlify Build] Failed to detect framework:', error);
      throw new NetlifyConfigError(
        'Failed to read package.json. Ensure your project has a valid package.json file.',
        { error }
      );
    }
  }

  /**
   * Run build command in sandbox
   *
   * @param sandbox - E2B sandbox instance
   * @param framework - Detected framework
   * @returns Path to build output directory
   */
  private static async runBuild(
    sandbox: E2BSandbox,
    framework: Framework
  ): Promise<string> {
    const config = FRAMEWORK_BUILD_CONFIGS[framework];

    if (!config) {
      throw new NetlifyConfigError(`Unsupported framework: ${framework}`);
    }

    logger.debug(
      `[Netlify Build] Running ${config.name} build command: ${config.command}`
    );

    // CRITICAL: Use commands.run with proper timeout
    // This executes the command and waits for completion
    const buildCommand = `cd ${NETLIFY_CONFIG.build.workDir} && ${config.command}`;

    const result = await sandbox.commands.run(buildCommand, {
      timeoutMs: NETLIFY_CONFIG.build.timeoutMs,
    });

    if (result.exitCode !== 0) {
      logger.error('[Netlify Build] Build failed:', result.stderr);
      logger.error('[Netlify Build] Build stdout:', result.stdout);

      // Extract meaningful error message
      const errorMessage = result.stderr || result.stdout || 'Unknown error';
      const firstErrorLine = errorMessage
        .split('\n')
        .find((line) => line.toLowerCase().includes('error'));

      throw new NetlifyBuildError(
        `Build failed: ${firstErrorLine ?? errorMessage.substring(0, 200)}`,
        {
          exitCode: result.exitCode,
          stderr: result.stderr,
          stdout: result.stdout,
        }
      );
    }

    logger.debug('[Netlify Build] Build command completed successfully');

    return config.outputDir;
  }

  /**
   * Collect all files from build output directory
   *
   * @param sandbox - E2B sandbox instance
   * @param buildDir - Path to build output directory
   * @returns Build artifacts with files and metadata
   */
  private static async collectBuildFiles(
    sandbox: E2BSandbox,
    buildDir: string
  ): Promise<BuildArtifacts> {
    const files = new Map<string, string>();
    let totalSize = 0;

    logger.debug(`[Netlify Build] Collecting files from ${buildDir}...`);

    try {
      // List all files in build directory using find command
      // Exclude node_modules and .git directories
      const listCommand = `find ${buildDir} -type f -not -path '*/node_modules/*' -not -path '*/.git/*'`;

      const listResult = await sandbox.commands.run(listCommand, {
        timeoutMs: 30000, // 30 seconds to list files
      });

      if (listResult.exitCode !== 0) {
        throw new NetlifyBuildError(
          'Failed to list build files. Build directory may not exist.',
          { stderr: listResult.stderr, buildDir }
        );
      }

      // Parse file paths from output
      const filePaths = listResult.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (filePaths.length === 0) {
        throw new NetlifyBuildError(
          'No files found in build output. Build may have failed.',
          { buildDir }
        );
      }

      logger.debug(
        `[Netlify Build] Found ${filePaths.length} files to collect`
      );

      // Read each file and add to collection
      let skippedFiles = 0;
      for (const absolutePath of filePaths) {
        try {
          const content = await sandbox.files.read(absolutePath);
          const size = Buffer.byteLength(content, 'utf8');

          // Skip files that exceed individual file size limit
          if (size > NETLIFY_CONFIG.deployment.maxFileSize) {
            logger.warn(
              `[Netlify Build] Skipping large file: ${absolutePath} (${(size / 1024 / 1024).toFixed(2)}MB)`
            );
            skippedFiles++;
            continue;
          }

          // Convert to relative path (remove buildDir prefix)
          const relativePath = absolutePath.replace(buildDir + '/', '');

          // Store file with relative path
          files.set(relativePath, content);
          totalSize += size;
        } catch (error) {
          logger.warn(
            `[Netlify Build] Failed to read file: ${absolutePath}`,
            error
          );
          // Continue with other files instead of failing
        }
      }

      if (skippedFiles > 0) {
        logger.warn(
          `[Netlify Build] Skipped ${skippedFiles} large files (>10MB each)`
        );
      }

      if (files.size === 0) {
        throw new NetlifyBuildError(
          'No valid files collected from build output',
          { buildDir }
        );
      }

      return {
        files,
        totalSize,
        fileCount: files.size,
      };
    } catch (error) {
      if (error instanceof NetlifyBuildError) {
        throw error;
      }
      throw new NetlifyBuildError('Failed to collect build files', { error });
    }
  }

  /**
   * Create ZIP archive from build artifacts
   *
   * Uses jszip library (already installed in dependencies)
   *
   * @param artifacts - Build artifacts to archive
   * @returns ZIP file as Buffer
   */
  static async createZipArchive(artifacts: BuildArtifacts): Promise<Buffer> {
    logger.debug(
      `[Netlify Build] Creating ZIP archive from ${artifacts.fileCount} files...`
    );
    const zipStartTime = Date.now();

    try {
      const zip = new JSZip();

      // Add each file to the archive
      for (const [path, content] of artifacts.files) {
        zip.file(path, content);
      }

      // Generate ZIP with maximum compression
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }, // Maximum compression
      });

      const zipDuration = Date.now() - zipStartTime;
      logger.debug(
        `[Netlify Build] ZIP created in ${(zipDuration / 1000).toFixed(1)}s (${(zipBuffer.length / 1024 / 1024).toFixed(2)}MB compressed)`
      );

      return zipBuffer;
    } catch (error) {
      logger.error('[Netlify Build] Failed to create ZIP archive:', error);
      throw new NetlifyBuildError('Failed to create ZIP archive', { error });
    }
  }

  /**
   * Validate build artifacts before deployment
   *
   * @param artifacts - Build artifacts to validate
   * @throws NetlifyBuildTooLargeError if size exceeds limits
   */
  static validateArtifacts(artifacts: BuildArtifacts): void {
    // Check total size
    if (artifacts.totalSize > NETLIFY_CONFIG.deployment.maxBuildSize) {
      throw new NetlifyBuildTooLargeError(
        artifacts.totalSize,
        NETLIFY_CONFIG.deployment.maxBuildSize
      );
    }

    // Check file count (sanity check)
    if (artifacts.fileCount === 0) {
      throw new NetlifyBuildError('No files in build artifacts');
    }

    logger.debug('[Netlify Build] Artifacts validation passed');
  }
}
