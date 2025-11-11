/**
 * File Saver Utility
 *
 * Centralized logic for saving generated files to database
 * Used by both generateCode mutation and streamGeneration subscription
 */

import type { PrismaClient } from '@prisma/client';
import type { Sandbox } from '@e2b/code-interpreter';
import { sandboxManager } from '../services/sandbox-manager';
import {
  filterApplicationFiles,
  logFilteringResults,
} from '~/lib/utils/file-filtering';

/**
 * File object structure
 */
export type GeneratedFile = {
  path: string;
  content: string;
  language: string;
};

/**
 * Save generated files to database
 *
 * Handles two scenarios:
 * 1. Files are provided directly (from Claude response)
 * 2. Files need to be read from sandbox (E2B mode with no files in response)
 *
 * @param db - Prisma database client
 * @param projectId - Project ID to save files to
 * @param sandboxInstance - Optional E2B sandbox instance to read files from
 * @param responseFiles - Files from Claude response (may be empty in E2B mode)
 * @param logPrefix - Prefix for console logs (e.g., '[AI Router]', '[AI Stream]')
 * @returns Promise that resolves when files are saved
 */
export async function saveGeneratedFilesToDatabase(
  db: PrismaClient,
  projectId: string,
  sandboxInstance: Sandbox | undefined,
  responseFiles: readonly GeneratedFile[],
  logPrefix: string
): Promise<void> {
  let filesToSave: GeneratedFile[] = [...responseFiles];

  // If using E2B mode and no files in response, read from sandbox
  if (sandboxInstance && responseFiles.length === 0) {
    console.log(
      `${logPrefix} 🔄 E2B mode: No files in response, reading from sandbox filesystem...`
    );

    const sandboxFilesResult =
      await sandboxManager.readAllFiles(sandboxInstance);

    if (sandboxFilesResult.success && sandboxFilesResult.data) {
      // Filter out infrastructure files using shared utility
      const allFiles = sandboxFilesResult.data;
      const filterResult = filterApplicationFiles(allFiles);

      // Update filesToSave with filtered results
      filesToSave = filterResult.filesToSave;

      // Log filtering results
      logFilteringResults(allFiles, filterResult, logPrefix);
    } else {
      console.error(
        `${logPrefix} ❌ Failed to read files from sandbox: ${sandboxFilesResult.error}`
      );
      // Don't throw - caller can decide how to handle this
      return;
    }
  } else if (responseFiles.length > 0) {
    console.log(
      `${logPrefix} ✅ Using ${responseFiles.length} files from Claude response`
    );
  }

  if (filesToSave.length === 0) {
    console.warn(
      `${logPrefix} ⚠️ No files to save to database - this may cause issues when regenerating preview`
    );
    return;
  }

  console.log(
    `${logPrefix} 💾 Saving ${filesToSave.length} file(s) to database for project ${projectId}`
  );

  // Use upsert to handle both creation and updates
  await Promise.all(
    filesToSave.map((file) =>
      db.file.upsert({
        where: {
          projectId_path: {
            projectId,
            path: file.path,
          },
        },
        create: {
          path: file.path,
          content: file.content,
          language: file.language,
          projectId,
        },
        update: {
          content: file.content,
          language: file.language,
          updatedAt: new Date(),
        },
      })
    )
  );

  console.log(
    `${logPrefix} ✅ Successfully saved ${filesToSave.length} file(s) to database:`,
    filesToSave.map((f) => `${f.path} (${f.language})`)
  );
}
