import type { PrismaClient } from '@prisma/client';
import type { Sandbox as E2BSandbox } from '@e2b/code-interpreter';
import { Sandbox } from '@e2b/code-interpreter';
import { e2bClient } from '../client';
import {
  E2B_CONFIG,
  FEATURE_FLAGS,
  getConcurrentLimitForPlan,
} from '../config';
import { SandboxTimeoutError, E2BSandboxError, E2BErrorType } from '../errors';
import { withRetry } from '../errors/retry-handler';
import type { ServiceResult, SandboxInstance } from '../types';
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';

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
    console.log(
      `[Sandbox Manager] 🆕 ========== CREATE NEW SANDBOX ==========`
    );
    console.log(`[Sandbox Manager] Project ID: ${projectId}`);
    console.log(`[Sandbox Manager] User ID: ${userId}`);
    console.log(`[Sandbox Manager] Timeout: ${timeoutMs}ms`);
    console.log(`[Sandbox Manager] Timestamp: ${new Date().toISOString()}`);

    try {
      // Check concurrent sandbox limit for user's plan (from Clerk session)
      console.log(`[Sandbox Manager] 🔍 Checking user plan and limits...`);
      const planStartTime = Date.now();
      const userPlan = await getUserPlanFromClerk();
      const planDuration = Date.now() - planStartTime;
      const concurrentLimit = getConcurrentLimitForPlan(userPlan);
      console.log(
        `[Sandbox Manager] ✅ User plan: ${userPlan}, Concurrent limit: ${concurrentLimit} (${planDuration}ms)`
      );

      // Count active sandboxes for this user
      console.log(`[Sandbox Manager] 🔍 Counting active sandboxes for user...`);
      const countStartTime = Date.now();
      const activeSandboxCount = await db.sandbox.count({
        where: {
          metadata: {
            path: ['userId'],
            equals: userId,
          },
          status: 'ACTIVE',
          expiresAt: {
            gt: new Date(),
          },
        },
      });
      const countDuration = Date.now() - countStartTime;
      console.log(
        `[Sandbox Manager] Active sandboxes: ${activeSandboxCount}/${concurrentLimit} (${countDuration}ms)`
      );

      if (activeSandboxCount >= concurrentLimit) {
        console.error(
          `[Sandbox Manager] ❌ Concurrent limit reached: ${activeSandboxCount}/${concurrentLimit}`
        );
        return {
          success: false,
          data: null,
          error: `Concurrent sandbox limit reached. You have ${activeSandboxCount}/${concurrentLimit} active sandboxes. Please close other projects or upgrade your plan.`,
        };
      }

      // Create E2B sandbox with retry
      console.log(`[Sandbox Manager] 🚀 Creating E2B sandbox...`);
      console.log(`[Sandbox Manager] Timeout: ${timeoutMs}ms`);
      console.log(
        `[Sandbox Manager] Metadata: projectId=${projectId}, userId=${userId}`
      );
      const createStartTime = Date.now();
      const e2bSandbox = await withRetry(
        () =>
          e2bClient.createSandbox({
            timeoutMs,
            metadata: { projectId, userId },
          }),
        'Create E2B Sandbox'
      );
      const createDuration = Date.now() - createStartTime;
      console.log(
        `[Sandbox Manager] ✅ E2B sandbox created in ${(createDuration / 1000).toFixed(1)}s`
      );

      console.log(`[Sandbox Manager] 🔍 Getting sandbox info from E2B...`);
      const infoStartTime = Date.now();
      const info = await e2bSandbox.getInfo();
      const infoDuration = Date.now() - infoStartTime;
      const expiresAt = new Date(info.endAt);
      console.log(
        `[Sandbox Manager] ✅ Sandbox info retrieved (${infoDuration}ms)`
      );
      console.log(`[Sandbox Manager]   - E2B ID: ${info.sandboxId}`);
      console.log(`[Sandbox Manager]   - Template ID: ${info.templateId}`);
      console.log(`[Sandbox Manager]   - Expires: ${expiresAt.toISOString()}`);

      // Store in database
      console.log(`[Sandbox Manager] 💾 Storing sandbox in database...`);
      const dbStartTime = Date.now();
      const dbSandbox = await db.sandbox.create({
        data: {
          e2bId: info.sandboxId,
          status: 'ACTIVE',
          projectId,
          templateId: info.templateId,
          lastActivity: new Date(),
          expiresAt,
          metadata: {
            projectId,
            userId,
          },
        },
      });
      const dbDuration = Date.now() - dbStartTime;
      console.log(
        `[Sandbox Manager] ✅ Sandbox saved to database (${dbDuration}ms)`
      );
      console.log(`[Sandbox Manager] DB ID: ${dbSandbox.id}`);

      // Cache the E2B instance
      this.activeSandboxes.set(dbSandbox.id, e2bSandbox);
      console.log(
        `[Sandbox Manager] 💾 Cached sandbox instance (cache size: ${this.activeSandboxes.size})`
      );

      const totalDuration = Date.now() - createStartTime;
      console.log(`[Sandbox Manager] ✅ ========== SANDBOX CREATED ==========`);
      console.log(`[Sandbox Manager] DB ID: ${dbSandbox.id}`);
      console.log(`[Sandbox Manager] E2B ID: ${dbSandbox.e2bId}`);
      console.log(
        `[Sandbox Manager] Total time: ${(totalDuration / 1000).toFixed(1)}s`
      );

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
      console.error(`[Sandbox Manager] ❌ ========== CREATE FAILED ==========`);
      console.error('[Sandbox Manager] Error:', error);
      console.error(
        '[Sandbox Manager] Error type:',
        error?.constructor?.name ?? 'Unknown'
      );
      console.error(
        '[Sandbox Manager] Error message:',
        error instanceof Error ? error.message : 'Failed to create sandbox'
      );
      console.error(
        '[Sandbox Manager] Error stack:',
        error instanceof Error ? error.stack : 'No stack'
      );
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
   * Priority: Existing active → Resume paused → Create new
   */
  async getOrCreateSandbox(
    db: PrismaClient,
    projectId: string,
    userId: string,
    timeoutMs?: number
  ): Promise<ServiceResult<SandboxInstance>> {
    console.log(
      `[Sandbox Manager] 🔍 ========== GET OR CREATE SANDBOX ==========`
    );
    console.log(`[Sandbox Manager] Project ID: ${projectId}`);
    console.log(`[Sandbox Manager] User ID: ${userId}`);
    console.log(
      `[Sandbox Manager] Timeout: ${timeoutMs ? `${timeoutMs}ms` : 'default'}`
    );
    console.log(`[Sandbox Manager] Timestamp: ${new Date().toISOString()}`);

    try {
      console.log(
        `[Sandbox Manager] 🔍 Searching for existing active sandbox in database...`
      );
      const queryStartTime = Date.now();
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
      const queryDuration = Date.now() - queryStartTime;
      console.log(
        `[Sandbox Manager] Database query completed in ${queryDuration}ms`
      );

      if (existingSandbox) {
        console.log(`[Sandbox Manager] ✅ Found existing sandbox in database:`);
        console.log(`[Sandbox Manager]   - DB ID: ${existingSandbox.id}`);
        console.log(`[Sandbox Manager]   - E2B ID: ${existingSandbox.e2bId}`);
        console.log(
          `[Sandbox Manager]   - Created: ${existingSandbox.createdAt.toISOString()}`
        );
        console.log(
          `[Sandbox Manager]   - Expires: ${existingSandbox.expiresAt?.toISOString() ?? 'never'}`
        );
        console.log(
          `[Sandbox Manager]   - Last activity: ${existingSandbox.lastActivity?.toISOString() ?? 'unknown'}`
        );

        // Try to get cached instance
        console.log(
          `[Sandbox Manager] 🔍 Checking if sandbox is in memory cache...`
        );
        let instance = this.activeSandboxes.get(existingSandbox.id);
        const inCache = !!instance;
        console.log(
          `[Sandbox Manager] Cache lookup: ${inCache ? '✅ FOUND' : '❌ NOT FOUND'}`
        );
        console.log(
          `[Sandbox Manager] Total cached sandboxes: ${this.activeSandboxes.size}`
        );

        // Validate cached instance is still alive
        if (instance) {
          console.log(
            `[Sandbox Manager] 🔍 Validating cached sandbox instance...`
          );
          const validateStartTime = Date.now();
          try {
            const info = await instance.getInfo();
            const validateDuration = Date.now() - validateStartTime;
            console.log(
              `[Sandbox Manager] ✅ Cached sandbox is valid and accessible (${validateDuration}ms)`
            );
            console.log(
              `[Sandbox Manager] Sandbox status: ${info.endAt ? `expires ${new Date(info.endAt).toISOString()}` : 'no expiration'}`
            );
          } catch (error) {
            const validateDuration = Date.now() - validateStartTime;
            console.error(
              `[Sandbox Manager] ❌ Cached sandbox validation failed after ${validateDuration}ms`
            );
            console.error(`[Sandbox Manager] Error:`, error);
            console.error(
              `[Sandbox Manager] Error message:`,
              error instanceof Error ? error.message : 'Unknown'
            );
            console.log(
              `[Sandbox Manager] Removing dead sandbox from cache...`
            );
            this.activeSandboxes.delete(existingSandbox.id);
            instance = undefined;
          }
        }

        if (!instance && FEATURE_FLAGS.usePersistence) {
          console.log(
            `[Sandbox Manager] 🔄 Sandbox not in cache, attempting E2B resume...`
          );
          console.log(`[Sandbox Manager] E2B ID: ${existingSandbox.e2bId}`);

          const startTime = Date.now();
          try {
            console.log(`[Sandbox Manager] 🔌 Connecting to E2B sandbox...`);
            instance = await Sandbox.connect(existingSandbox.e2bId, {
              apiKey: E2B_CONFIG.apiKey,
              timeoutMs: E2B_CONFIG.maxTimeoutMs,
            });
            const connectDuration = Date.now() - startTime;
            console.log(
              `[Sandbox Manager] ✅ Connected to E2B in ${connectDuration}ms`
            );

            // Validate the resumed instance
            console.log(`[Sandbox Manager] 🔍 Validating resumed instance...`);
            const validateStartTime = Date.now();
            await instance.getInfo();
            const validateDuration = Date.now() - validateStartTime;
            console.log(
              `[Sandbox Manager] ✅ Resumed sandbox validated (${validateDuration}ms)`
            );

            // Cache the resumed instance
            this.activeSandboxes.set(existingSandbox.id, instance);
            console.log(
              `[Sandbox Manager] 💾 Cached resumed instance (cache size: ${this.activeSandboxes.size})`
            );

            const totalResumeTime = Date.now() - startTime;
            console.log(
              `[Sandbox Manager] ✅ Successfully resumed sandbox ${existingSandbox.e2bId} in ${totalResumeTime}ms`
            );
          } catch (resumeError) {
            const resumeDuration = Date.now() - startTime;
            console.error(
              `[Sandbox Manager] ❌ Failed to resume sandbox after ${resumeDuration}ms`
            );
            console.error(`[Sandbox Manager] E2B ID: ${existingSandbox.e2bId}`);
            console.error(`[Sandbox Manager] Error:`, resumeError);
            console.error(
              `[Sandbox Manager] Error type:`,
              resumeError?.constructor?.name ?? 'Unknown'
            );
            console.error(
              `[Sandbox Manager] Error message:`,
              resumeError instanceof Error ? resumeError.message : 'Unknown'
            );

            // Mark as stopped in database
            console.log(
              `[Sandbox Manager] 📝 Marking sandbox as STOPPED in database...`
            );
            const updateStartTime = Date.now();
            await db.sandbox.update({
              where: { id: existingSandbox.id },
              data: { status: 'STOPPED' },
            });
            const updateDuration = Date.now() - updateStartTime;
            console.log(
              `[Sandbox Manager] ✅ Database updated (${updateDuration}ms)`
            );

            // Fall through to create new sandbox
            console.log(
              `[Sandbox Manager] Will create new sandbox as fallback...`
            );
            instance = undefined;
          }
        } else if (!instance && !FEATURE_FLAGS.usePersistence) {
          console.warn(
            `[Sandbox Manager] ⚠️ Persistence is disabled, cannot resume sandbox`
          );
          console.log(`[Sandbox Manager] Will create new sandbox...`);
        }

        if (instance) {
          // Update last activity
          console.log(
            `[Sandbox Manager] 📝 Updating last activity timestamp...`
          );
          const updateStartTime = Date.now();
          await db.sandbox.update({
            where: { id: existingSandbox.id },
            data: { lastActivity: new Date() },
          });
          const updateDuration = Date.now() - updateStartTime;
          console.log(
            `[Sandbox Manager] ✅ Last activity updated (${updateDuration}ms)`
          );

          console.log(
            `[Sandbox Manager] ✅ ========== RETURNING EXISTING SANDBOX ==========`
          );
          console.log(`[Sandbox Manager] DB ID: ${existingSandbox.id}`);
          console.log(`[Sandbox Manager] E2B ID: ${existingSandbox.e2bId}`);
          console.log(
            `[Sandbox Manager] Source: ${inCache ? 'cache' : 'resumed from E2B'}`
          );

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
      } else {
        console.log(
          `[Sandbox Manager] ❌ No existing active sandbox found in database`
        );
      }

      // Create new sandbox (fallback)
      console.log(
        `[Sandbox Manager] 🆕 No usable existing sandbox - creating new one...`
      );
      return this.createSandbox(db, projectId, userId, timeoutMs);
    } catch (error) {
      console.error(
        `[Sandbox Manager] ❌ ========== GET OR CREATE FAILED ==========`
      );
      console.error('[Sandbox Manager] Error:', error);
      console.error(
        '[Sandbox Manager] Error type:',
        error?.constructor?.name ?? 'Unknown'
      );
      console.error(
        '[Sandbox Manager] Error message:',
        error instanceof Error ? error.message : 'Unknown error'
      );
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
   * Recreate sandbox for a project
   * Destroys any existing active sandbox and creates a fresh one
   * Used for preview regeneration to ensure clean environment with npm available
   */
  async recreateSandbox(
    db: PrismaClient,
    projectId: string,
    userId: string,
    timeoutMs?: number
  ): Promise<ServiceResult<SandboxInstance>> {
    try {
      console.log(
        `[Sandbox Manager] 🔄 Recreating sandbox for project: ${projectId}`
      );

      // Find existing active sandbox
      const existingSandbox = await db.sandbox.findFirst({
        where: {
          projectId,
          status: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Stop existing sandbox if found
      if (existingSandbox) {
        console.log(
          `[Sandbox Manager] Found existing sandbox ${existingSandbox.e2bId}, stopping it...`
        );

        // Get cached instance if available
        let instance = this.activeSandboxes.get(existingSandbox.id);

        // If not in cache, try to reconnect to kill it properly
        // This is CRITICAL for old sandboxes that aren't in memory cache
        if (!instance && FEATURE_FLAGS.usePersistence) {
          console.log(
            `[Sandbox Manager] Sandbox not in cache, reconnecting to kill it...`
          );
          try {
            instance = await Sandbox.connect(existingSandbox.e2bId, {
              apiKey: E2B_CONFIG.apiKey,
              timeoutMs: 10000, // Short timeout for kill operation
            });
            console.log(
              `[Sandbox Manager] ✅ Reconnected to old sandbox for termination`
            );
          } catch (error) {
            console.warn(
              `[Sandbox Manager] ⚠️ Could not reconnect to old sandbox (may already be terminated):`,
              error
            );
            // Continue - sandbox might already be dead on E2B's side
          }
        }

        // Kill E2B sandbox if we have instance (either from cache or reconnected)
        if (instance) {
          try {
            await withRetry(
              () => e2bClient.killSandbox(instance),
              'Kill Sandbox'
            );
            this.activeSandboxes.delete(existingSandbox.id);
            console.log(
              `[Sandbox Manager] ✅ Stopped E2B sandbox ${existingSandbox.e2bId}`
            );
          } catch (error) {
            console.warn(
              '[Sandbox Manager] ⚠️ Failed to kill E2B sandbox (may already be stopped):',
              error
            );
            // Continue anyway - we'll mark it as stopped in DB
          }
        }

        // Mark as stopped in database
        await db.sandbox.update({
          where: { id: existingSandbox.id },
          data: {
            status: 'STOPPED',
            expiresAt: new Date(), // Mark as expired
          },
        });

        console.log(
          `[Sandbox Manager] ✅ Old sandbox marked as STOPPED in database`
        );
      } else {
        console.log(
          `[Sandbox Manager] No existing active sandbox found for project`
        );
      }

      // Create fresh sandbox
      console.log(`[Sandbox Manager] Creating fresh sandbox...`);
      const createResult = await this.createSandbox(
        db,
        projectId,
        userId,
        timeoutMs
      );

      if (!createResult.success || !createResult.data) {
        return {
          success: false,
          data: null,
          error: createResult.error ?? 'Failed to create new sandbox',
        };
      }

      console.log(
        `[Sandbox Manager] ✅ Fresh sandbox created: ${createResult.data.e2bId}`
      );

      return createResult;
    } catch (error) {
      console.error('[Sandbox Manager] Recreate sandbox failed:', error);
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Failed to recreate sandbox',
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

  /**
   * Resume a sandbox by connecting to its E2B ID
   * Used internally by getOrCreateSandbox and E2B tools
   */
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

  /**
   * Read all project files from sandbox
   * Used to sync files from E2B sandbox to database
   * @param instance - E2B sandbox instance to read files from
   */
  async readAllFiles(
    instance: E2BSandbox
  ): Promise<
    ServiceResult<Array<{ path: string; content: string; language: string }>>
  > {
    try {
      if (!instance) {
        return {
          success: false,
          data: null,
          error: 'Sandbox instance is required',
        };
      }

      // List all files recursively in /project
      // Exclude build artifacts: node_modules, .git, dist, build, .next, .cache
      const findCmd = `find /project -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" ! -path "*/build/*" ! -path "*/.next/*" ! -path "*/.cache/*" ! -name "package-lock.json" ! -name "*.log" 2>/dev/null || true`;

      const listResult = await instance.commands.run(findCmd);
      const filePaths = listResult.stdout
        .split('\n')
        .filter((path) => path.trim().length > 0)
        .filter((path) => !path.includes('node_modules'));

      if (filePaths.length === 0) {
        console.log('[Sandbox Manager] No files found in sandbox');
        return {
          success: true,
          data: [],
          error: null,
        };
      }

      console.log(
        `[Sandbox Manager] Found ${filePaths.length} files in sandbox`
      );

      // Read each file
      const files: Array<{ path: string; content: string; language: string }> =
        [];

      for (const fullPath of filePaths) {
        try {
          // Read file content
          const readResult = await instance.commands.run(`cat "${fullPath}"`);

          // Extract relative path from /project
          const relativePath = fullPath.replace('/project/', '');

          // Detect language from file extension
          const language = this.detectLanguage(relativePath);

          files.push({
            path: relativePath,
            content: readResult.stdout,
            language,
          });
        } catch (error) {
          console.warn(
            `[Sandbox Manager] Failed to read file ${fullPath}:`,
            error
          );
          // Continue with other files
        }
      }

      console.log(
        `[Sandbox Manager] Successfully read ${files.length} files from sandbox`
      );

      return {
        success: true,
        data: files,
        error: null,
      };
    } catch (error) {
      console.error(
        '[Sandbox Manager] Failed to read files from sandbox:',
        error
      );
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to read files from sandbox',
      };
    }
  }

  /**
   * Detect programming language from file extension
   * Returns standard language names compatible with database and UI
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
      markdown: 'markdown',
      // Additional languages
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      sh: 'bash',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      svg: 'svg',
      txt: 'plaintext',
    };
    return languageMap[ext ?? ''] ?? 'plaintext';
  }

  /**
   * Get cached E2B instance (for internal use)
   */
  getCachedInstance(sandboxId: string): E2BSandbox | undefined {
    return this.activeSandboxes.get(sandboxId);
  }
}

export const sandboxManager = new SandboxManager();
