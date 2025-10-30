import type { PrismaClient } from '@prisma/client';
import type { Sandbox as E2BSandbox } from '@e2b/code-interpreter';
import { Sandbox } from '@e2b/code-interpreter';
import { e2bClient } from '../client';
import { E2B_CONFIG, FEATURE_FLAGS } from '../config';
import { SandboxTimeoutError, E2BSandboxError, E2BErrorType } from '../errors';
import { withRetry } from '../errors/retry-handler';
import type { ServiceResult, SandboxInstance } from '../types';
import { sandboxPool } from './sandbox-pool';

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
   * Get or create sandbox for a project (Phase 4: Now with pool support!)
   * Priority: Existing active → Resume paused → Pool → Create new
   */
  async getOrCreateSandbox(
    db: PrismaClient,
    projectId: string,
    userId: string
  ): Promise<ServiceResult<SandboxInstance>> {
    try {
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
        let instance = this.activeSandboxes.get(existingSandbox.id);

        if (!instance && FEATURE_FLAGS.usePersistence) {
          console.log(
            `[Sandbox Manager] Active sandbox ${existingSandbox.e2bId} found but not cached, attempting resume...`
          );

          try {
            const startTime = Date.now();
            instance = await Sandbox.connect(existingSandbox.e2bId, {
              apiKey: E2B_CONFIG.apiKey,
              timeoutMs: E2B_CONFIG.maxTimeoutMs,
            });
            const resumeTime = Date.now() - startTime;

            // Cache the resumed instance
            this.activeSandboxes.set(existingSandbox.id, instance);

            console.log(
              `[Sandbox Manager] Successfully resumed sandbox ${existingSandbox.e2bId} in ${resumeTime}ms`
            );
          } catch (resumeError) {
            console.error(
              `[Sandbox Manager] Failed to resume sandbox ${existingSandbox.e2bId}:`,
              resumeError
            );
            // Fall through to pool/create logic
            instance = undefined;
          }
        }

        if (instance) {
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
      }

      if (FEATURE_FLAGS.enablePooling) {
        console.log('[Sandbox Manager] Trying to assign sandbox from pool...');
        const poolResult = await sandboxPool.assignFromPool(
          db,
          projectId,
          userId
        );

        if (poolResult.success && poolResult.data) {
          console.log(
            `[Sandbox Manager] Assigned sandbox from pool in ${poolResult.data.resumeTimeMs}ms`
          );

          // Get the updated sandbox from DB
          const pooledSandbox = await db.sandbox.findFirst({
            where: {
              e2bId: poolResult.data.e2bId,
              projectId,
            },
          });

          if (pooledSandbox) {
            // Connect to the resumed sandbox
            const instance = await Sandbox.connect(poolResult.data.e2bId, {
              apiKey: E2B_CONFIG.apiKey,
              timeoutMs: E2B_CONFIG.maxTimeoutMs,
            });

            // Cache it
            this.activeSandboxes.set(pooledSandbox.id, instance);

            return {
              success: true,
              data: {
                id: pooledSandbox.id,
                e2bId: pooledSandbox.e2bId,
                status: pooledSandbox.status,
                expiresAt: pooledSandbox.expiresAt,
                instance,
              },
              error: null,
            };
          }
        }
      }

      // Step 3: Create new sandbox (fallback)
      console.log('[Sandbox Manager] Creating new sandbox...');
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

  async pauseSandbox(
    db: PrismaClient,
    sandboxId: string
  ): Promise<ServiceResult<void>> {
    if (!FEATURE_FLAGS.usePersistence) {
      return {
        success: false,
        data: null,
        error: 'Persistence is disabled',
      };
    }

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

      const instance = this.activeSandboxes.get(sandboxId);
      if (!instance) {
        return {
          success: false,
          data: null,
          error: 'Sandbox instance not found in cache',
        };
      }

      // Pause using E2B API
      await instance.betaPause();
      console.log(`[Sandbox Manager] Paused sandbox ${dbSandbox.e2bId}`);

      // Update database
      await db.sandbox.update({
        where: { id: sandboxId },
        data: { lastActivity: new Date() },
      });

      // Keep in cache - can still resume
      return {
        success: true,
        data: null,
        error: null,
      };
    } catch (error) {
      console.error('[Sandbox Manager] Pause failed:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to pause sandbox',
      };
    }
  }

  async resumeSandbox(
    db: PrismaClient,
    sandboxId: string
  ): Promise<ServiceResult<E2BSandbox>> {
    if (!FEATURE_FLAGS.usePersistence) {
      return {
        success: false,
        data: null,
        error: 'Persistence is disabled',
      };
    }

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

      // Try to get from cache first
      let instance = this.activeSandboxes.get(sandboxId);

      if (!instance) {
        // Connect (will auto-resume if paused)
        const startTime = Date.now();
        instance = await Sandbox.connect(dbSandbox.e2bId, {
          apiKey: E2B_CONFIG.apiKey,
          timeoutMs: E2B_CONFIG.maxTimeoutMs,
        });
        const resumeTime = Date.now() - startTime;

        console.log(
          `[Sandbox Manager] Resumed sandbox ${dbSandbox.e2bId} in ${resumeTime}ms`
        );

        // Cache the instance
        this.activeSandboxes.set(sandboxId, instance);
      }

      // Update database
      await db.sandbox.update({
        where: { id: sandboxId },
        data: { lastActivity: new Date() },
      });

      return {
        success: true,
        data: instance,
        error: null,
      };
    } catch (error) {
      console.error('[Sandbox Manager] Resume failed:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to resume sandbox',
      };
    }
  }

  async releaseToPool(
    db: PrismaClient,
    sandboxId: string
  ): Promise<ServiceResult<boolean>> {
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

      // Try to release to pool
      const releaseResult = await sandboxPool.releaseToPool(
        db,
        sandboxId,
        dbSandbox.e2bId
      );

      if (releaseResult.success) {
        // Remove from active cache since it's now pooled
        this.activeSandboxes.delete(sandboxId);
        console.log(
          `[Sandbox Manager] Released sandbox ${dbSandbox.e2bId} to pool`
        );
        return releaseResult;
      }

      // If release to pool failed (e.g., pool full), destroy instead
      console.log(
        `[Sandbox Manager] Failed to release to pool, destroying sandbox ${dbSandbox.e2bId}`
      );
      await this.destroySandbox(db, sandboxId);

      return {
        success: false,
        data: null,
        error: 'Released by destroying (pool unavailable)',
      };
    } catch (error) {
      console.error('[Sandbox Manager] Release to pool failed:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to release to pool',
      };
    }
  }

  /**
   * Get cached E2B instance (for internal use)
   */
  getCachedInstance(sandboxId: string): E2BSandbox | undefined {
    return this.activeSandboxes.get(sandboxId);
  }
}

export const sandboxManager = new SandboxManager();
