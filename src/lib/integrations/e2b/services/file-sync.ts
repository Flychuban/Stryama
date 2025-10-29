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
      const files = await db.file.findMany({
        where: {
          projectId,
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

      const validation = FileValidator.validateFiles(files);
      if (!validation.valid) {
        return {
          success: false,
          data: null,
          error: `File validation failed: ${validation.errors.join(', ')}`,
        };
      }

      if (validation.warnings.length > 0) {
        console.warn('[FileSync] Validation warnings:', validation.warnings);
      }

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

      const validation = FileValidator.validateFiles(files);
      if (!validation.valid) {
        return {
          success: false,
          data: null,
          error: `File validation failed: ${validation.errors.join(', ')}`,
        };
      }

      if (validation.warnings.length > 0) {
        console.warn('[FileSync] Validation warnings:', validation.warnings);
      }

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

    try {
      const writeEntries = this.buildWriteEntries(files);

      await withRetry(async () => {
        await sandboxInstance.files.write(writeEntries);
      }, 'Batch file upload');

      syncedPaths.push(...files.map((f) => f.path));

      console.log(
        `[FileSync] Successfully synced ${files.length} file(s) to sandbox`
      );
    } catch (error) {
      console.error(
        '[FileSync] Batch upload failed, falling back to individual uploads:',
        error
      );

      // Fallback: Upload files individually to identify failures
      for (const file of files) {
        try {
          const sanitizedPath = FileValidator.sanitizePath(file.path);

          await withRetry(async () => {
            await sandboxInstance.files.write(sanitizedPath, file.content);
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

  private static buildWriteEntries(files: File[]): E2BWriteEntry[] {
    return files.map((file) => ({
      path: FileValidator.sanitizePath(file.path),
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
