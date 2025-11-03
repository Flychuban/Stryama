import { Sandbox as E2BSandbox } from '@e2b/code-interpreter';
import type { PrismaClient } from '@prisma/client';
import { POOL_CONFIG, FEATURE_FLAGS, E2B_CONFIG } from '../config';
import type { PoolStatus, SandboxMetadata, ServiceResult } from '../types';
import { E2BSandboxError, E2BErrorType } from '../errors';

type PoolSandbox = {
  id: string; // Database ID
  e2bId: string; // E2B sandbox ID
  createdAt: Date;
  metadata: SandboxMetadata;
};

export class SandboxPool {
  private pooledSandboxes = new Map<string, PoolSandbox>(); // Cache of pooled sandboxes
  private metrics = {
    totalAssignments: 0,
    totalCreations: 0,
    poolHits: 0,
    totalResumeTime: 0,
    resumeCount: 0,
  };

  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    console.log('[Sandbox Pool] Pool manager initialized');
  }

  private async initialize(db: PrismaClient): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Prevent concurrent initializations
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = (async () => {
      try {
        console.log('[Sandbox Pool] Starting pool initialization...');

        // Load existing pooled sandboxes from database
        const pooledSandboxes = await db.sandbox.findMany({
          where: {
            status: 'ACTIVE',
            projectId: { equals: null }, // Not assigned to any project
            metadata: {
              path: ['pool', 'pooled'],
              equals: true,
            },
          },
        });

        console.log(
          `[Sandbox Pool] Found ${pooledSandboxes.length} existing pooled sandboxes`
        );

        // Load into cache
        for (const sandbox of pooledSandboxes) {
          this.pooledSandboxes.set(sandbox.e2bId, {
            id: sandbox.id,
            e2bId: sandbox.e2bId,
            createdAt: sandbox.createdAt,
            metadata: sandbox.metadata as SandboxMetadata,
          });
        }

        // Refill pool to minimum size if needed
        await this.refillPool(db);

        this.isInitialized = true;
        console.log('[Sandbox Pool] Pool initialization complete');
      } catch (error) {
        console.error('[Sandbox Pool] Failed to initialize pool:', error);
        this.initializationPromise = null;
        throw new E2BSandboxError(
          error instanceof Error ? error.message : 'Failed to initialize pool',
          E2BErrorType.OPERATION_FAILED
        );
      }
    })();

    await this.initializationPromise;
  }

  /**
   * Assign a sandbox from the pool to a project
   * Returns a resumed sandbox or null if pool is empty
   */
  async assignFromPool(
    db: PrismaClient,
    projectId: string,
    _userId: string
  ): Promise<ServiceResult<{ e2bId: string; resumeTimeMs: number }>> {
    if (!FEATURE_FLAGS.enablePooling) {
      return {
        success: false,
        data: null,
        error: 'Pooling is disabled',
      };
    }

    try {
      await this.initialize(db);

      // Get available sandboxes from pool
      const available = Array.from(this.pooledSandboxes.values());

      if (available.length === 0) {
        console.log('[Sandbox Pool] Pool is empty, cannot assign');
        return {
          success: false,
          data: null,
          error: 'Pool empty',
        };
      }

      // Get the oldest sandbox from pool (FIFO)
      const poolSandbox = available[0]!;
      const startTime = Date.now();

      console.log(
        `[Sandbox Pool] Assigning sandbox ${poolSandbox.e2bId} from pool to project ${projectId}`
      );

      // Resume the sandbox using E2B API
      try {
        await E2BSandbox.connect(poolSandbox.e2bId, {
          apiKey: E2B_CONFIG.apiKey,
          timeoutMs: E2B_CONFIG.maxTimeoutMs,
        });
      } catch (error) {
        // If resume fails, remove from pool and return error
        console.error(
          `[Sandbox Pool] Failed to resume sandbox ${poolSandbox.e2bId}:`,
          error
        );

        // Remove from cache and database
        this.pooledSandboxes.delete(poolSandbox.e2bId);
        await db.sandbox.delete({ where: { id: poolSandbox.id } });

        // Trigger refill
        void this.refillPool(db);

        return {
          success: false,
          data: null,
          error: 'Failed to resume sandbox from pool',
        };
      }

      const resumeTimeMs = Date.now() - startTime;

      // Update database: link to project and update metadata
      const currentMetadata = poolSandbox.metadata;
      const updatedMetadata: SandboxMetadata = {
        ...currentMetadata,
        pool: {
          pooled: false,
          poolAssignments: (currentMetadata.pool?.poolAssignments ?? 0) + 1,
          lastFramework: currentMetadata.pool?.lastFramework,
        },
      };

      await db.sandbox.update({
        where: { id: poolSandbox.id },
        data: {
          projectId,
          lastActivity: new Date(),
          expiresAt: new Date(Date.now() + E2B_CONFIG.maxTimeoutMs),
          metadata: updatedMetadata,
        },
      });

      // Remove from pool cache
      this.pooledSandboxes.delete(poolSandbox.e2bId);

      // Update metrics
      this.metrics.totalAssignments++;
      this.metrics.poolHits++;
      this.metrics.totalResumeTime += resumeTimeMs;
      this.metrics.resumeCount++;

      console.log(
        `[Sandbox Pool] Assigned sandbox ${poolSandbox.e2bId} in ${resumeTimeMs}ms`
      );

      // Trigger pool refill asynchronously
      void this.refillPool(db);

      return {
        success: true,
        data: {
          e2bId: poolSandbox.e2bId,
          resumeTimeMs,
        },
        error: null,
      };
    } catch (error) {
      console.error('[Sandbox Pool] Error assigning from pool:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to assign from pool',
      };
    }
  }

  /**
   * Release a sandbox back to the pool
   * Pauses the sandbox and adds it back to the pool for reuse
   */
  async releaseToPool(
    db: PrismaClient,
    sandboxId: string,
    e2bId: string
  ): Promise<ServiceResult<boolean>> {
    if (!FEATURE_FLAGS.enablePooling || !FEATURE_FLAGS.usePersistence) {
      return {
        success: false,
        data: null,
        error: 'Pooling or persistence is disabled',
      };
    }

    try {
      // Check if pool is already at max size
      if (this.pooledSandboxes.size >= POOL_CONFIG.maxSize) {
        console.log(
          '[Sandbox Pool] Pool is full, destroying sandbox instead of releasing'
        );
        return {
          success: false,
          data: null,
          error: 'Pool is full',
        };
      }

      console.log(`[Sandbox Pool] Releasing sandbox ${e2bId} to pool`);

      // Connect to sandbox
      let instance: E2BSandbox;
      try {
        instance = await E2BSandbox.connect(e2bId, {
          apiKey: E2B_CONFIG.apiKey,
        });
      } catch (error) {
        console.error(
          `[Sandbox Pool] Failed to connect to sandbox ${e2bId} for release:`,
          error
        );
        return {
          success: false,
          data: null,
          error: 'Failed to connect to sandbox',
        };
      }

      // Pause the sandbox
      try {
        await instance.betaPause();
        console.log(`[Sandbox Pool] Paused sandbox ${e2bId}`);
      } catch (error) {
        console.error(
          `[Sandbox Pool] Failed to pause sandbox ${e2bId}:`,
          error
        );
        // Kill the sandbox if pause fails
        await instance.kill().catch(console.error);
        return {
          success: false,
          data: null,
          error: 'Failed to pause sandbox',
        };
      }

      // Get current metadata
      const sandbox = await db.sandbox.findUnique({
        where: { id: sandboxId },
      });

      if (!sandbox) {
        console.error('[Sandbox Pool] Sandbox not found in database');
        return {
          success: false,
          data: null,
          error: 'Sandbox not found',
        };
      }

      const currentMetadata = sandbox.metadata as SandboxMetadata;
      const updatedMetadata: SandboxMetadata = {
        ...currentMetadata,
        pool: {
          pooled: true,
          releasedAt: new Date(),
          poolAssignments: currentMetadata.pool?.poolAssignments ?? 0,
          lastFramework: currentMetadata.pool?.lastFramework,
        },
      };

      // Update database: unlink from project, mark as pooled
      await db.sandbox.update({
        where: { id: sandboxId },
        data: {
          projectId: null,
          lastActivity: new Date(),
          metadata: updatedMetadata,
        },
      });

      // Add to pool cache
      this.pooledSandboxes.set(e2bId, {
        id: sandboxId,
        e2bId,
        createdAt: sandbox.createdAt,
        metadata: updatedMetadata,
      });

      console.log(
        `[Sandbox Pool] Released sandbox ${e2bId} to pool. Pool size: ${this.pooledSandboxes.size}`
      );

      return {
        success: true,
        data: true,
        error: null,
      };
    } catch (error) {
      console.error('[Sandbox Pool] Error releasing to pool:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to release to pool',
      };
    }
  }

  /**
   * Refill the pool to maintain minimum size
   * Creates new paused sandboxes as needed
   */
  async refillPool(db: PrismaClient): Promise<void> {
    if (!FEATURE_FLAGS.enablePooling || !FEATURE_FLAGS.usePersistence) {
      return;
    }

    try {
      const currentSize = this.pooledSandboxes.size;
      const needed = POOL_CONFIG.minSize - currentSize;

      if (needed <= 0) {
        return; // Pool has enough sandboxes
      }

      console.log(
        `[Sandbox Pool] Refilling pool: need ${needed} more sandboxes`
      );

      // Create new sandboxes
      const createPromises: Promise<void>[] = [];

      for (let i = 0; i < needed; i++) {
        createPromises.push(this.createPoolSandbox(db));
      }

      await Promise.allSettled(createPromises);

      console.log(
        `[Sandbox Pool] Pool refill complete. New size: ${this.pooledSandboxes.size}`
      );
    } catch (error) {
      console.error('[Sandbox Pool] Error during pool refill:', error);
    }
  }

  /**
   * Create a new sandbox and add it to the pool
   */
  private async createPoolSandbox(db: PrismaClient): Promise<void> {
    try {
      console.log('[Sandbox Pool] Creating new pooled sandbox...');

      // Create sandbox with auto-pause enabled
      const instance = await E2BSandbox.create({
        apiKey: E2B_CONFIG.apiKey,
        timeoutMs: E2B_CONFIG.defaultTimeoutMs,
      });

      console.log(
        `[Sandbox Pool] Created sandbox ${instance.sandboxId}, pausing...`
      );

      // Pause immediately
      await instance.betaPause();

      console.log(`[Sandbox Pool] Paused sandbox ${instance.sandboxId}`);

      // Save to database
      const metadata: SandboxMetadata = {
        pool: {
          pooled: true,
          releasedAt: new Date(),
          poolAssignments: 0,
        },
      };

      const sandbox = await db.sandbox.create({
        data: {
          e2bId: instance.sandboxId,
          status: 'ACTIVE',
          lastActivity: new Date(),
          metadata,
        },
      });

      // Add to cache
      this.pooledSandboxes.set(instance.sandboxId, {
        id: sandbox.id,
        e2bId: instance.sandboxId,
        createdAt: sandbox.createdAt,
        metadata,
      });

      this.metrics.totalCreations++;

      console.log(`[Sandbox Pool] Added sandbox ${instance.sandboxId} to pool`);
    } catch (error) {
      console.error('[Sandbox Pool] Failed to create pool sandbox:', error);
      throw error;
    }
  }

  /**
   * Get pool status and metrics
   */
  async getStatus(db: PrismaClient): Promise<PoolStatus> {
    await this.initialize(db);

    const avgResumeTime =
      this.metrics.resumeCount > 0
        ? this.metrics.totalResumeTime / this.metrics.resumeCount
        : 0;

    const poolHitRate =
      this.metrics.totalAssignments > 0
        ? (this.metrics.poolHits / this.metrics.totalAssignments) * 100
        : 0;

    return {
      totalPooled: this.pooledSandboxes.size,
      available: this.pooledSandboxes.size,
      assigned: this.metrics.totalAssignments - this.metrics.poolHits,
      metrics: {
        poolHitRate,
        avgResumeTime,
        totalAssignments: this.metrics.totalAssignments,
        totalCreations: this.metrics.totalCreations,
      },
    };
  }

  /**
   * Remove old sandboxes from pool
   * Called by cleanup scheduler
   */
  async removeOldPoolSandboxes(db: PrismaClient): Promise<number> {
    try {
      const now = Date.now();
      let removed = 0;

      // Find sandboxes that have been in pool too long
      for (const [e2bId, sandbox] of this.pooledSandboxes.entries()) {
        const releasedAt =
          sandbox.metadata.pool?.releasedAt ?? sandbox.createdAt;
        const age = now - new Date(releasedAt).getTime();

        if (age > POOL_CONFIG.maxPoolAge) {
          console.log(
            `[Sandbox Pool] Removing old sandbox ${e2bId} from pool (age: ${age}ms)`
          );

          try {
            // Kill the sandbox
            await E2BSandbox.kill(e2bId);

            // Remove from database
            await db.sandbox.delete({ where: { id: sandbox.id } });

            // Remove from cache
            this.pooledSandboxes.delete(e2bId);

            removed++;
          } catch (error) {
            console.error(
              `[Sandbox Pool] Failed to remove sandbox ${e2bId}:`,
              error
            );
          }
        }
      }

      if (removed > 0) {
        console.log(
          `[Sandbox Pool] Removed ${removed} old sandboxes from pool`
        );
        // Refill pool
        void this.refillPool(db);
      }

      return removed;
    } catch (error) {
      console.error('[Sandbox Pool] Error removing old sandboxes:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const sandboxPool = new SandboxPool();
