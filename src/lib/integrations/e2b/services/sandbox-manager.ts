import type { PrismaClient } from '@prisma/client';
import type { Sandbox as E2BSandbox } from '@e2b/code-interpreter';
import { e2bClient } from '../client';
import { E2B_CONFIG } from '../config';
import { SandboxTimeoutError, E2BSandboxError, E2BErrorType } from '../errors';
import { withRetry } from '../errors/retry-handler';
import type { ServiceResult, SandboxInstance } from '../types';

class SandboxManager {
  private activeSandboxes = new Map<string, E2BSandbox>();

  /**
   * Create a new E2B sandbox and store in database
   */
  async createSandbox(
    db: PrismaClient,
    projectId: string,
    userId: string,
    timeoutMs: number = E2B_CONFIG.defaultTimeoutMs
  ): Promise<ServiceResult<SandboxInstance>> {
    try {
      // Create E2B sandbox with retry
      const e2bSandbox = await withRetry(
        () =>
          e2bClient.createSandbox({
            timeoutMs,
            metadata: { projectId, userId },
          }),
        'Create E2B Sandbox'
      );

      const info = await e2bSandbox.getInfo();
      const expiresAt = new Date(info.endAt);

      // Store in database
      const dbSandbox = await db.sandbox.create({
        data: {
          e2bId: info.sandboxId,
          status: 'ACTIVE',
          projectId,
          templateId: info.templateId,
          lastActivity: new Date(),
          expiresAt,
          metadata: { projectId, userId },
        },
      });

      // Cache the E2B instance
      this.activeSandboxes.set(dbSandbox.id, e2bSandbox);

      return {
        success: true,
        data: {
          id: dbSandbox.id,
          e2bId: dbSandbox.e2bId,
          status: dbSandbox.status,
          expiresAt: dbSandbox.expiresAt,
          instance: e2bSandbox,
        },
        error: null,
      };
    } catch (error) {
      console.error('[Sandbox Manager] Creation failed:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to create sandbox',
      };
    }
  }

  /**
   * Get or create sandbox for a project
   */
  async getOrCreateSandbox(
    db: PrismaClient,
    projectId: string,
    userId: string
  ): Promise<ServiceResult<SandboxInstance>> {
    try {
      // Check for existing active sandbox
      const existingSandbox = await db.sandbox.findFirst({
        where: {
          projectId,
          status: 'ACTIVE',
          expiresAt: {
            gt: new Date(), // Not expired
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (existingSandbox) {
        // Try to get cached instance
        const instance = this.activeSandboxes.get(existingSandbox.id);

        // If not cached, we can't reconnect (E2B limitation in Phase 1)
        // So create a new one
        if (!instance) {
          console.log(
            '[Sandbox Manager] Active sandbox found but not cached, creating new one'
          );
          return this.createSandbox(db, projectId, userId);
        }

        // Update last activity
        await db.sandbox.update({
          where: { id: existingSandbox.id },
          data: { lastActivity: new Date() },
        });

        return {
          success: true,
          data: {
            id: existingSandbox.id,
            e2bId: existingSandbox.e2bId,
            status: existingSandbox.status,
            expiresAt: existingSandbox.expiresAt,
            instance,
          },
          error: null,
        };
      }

      // Create new sandbox
      return this.createSandbox(db, projectId, userId);
    } catch (error) {
      console.error('[Sandbox Manager] getOrCreate failed:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get or create sandbox',
      };
    }
  }

  /**
   * Destroy sandbox and cleanup
   */
  async destroySandbox(
    db: PrismaClient,
    sandboxId: string
  ): Promise<ServiceResult<void>> {
    try {
      const dbSandbox = await db.sandbox.findUnique({
        where: { id: sandboxId },
      });

      if (!dbSandbox) {
        return {
          success: false,
          data: null,
          error: 'Sandbox not found in database',
        };
      }

      // Get cached instance
      const instance = this.activeSandboxes.get(sandboxId);

      // Kill E2B sandbox if we have instance
      if (instance) {
        try {
          await withRetry(
            () => e2bClient.killSandbox(instance),
            'Kill Sandbox'
          );
          this.activeSandboxes.delete(sandboxId);
        } catch (error) {
          console.error('[Sandbox Manager] Failed to kill E2B sandbox:', error);
          // Continue to update DB even if kill fails
        }
      }

      // Update database
      await db.sandbox.update({
        where: { id: sandboxId },
        data: {
          status: 'STOPPED',
          expiresAt: new Date(), // Mark as expired
        },
      });

      return {
        success: true,
        data: null,
        error: null,
      };
    } catch (error) {
      console.error('[Sandbox Manager] Destroy failed:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to destroy sandbox',
      };
    }
  }

  /**
   * Extend sandbox timeout
   */
  async extendTimeout(
    db: PrismaClient,
    sandboxId: string,
    additionalMs: number
  ): Promise<ServiceResult<Date>> {
    try {
      const dbSandbox = await db.sandbox.findUnique({
        where: { id: sandboxId },
      });

      if (!dbSandbox) {
        throw new E2BSandboxError(
          'Sandbox not found',
          E2BErrorType.SANDBOX_NOT_FOUND
        );
      }

      const instance = this.activeSandboxes.get(sandboxId);
      if (!instance) {
        throw new E2BSandboxError(
          'Sandbox instance not found in cache',
          E2BErrorType.SANDBOX_NOT_FOUND
        );
      }

      // Validate timeout
      if (additionalMs > E2B_CONFIG.maxTimeoutMs) {
        throw new SandboxTimeoutError(
          `Timeout exceeds maximum allowed (${E2B_CONFIG.maxTimeoutMs}ms)`
        );
      }

      // Set new timeout in E2B
      await withRetry(
        () => e2bClient.setTimeout(instance, additionalMs),
        'Extend Timeout'
      );

      // Calculate new expiration
      const newExpiresAt = new Date(Date.now() + additionalMs);

      // Update database
      await db.sandbox.update({
        where: { id: sandboxId },
        data: {
          expiresAt: newExpiresAt,
          lastActivity: new Date(),
        },
      });

      return {
        success: true,
        data: newExpiresAt,
        error: null,
      };
    } catch (error) {
      console.error('[Sandbox Manager] Extend timeout failed:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to extend timeout',
      };
    }
  }

  /**
   * Get sandbox health/status
   */
  async getHealth(
    db: PrismaClient,
    sandboxId: string
  ): Promise<
    ServiceResult<{
      status: string;
      isExpired: boolean;
      expiresAt: Date | null;
      lastActivity: Date;
    }>
  > {
    try {
      const dbSandbox = await db.sandbox.findUnique({
        where: { id: sandboxId },
      });

      if (!dbSandbox) {
        return {
          success: false,
          data: null,
          error: 'Sandbox not found',
        };
      }

      const isExpired = dbSandbox.expiresAt
        ? dbSandbox.expiresAt < new Date()
        : false;

      // Update status if expired
      if (isExpired && dbSandbox.status === 'ACTIVE') {
        await db.sandbox.update({
          where: { id: sandboxId },
          data: { status: 'STOPPED' },
        });

        return {
          success: true,
          data: {
            status: 'STOPPED',
            isExpired: true,
            expiresAt: dbSandbox.expiresAt,
            lastActivity: dbSandbox.lastActivity,
          },
          error: null,
        };
      }

      return {
        success: true,
        data: {
          status: dbSandbox.status,
          isExpired,
          expiresAt: dbSandbox.expiresAt,
          lastActivity: dbSandbox.lastActivity,
        },
        error: null,
      };
    } catch (error) {
      console.error('[Sandbox Manager] Get health failed:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get sandbox health',
      };
    }
  }

  /**
   * Update last activity timestamp
   */
  async updateActivity(
    db: PrismaClient,
    sandboxId: string
  ): Promise<ServiceResult<void>> {
    try {
      await db.sandbox.update({
        where: { id: sandboxId },
        data: { lastActivity: new Date() },
      });

      return {
        success: true,
        data: null,
        error: null,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to update activity',
      };
    }
  }
}

export const sandboxManager = new SandboxManager();
