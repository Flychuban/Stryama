/**
 * File Filtering Utilities
 *
 * Provides centralized logic for filtering infrastructure files from application files.
 * Infrastructure files (package.json, config files) should always be generated fresh
 * during preview regeneration and should not be stored in the database.
 */

import { logger } from '~/lib/utils/logger';

/**
 * File object structure returned from sandbox
 */
export type SandboxFile = {
  path: string;
  content: string;
  language: string;
};

/**
 * Infrastructure files that should NOT be saved to database.
 * These files are generated fresh on each preview regeneration.
 *
 * @constant
 */
export const INFRASTRUCTURE_FILES = [
  // Package managers
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  // Build tools
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'tsconfig.json',
  'tsconfig.node.json',
  // Next.js
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  // PostCSS & Tailwind
  'postcss.config.js',
  'postcss.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts',
  // Linters & formatters
  '.eslintrc.js',
  '.eslintrc.json',
  '.eslintrc.cjs',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  // Deployment configs
  'vercel.json',
  'netlify.toml',
] as const;

/**
 * Set of infrastructure files for O(1) lookup performance.
 * This is more efficient than array.includes() for filtering operations.
 *
 * @constant
 */
const INFRASTRUCTURE_FILES_SET = new Set<string>(INFRASTRUCTURE_FILES);

/**
 * Regex patterns for infrastructure files that follow naming conventions
 * Used to catch files like .env.local, .env.production, etc.
 */
const INFRASTRUCTURE_PATTERNS = [
  /^\.env(\..+)?$/, // .env, .env.local, .env.production, etc.
  /\.lock$/, // Any lock file
  /^\.eslintrc\./, // Any eslint config format
] as const;

/**
 * Type-safe check if a file path is an infrastructure file.
 * Checks both exact matches and pattern-based matches.
 *
 * @param filePath - File path to check (e.g., "package.json" or "src/package.json")
 * @returns True if the file is an infrastructure file
 */
export function isInfrastructureFile(filePath: string): boolean {
  // Extract basename from path (e.g., "src/config/package.json" -> "package.json")
  const basename = filePath.split('/').pop() ?? filePath;

  // Check exact matches (case-sensitive)
  if (INFRASTRUCTURE_FILES_SET.has(basename)) {
    return true;
  }

  // Check pattern matches
  return INFRASTRUCTURE_PATTERNS.some((pattern) => pattern.test(basename));
}

/**
 * Result of file filtering operation
 */
export type FileFilterResult = {
  /** Application files to be saved to database */
  filesToSave: SandboxFile[];
  /** Infrastructure files that were filtered out */
  skippedFiles: SandboxFile[];
  /** Number of files filtered out */
  filteredCount: number;
};

/**
 * Filters out infrastructure files from a list of files.
 *
 * Infrastructure files (package.json, config files) should always be generated
 * fresh during preview regeneration to ensure correct configuration. Application
 * files (src/*, index.html, etc.) are stored in the database.
 *
 * This function uses a single pass through the array for O(n) performance.
 *
 * @param files - Array of files from sandbox
 * @returns Object containing files to save, skipped files, and count
 *
 * @example
 * ```typescript
 * const result = filterApplicationFiles(allFiles);
 * logger.debug(`Saving ${result.filesToSave.length} files`);
 * logger.debug(`Skipped ${result.skippedFiles.length} infrastructure files`);
 * ```
 */
export function filterApplicationFiles(files: SandboxFile[]): FileFilterResult {
  const filesToSave: SandboxFile[] = [];
  const skippedFiles: SandboxFile[] = [];

  // Single pass through array for optimal performance
  for (const file of files) {
    if (isInfrastructureFile(file.path)) {
      skippedFiles.push(file);
    } else {
      filesToSave.push(file);
    }
  }

  return {
    filesToSave,
    skippedFiles,
    filteredCount: skippedFiles.length,
  };
}

/**
 * Logs file filtering results for debugging and monitoring.
 *
 * @param allFiles - Original array of all files
 * @param result - Result from filterApplicationFiles
 * @param logPrefix - Prefix for log messages (e.g., '[AI Router]', '[AI Stream]')
 */
export function logFilteringResults(
  allFiles: SandboxFile[],
  result: FileFilterResult,
  logPrefix: string
): void {
  logger.debug(
    `${logPrefix} ✅ Found ${allFiles.length} files in sandbox, filtered out ${result.filteredCount} infrastructure file(s)`
  );

  logger.debug(
    `${logPrefix} 📁 Saving ${result.filesToSave.length} application files to database:`,
    result.filesToSave.map((f) => f.path)
  );

  if (result.filteredCount > 0) {
    logger.debug(
      `${logPrefix} 🚫 Skipped infrastructure files (will be generated fresh):`,
      result.skippedFiles.map((f) => f.path)
    );
  }
}
