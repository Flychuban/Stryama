import type { ServiceResult, SyncResult } from '../types';

export enum ConflictType {
  SANDBOX_EXPIRED = 'SANDBOX_EXPIRED',
  FILE_DELETED = 'FILE_DELETED',
  CONCURRENT_MODIFICATION = 'CONCURRENT_MODIFICATION',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export type ConflictResolution = {
  readonly type: ConflictType;
  readonly resolved: boolean;
  readonly action: string;
  readonly shouldRetry: boolean;
};

export class ConflictResolver {
  static classifyConflict(error: unknown): ConflictResolution {
    const errorMessage =
      error instanceof Error ? error.message.toLowerCase() : String(error);

    if (
      errorMessage.includes('expired') ||
      errorMessage.includes('not found') ||
      errorMessage.includes('does not exist')
    ) {
      return {
        type: ConflictType.SANDBOX_EXPIRED,
        resolved: false,
        action: 'Create new sandbox and retry sync',
        shouldRetry: true,
      };
    }

    if (
      errorMessage.includes('file not found') ||
      errorMessage.includes('no such file')
    ) {
      return {
        type: ConflictType.FILE_DELETED,
        resolved: true,
        action: 'Skip deleted file',
        shouldRetry: false,
      };
    }

    if (errorMessage.includes('validation failed')) {
      return {
        type: ConflictType.VALIDATION_FAILED,
        resolved: true,
        action: 'Skip invalid file',
        shouldRetry: false,
      };
    }

    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused')
    ) {
      return {
        type: ConflictType.NETWORK_ERROR,
        resolved: false,
        action: 'Retry after delay',
        shouldRetry: true,
      };
    }

    if (errorMessage.includes('conflict') || errorMessage.includes('stale')) {
      return {
        type: ConflictType.CONCURRENT_MODIFICATION,
        resolved: true,
        action: 'Use last-write-wins strategy',
        shouldRetry: false,
      };
    }

    return {
      type: ConflictType.UNKNOWN,
      resolved: false,
      action: 'Log error and continue',
      shouldRetry: false,
    };
  }

  static handlePartialFailure(syncResult: SyncResult): {
    readonly shouldAlert: boolean;
    readonly message: string;
  } {
    const { totalFiles, syncedFiles, failedFiles } = syncResult;

    if (syncedFiles === 0 && totalFiles > 0) {
      return {
        shouldAlert: true,
        message: `Critical: All ${totalFiles} file(s) failed to sync`,
      };
    }

    if (failedFiles.length > 0) {
      const failureRate = (failedFiles.length / totalFiles) * 100;
      if (failureRate > 50) {
        return {
          shouldAlert: true,
          message: `Warning: ${failedFiles.length} of ${totalFiles} file(s) failed to sync (${failureRate.toFixed(0)}% failure rate)`,
        };
      }

      return {
        shouldAlert: false,
        message: `${failedFiles.length} of ${totalFiles} file(s) failed to sync`,
      };
    }

    return {
      shouldAlert: false,
      message: `Successfully synced all ${totalFiles} file(s)`,
    };
  }

  static shouldRetrySync(error: unknown): boolean {
    const resolution = this.classifyConflict(error);
    return resolution.shouldRetry;
  }

  static getUserMessage(error: unknown): string {
    const resolution = this.classifyConflict(error);

    switch (resolution.type) {
      case ConflictType.SANDBOX_EXPIRED:
        return 'The sandbox has expired. Please try again to create a new sandbox.';

      case ConflictType.FILE_DELETED:
        return 'Some files were deleted during sync and were skipped.';

      case ConflictType.VALIDATION_FAILED:
        return 'Some files failed validation checks and were not synced.';

      case ConflictType.NETWORK_ERROR:
        return 'A network error occurred. Please check your connection and try again.';

      case ConflictType.CONCURRENT_MODIFICATION:
        return 'Files were modified concurrently. Latest changes were synced.';

      case ConflictType.UNKNOWN:
      default:
        return 'An error occurred during file sync. Please try again.';
    }
  }

  static async attemptRecovery(
    error: unknown,
    _context: {
      sandboxId: string;
      projectId: string;
    }
  ): Promise<ServiceResult<boolean>> {
    const resolution = this.classifyConflict(error);

    console.log(
      `[ConflictResolver] Attempting recovery for ${resolution.type}: ${resolution.action}`
    );

    if (resolution.type === ConflictType.SANDBOX_EXPIRED) {
      return {
        success: false,
        data: null,
        error: 'Sandbox expired - new sandbox required',
      };
    }

    if (resolution.resolved) {
      return {
        success: true,
        data: true,
        error: null,
      };
    }

    return {
      success: false,
      data: false,
      error: resolution.action,
    };
  }

  static logConflict(
    type: ConflictType,
    context: {
      sandboxId: string;
      projectId: string;
      fileCount?: number;
      error?: unknown;
    }
  ): void {
    console.warn('[ConflictResolver] Conflict detected:', {
      type,
      sandboxId: context.sandboxId,
      projectId: context.projectId,
      fileCount: context.fileCount,
      error:
        context.error instanceof Error ? context.error.message : context.error,
      timestamp: new Date().toISOString(),
    });
  }
}
