/**
 * Cleanup Scheduler - Phase 4: Sandbox Lifecycle & Session Management
 *
 * Automatic cleanup service that runs periodically to:
 * 1. Destroy expired sandboxes
 * 2. Pause inactive sandboxes
 * 3. Remove old pooled sandboxes
 * 4. Clean up orphaned sandboxes approaching 30-day E2B limit
 *
 * Triggered by cron job (every 5 minutes) via /api/cron/cleanup endpoint
 */

import { Sandbox as E2BSandbox } from '@e2b/code-interpreter';
import type { PrismaClient } from '@prisma/client';
import { LIFECYCLE_CONFIG, FEATURE_FLAGS, E2B_CONFIG } from '../config';
import type { CleanupStats } from '../types';
import { sandboxPool } from './sandbox-pool';

export class CleanupScheduler {
  private lastCleanup: Date | null = null;
  private isRunning = false;

  async runCleanup(db: PrismaClient): Promise<CleanupStats> {
    if (this.isRunning) {
      console.log('[Cleanup Scheduler] Cleanup already running, skipping');
      return {
        timestamp: new Date(),
        sandboxesDestroyed: 0,
        sandboxesPaused: 0,
        poolSandboxesRemoved: 0,
        errors: 0,
        durationMs: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const stats: CleanupStats = {
      timestamp: new Date(),
      sandboxesDestroyed: 0,
      sandboxesPaused: 0,
      poolSandboxesRemoved: 0,
      errors: 0,
      durationMs: 0,
    };

    try {
      console.log('[Cleanup Scheduler] Starting cleanup cycle...');

      const destroyed = await this.destroyExpiredSandboxes(db);
      stats.sandboxesDestroyed += destroyed.count;
      stats.errors += destroyed.errors;

      if (FEATURE_FLAGS.usePersistence) {
        const paused = await this.pauseInactiveSandboxes(db);
        stats.sandboxesPaused += paused.count;
        stats.errors += paused.errors;
      }

      if (FEATURE_FLAGS.enablePooling) {
        const removed = await sandboxPool.removeOldPoolSandboxes(db);
        stats.poolSandboxesRemoved += removed;
      }

      const orphanedDestroyed = await this.cleanupOrphanedSandboxes(db);
      stats.sandboxesDestroyed += orphanedDestroyed.count;
      stats.errors += orphanedDestroyed.errors;

      stats.durationMs = Date.now() - startTime;
      this.lastCleanup = new Date();

      console.log(
        `[Cleanup Scheduler] Cleanup complete in ${stats.durationMs}ms:`,
        {
          destroyed: stats.sandboxesDestroyed,
          paused: stats.sandboxesPaused,
          poolRemoved: stats.poolSandboxesRemoved,
          errors: stats.errors,
        }
      );

      return stats;
    } catch (error) {
      console.error('[Cleanup Scheduler] Cleanup failed:', error);
      stats.errors++;
      stats.durationMs = Date.now() - startTime;
      return stats;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Destroy sandboxes that have exceeded their expiration time
   */
  private async destroyExpiredSandboxes(
    db: PrismaClient
  ): Promise<{ count: number; errors: number }> {
    let count = 0;
    let errors = 0;

    try {
      const now = new Date();

      // Find expired active sandboxes (not in pool)
      const expiredSandboxes = await db.sandbox.findMany({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            lt: now,
          },
          NOT: {
            metadata: {
              path: ['pool', 'pooled'],
              equals: true,
            },
          },
        },
        select: {
          id: true,
          e2bId: true,
        },
      });

      console.log(
        `[Cleanup Scheduler] Found ${expiredSandboxes.length} expired sandboxes to destroy`
      );

      for (const sandbox of expiredSandboxes) {
        try {
          // Kill the E2B sandbox
          await E2BSandbox.kill(sandbox.e2bId);
          console.log(
            `[Cleanup Scheduler] Destroyed expired sandbox ${sandbox.e2bId}`
          );

          // Update database status
          await db.sandbox.update({
            where: { id: sandbox.id },
            data: {
              status: 'STOPPED',
              lastActivity: new Date(),
            },
          });

          count++;
        } catch (error) {
          console.error(
            `[Cleanup Scheduler] Failed to destroy sandbox ${sandbox.e2bId}:`,
            error
          );
          errors++;

          // Update status to ERROR
          await db.sandbox
            .update({
              where: { id: sandbox.id },
              data: { status: 'ERROR' },
            })
            .catch((err) =>
              console.error('Failed to update error status:', err)
            );
        }
      }
    } catch (error) {
      console.error(
        '[Cleanup Scheduler] Error in destroyExpiredSandboxes:',
        error
      );
      errors++;
    }

    return { count, errors };
  }

  private async pauseInactiveSandboxes(
    db: PrismaClient
  ): Promise<{ count: number; errors: number }> {
    let count = 0;
    let errors = 0;

    try {
      const inactivityThreshold = new Date(
        Date.now() - LIFECYCLE_CONFIG.inactivityTimeout
      );

      // Find inactive active sandboxes (not in pool, not expired)
      const inactiveSandboxes = await db.sandbox.findMany({
        where: {
          status: 'ACTIVE',
          lastActivity: {
            lt: inactivityThreshold,
          },
          expiresAt: {
            gte: new Date(), // Not yet expired
          },
          NOT: {
            metadata: {
              path: ['pool', 'pooled'],
              equals: true,
            },
          },
        },
        select: {
          id: true,
          e2bId: true,
          metadata: true,
        },
      });

      console.log(
        `[Cleanup Scheduler] Found ${inactiveSandboxes.length} inactive sandboxes to pause`
      );

      for (const sandbox of inactiveSandboxes) {
        try {
          // Connect and pause the sandbox
          const instance = await E2BSandbox.connect(sandbox.e2bId, {
            apiKey: E2B_CONFIG.apiKey,
          });

          await instance.betaPause();
          console.log(
            `[Cleanup Scheduler] Paused inactive sandbox ${sandbox.e2bId}`
          );

          // Update database - keep status ACTIVE as it can be resumed
          // Just update lastActivity to track when it was paused
          await db.sandbox.update({
            where: { id: sandbox.id },
            data: {
              lastActivity: new Date(),
            },
          });

          count++;
        } catch (error) {
          console.error(
            `[Cleanup Scheduler] Failed to pause sandbox ${sandbox.e2bId}:`,
            error
          );
          errors++;

          // If pause fails, try to kill it
          try {
            await E2BSandbox.kill(sandbox.e2bId);
            await db.sandbox.update({
              where: { id: sandbox.id },
              data: { status: 'STOPPED' },
            });
          } catch (killError) {
            console.error(
              `[Cleanup Scheduler] Failed to kill sandbox after pause failure:`,
              killError
            );
          }
        }
      }
    } catch (error) {
      console.error(
        '[Cleanup Scheduler] Error in pauseInactiveSandboxes:',
        error
      );
      errors++;
    }

    return { count, errors };
  }

  private async cleanupOrphanedSandboxes(
    db: PrismaClient
  ): Promise<{ count: number; errors: number }> {
    let count = 0;
    let errors = 0;

    try {
      const maxAgeDate = new Date(Date.now() - LIFECYCLE_CONFIG.maxSandboxAge);

      // Find sandboxes older than 28 days
      const oldSandboxes = await db.sandbox.findMany({
        where: {
          createdAt: {
            lt: maxAgeDate,
          },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          e2bId: true,
          createdAt: true,
        },
      });

      console.log(
        `[Cleanup Scheduler] Found ${oldSandboxes.length} sandboxes approaching 30-day limit`
      );

      for (const sandbox of oldSandboxes) {
        try {
          // Kill the sandbox
          await E2BSandbox.kill(sandbox.e2bId);
          console.log(
            `[Cleanup Scheduler] Destroyed old sandbox ${sandbox.e2bId} (created: ${sandbox.createdAt.toISOString()})`
          );

          // Update database
          await db.sandbox.update({
            where: { id: sandbox.id },
            data: {
              status: 'STOPPED',
              lastActivity: new Date(),
            },
          });

          count++;
        } catch (error) {
          console.error(
            `[Cleanup Scheduler] Failed to destroy old sandbox ${sandbox.e2bId}:`,
            error
          );
          errors++;

          // Update to ERROR status
          await db.sandbox
            .update({
              where: { id: sandbox.id },
              data: { status: 'ERROR' },
            })
            .catch((err) =>
              console.error('Failed to update error status:', err)
            );
        }
      }
    } catch (error) {
      console.error(
        '[Cleanup Scheduler] Error in cleanupOrphanedSandboxes:',
        error
      );
      errors++;
    }

    return { count, errors };
  }

  getLastCleanupTime(): Date | null {
    return this.lastCleanup;
  }

  isCleanupRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const cleanupScheduler = new CleanupScheduler();
