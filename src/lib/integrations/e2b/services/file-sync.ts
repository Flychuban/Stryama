import type { File, PrismaClient } from '@prisma/client';
import type { Sandbox as E2BSandbox } from '@e2b/code-interpreter';
import type {
  ServiceResult,
  SyncResult,
  FailedFile,
  SyncMetadata,
} from '../types';
import { FileValidator } from '../utils/file-validator';
import { withRetry } from '../errors/retry-handler';
import { E2BSandboxError, E2BErrorType } from '../errors';

type E2BWriteEntry = {
  path: string;
  data: string;
};

export class FileSync {
  static async syncAllFiles(
    sandboxInstance: E2BSandbox,
    sandboxId: string,
    projectId: string,
    db: PrismaClient
  ): Promise<ServiceResult<SyncResult>> {
    const startTime = Date.now();

    try {
      // Fetch files excluding build artifacts (.next, node_modules, etc.)
      const files = await db.file.findMany({
        where: {
          projectId,
          NOT: [
            { path: { startsWith: '.next/' } },
            { path: { startsWith: 'node_modules/' } },
            { path: { startsWith: 'dist/' } },
            { path: { startsWith: 'build/' } },
            { path: { startsWith: '.cache/' } },
          ],
        },
        orderBy: {
          path: 'asc',
        },
      });

      if (files.length === 0) {
        return {
          success: true,
          data: {
            totalFiles: 0,
            syncedFiles: 0,
            failedFiles: [],
            duration: Date.now() - startTime,
            timestamp: new Date(),
          },
          error: null,
        };
      }

      // File validation removed - E2B sandboxes are already isolated
      // Trust E2B's sandbox environment to handle code execution safely

      const syncResult = await this.syncFilesToSandbox(
        sandboxInstance,
        files,
        sandboxId,
        db
      );

      return {
        success: syncResult.failedFiles.length === 0,
        data: {
          ...syncResult,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        },
        error:
          syncResult.failedFiles.length > 0
            ? `Failed to sync ${syncResult.failedFiles.length} file(s)`
            : null,
      };
    } catch (error) {
      console.error('[FileSync] Error syncing all files:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Unknown error during sync',
      };
    }
  }

  static async syncIncrementalFiles(
    sandboxInstance: E2BSandbox,
    sandboxId: string,
    fileIds: string[],
    db: PrismaClient
  ): Promise<ServiceResult<SyncResult>> {
    const startTime = Date.now();

    try {
      const files = await db.file.findMany({
        where: {
          id: {
            in: fileIds,
          },
        },
      });

      if (files.length === 0) {
        return {
          success: true,
          data: {
            totalFiles: 0,
            syncedFiles: 0,
            failedFiles: [],
            duration: Date.now() - startTime,
            timestamp: new Date(),
          },
          error: null,
        };
      }

      // File validation removed - E2B sandboxes are already isolated
      // Trust E2B's sandbox environment to handle code execution safely

      const syncResult = await this.syncFilesToSandbox(
        sandboxInstance,
        files,
        sandboxId,
        db
      );

      return {
        success: syncResult.failedFiles.length === 0,
        data: {
          ...syncResult,
          duration: Date.now() - startTime,
          timestamp: new Date(),
        },
        error:
          syncResult.failedFiles.length > 0
            ? `Failed to sync ${syncResult.failedFiles.length} file(s)`
            : null,
      };
    } catch (error) {
      console.error('[FileSync] Error syncing incremental files:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Unknown error during sync',
      };
    }
  }

  static async syncChangedFiles(
    sandboxInstance: E2BSandbox,
    sandboxId: string,
    projectId: string,
    db: PrismaClient
  ): Promise<ServiceResult<SyncResult>> {
    try {
      const sandbox = await db.sandbox.findUnique({
        where: { id: sandboxId },
      });

      if (!sandbox) {
        throw new E2BSandboxError(
          'Sandbox not found',
          E2BErrorType.SANDBOX_NOT_FOUND
        );
      }

      const metadata = sandbox.metadata as SyncMetadata | null;
      const lastSyncAt = metadata?.lastSyncAt
        ? new Date(metadata.lastSyncAt)
        : null;

      const files = await db.file.findMany({
        where: {
          projectId,
          ...(lastSyncAt && {
            updatedAt: {
              gt: lastSyncAt,
            },
          }),
        },
      });

      if (files.length === 0) {
        console.log('[FileSync] No changed files to sync');
        return {
          success: true,
          data: {
            totalFiles: 0,
            syncedFiles: 0,
            failedFiles: [],
            duration: 0,
            timestamp: new Date(),
          },
          error: null,
        };
      }

      console.log(
        `[FileSync] Found ${files.length} changed file(s) since last sync`
      );

      return await this.syncIncrementalFiles(
        sandboxInstance,
        sandboxId,
        files.map((f) => f.id),
        db
      );
    } catch (error) {
      console.error('[FileSync] Error syncing changed files:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Unknown error during sync',
      };
    }
  }

  /**
   * Core sync logic: upload files to E2B sandbox
   */
  private static async syncFilesToSandbox(
    sandboxInstance: E2BSandbox,
    files: File[],
    sandboxId: string,
    db: PrismaClient
  ): Promise<Omit<SyncResult, 'duration' | 'timestamp'>> {
    const failedFiles: FailedFile[] = [];
    const syncedPaths: string[] = [];
    const workDir = '/project';

    // CRITICAL: Filter out infrastructure files - they should be generated fresh by setupInfrastructure()
    // This ensures we always use the latest package.json with current dependencies (e.g., patch-package)
    const infrastructureFiles = [
      'package.json',
      'vite.config.ts',
      'tsconfig.json',
      'next.config.js',
    ];
    const filesToSync = files.filter(
      (file) => !infrastructureFiles.includes(file.path)
    );

    try {
      // Log files being synced for debugging
      console.log(
        `[FileSync] Files to sync (${filesToSync.length}/${files.length}): ${filesToSync.map((f) => f.path).join(', ')}`
      );

      if (files.length !== filesToSync.length) {
        const skippedFiles = files
          .filter((f) => infrastructureFiles.includes(f.path))
          .map((f) => f.path);
        console.log(
          `[FileSync] Skipping ${skippedFiles.length} infrastructure file(s) - will be generated fresh: ${skippedFiles.join(', ')}`
        );
      }

      if (filesToSync.length === 0) {
        console.log(
          '[FileSync] No application files to sync (only infrastructure files)'
        );
        return {
          totalFiles: files.length,
          syncedFiles: 0,
          failedFiles: [],
        };
      }

      // CRITICAL: Ensure /project directory exists in fresh E2B sandboxes
      await sandboxInstance.commands.run(`mkdir -p ${workDir}`);

      // CRITICAL: Create all necessary subdirectories before batch write
      // E2B's batch write doesn't auto-create parent directories
      const directories = new Set<string>();
      filesToSync.forEach((file) => {
        const sanitizedPath = FileValidator.sanitizePath(file.path);
        const lastSlash = sanitizedPath.lastIndexOf('/');
        if (lastSlash > 0) {
          // Extract directory path (e.g., "src/components" from "src/components/App.tsx")
          directories.add(sanitizedPath.substring(0, lastSlash));
        }
      });

      if (directories.size > 0) {
        const dirsArray = Array.from(directories);
        console.log(
          `[FileSync] Creating ${directories.size} subdirector${directories.size === 1 ? 'y' : 'ies'}: ${dirsArray.join(', ')}`
        );
        // Create all directories in one command for efficiency
        await sandboxInstance.commands.run(
          `mkdir -p ${dirsArray.map((d) => `${workDir}/${d}`).join(' ')}`
        );
      }

      const writeEntries = this.buildWriteEntries(filesToSync, workDir);

      await withRetry(async () => {
        await sandboxInstance.files.write(writeEntries);
      }, 'Batch file upload');

      syncedPaths.push(...filesToSync.map((f) => f.path));

      console.log(
        `[FileSync] Successfully synced ${filesToSync.length} file(s) to sandbox`
      );
    } catch (error) {
      console.error(
        '[FileSync] Batch upload failed, falling back to individual uploads:',
        error
      );

      // Fallback: Upload files individually to identify failures
      for (const file of filesToSync) {
        try {
          const sanitizedPath = FileValidator.sanitizePath(file.path);
          const fullPath = `${workDir}/${sanitizedPath}`;

          // Create parent directory if file is in a subdirectory
          const lastSlash = sanitizedPath.lastIndexOf('/');
          if (lastSlash > 0) {
            const dirPath = sanitizedPath.substring(0, lastSlash);
            await sandboxInstance.commands.run(
              `mkdir -p "${workDir}/${dirPath}"`
            );
          }

          await withRetry(async () => {
            await sandboxInstance.files.write(fullPath, file.content);
          }, `Upload file: ${file.path}`);

          syncedPaths.push(file.path);
        } catch (fileError) {
          console.error(
            `[FileSync] Failed to upload file ${file.path}:`,
            fileError
          );
          failedFiles.push({
            path: file.path,
            reason:
              fileError instanceof Error ? fileError.message : 'Unknown error',
          });
        }
      }
    }

    await this.updateSyncMetadata(
      sandboxId,
      syncedPaths,
      failedFiles.length === 0
        ? 'success'
        : failedFiles.length < files.length
          ? 'partial'
          : 'failed',
      db
    );

    return {
      totalFiles: files.length,
      syncedFiles: syncedPaths.length,
      failedFiles,
    };
  }

  private static buildWriteEntries(
    files: File[],
    workDir: string
  ): E2BWriteEntry[] {
    return files.map((file) => ({
      path: `${workDir}/${FileValidator.sanitizePath(file.path)}`,
      data: file.content,
    }));
  }

  private static async updateSyncMetadata(
    sandboxId: string,
    syncedFiles: string[],
    result: 'success' | 'partial' | 'failed',
    db: PrismaClient
  ): Promise<void> {
    try {
      const sandbox = await db.sandbox.findUnique({
        where: { id: sandboxId },
      });

      if (!sandbox) {
        console.warn('[FileSync] Sandbox not found, skipping metadata update');
        return;
      }

      const currentMetadata = (sandbox.metadata as SyncMetadata | null) ?? {
        lastSyncAt: new Date().toISOString(),
        syncedFiles: [],
        totalSyncs: 0,
        lastSyncResult: 'success',
      };

      const newMetadata: SyncMetadata = {
        lastSyncAt: new Date().toISOString(),
        syncedFiles,
        totalSyncs: (currentMetadata.totalSyncs ?? 0) + 1,
        lastSyncResult: result,
      };

      await db.sandbox.update({
        where: { id: sandboxId },
        data: {
          metadata: newMetadata,
          lastActivity: new Date(),
        },
      });

      console.log('[FileSync] Updated sync metadata in database');
    } catch (error) {
      console.error('[FileSync] Failed to update sync metadata:', error);
    }
  }
}
