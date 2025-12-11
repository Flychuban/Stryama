import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { sandboxManager } from '~/lib/integrations/e2b';
import { E2B_CONFIG } from '~/lib/integrations/e2b';
import { FileSync } from '~/lib/integrations/e2b/services/file-sync';
import {
  startPreviewServer,
  getPreviewLogs,
  restartPreviewServer,
} from '~/lib/integrations/e2b/services/preview-manager';
import { logStreamer } from '~/lib/integrations/e2b/services/log-streamer';

export const sandboxRouter = createTRPCRouter({
  /**
   * Get existing sandbox or create new one for a project
   */
  getOrCreate: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      // Get or create sandbox
      const result = await sandboxManager.getOrCreateSandbox(
        ctx.db,
        input.projectId,
        ctx.auth.userId
      );

      if (!result.success || !result.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to create sandbox',
        });
      }

      return {
        sandboxId: result.data.id,
        e2bId: result.data.e2bId,
        status: result.data.status,
        expiresAt: result.data.expiresAt,
      };
    }),

  /**
   * Get sandbox status and health
   */
  getStatus: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership through project
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.getHealth(ctx.db, input.sandboxId);

      if (!result.success || !result.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to get sandbox status',
        });
      }

      return result.data;
    }),

  /**
   * Destroy a sandbox
   */
  destroy: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.destroySandbox(
        ctx.db,
        input.sandboxId
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to destroy sandbox',
        });
      }

      return { success: true };
    }),

  /**
   * Extend sandbox timeout
   */
  extendTimeout: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
        additionalMs: z
          .number()
          .min(60_000, 'Minimum extension is 1 minute')
          .max(E2B_CONFIG.maxTimeoutMs, 'Extension exceeds maximum allowed'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.extendTimeout(
        ctx.db,
        input.sandboxId,
        input.additionalMs
      );

      if (!result.success || !result.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to extend timeout',
        });
      }

      return {
        newExpiresAt: result.data,
      };
    }),

  /**
   * Get detailed sandbox information
   */
  getInfo: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      return {
        id: sandbox.id,
        e2bId: sandbox.e2bId,
        status: sandbox.status,
        projectId: sandbox.projectId,
        templateId: sandbox.templateId,
        previewUrl: sandbox.previewUrl,
        lastActivity: sandbox.lastActivity,
        expiresAt: sandbox.expiresAt,
        createdAt: sandbox.createdAt,
        metadata: sandbox.metadata,
      };
    }),

  syncFiles: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        fileIds: z.array(z.string()).optional(), // If not provided, sync all files
        syncType: z.enum(['all', 'incremental', 'changed']).default('all'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      // Get or create sandbox
      const sandboxResult = await sandboxManager.getOrCreateSandbox(
        ctx.db,
        input.projectId,
        ctx.auth.userId
      );

      if (!sandboxResult.success || !sandboxResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: sandboxResult.error ?? 'Failed to get/create sandbox',
        });
      }

      // Perform sync based on type
      let syncResult;
      switch (input.syncType) {
        case 'all':
          syncResult = await FileSync.syncAllFiles(
            sandboxResult.data.instance,
            sandboxResult.data.id,
            input.projectId,
            ctx.db
          );
          break;

        case 'incremental':
          if (!input.fileIds || input.fileIds.length === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'fileIds required for incremental sync',
            });
          }
          syncResult = await FileSync.syncIncrementalFiles(
            sandboxResult.data.instance,
            sandboxResult.data.id,
            input.fileIds,
            ctx.db
          );
          break;

        case 'changed':
          syncResult = await FileSync.syncChangedFiles(
            sandboxResult.data.instance,
            sandboxResult.data.id,
            input.projectId,
            ctx.db
          );
          break;

        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid sync type',
          });
      }

      if (!syncResult.success || !syncResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: syncResult.error ?? 'Failed to sync files',
        });
      }

      return {
        sandboxId: sandboxResult.data.id,
        totalFiles: syncResult.data.totalFiles,
        syncedFiles: syncResult.data.syncedFiles,
        failedFiles: syncResult.data.failedFiles,
        duration: syncResult.data.duration,
        timestamp: syncResult.data.timestamp,
      };
    }),

  startPreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
        sandboxId: z.string().optional(), // Optional: use existing sandbox from AI generation
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
        include: {
          files: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      let sandboxResult;

      // If sandboxId provided (from AI generation), use that specific sandbox
      // This prevents destroying the sandbox where Claude just wrote files
      if (input.sandboxId) {
        console.log(
          `[Preview] Using specific sandbox from AI generation: ${input.sandboxId}`
        );

        const dbSandbox = await ctx.db.sandbox.findUnique({
          where: { id: input.sandboxId },
        });

        if (!dbSandbox) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Sandbox not found',
          });
        }

        // Get the cached instance or reconnect
        let instance = sandboxManager.getCachedInstance(input.sandboxId);

        if (!instance) {
          // Reconnect to existing sandbox
          const { Sandbox } = await import('@e2b/code-interpreter');
          const { E2B_CONFIG } = await import('~/lib/integrations/e2b/config');

          instance = await Sandbox.connect(dbSandbox.e2bId, {
            apiKey: E2B_CONFIG.apiKey,
            timeoutMs: E2B_CONFIG.maxTimeoutMs,
          });
        }

        sandboxResult = {
          success: true,
          data: {
            id: dbSandbox.id,
            e2bId: dbSandbox.e2bId,
            status: dbSandbox.status,
            expiresAt: dbSandbox.expiresAt,
            instance,
          },
          error: null,
        };
      } else {
        // Fallback: Get or create sandbox (old behavior)
        console.log(
          `[Preview] No sandboxId provided, using getOrCreateSandbox`
        );
        sandboxResult = await sandboxManager.getOrCreateSandbox(
          ctx.db,
          input.projectId,
          ctx.auth.userId
        );
      }

      if (!sandboxResult.success || !sandboxResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: sandboxResult.error ?? 'Failed to get/create sandbox',
        });
      }

      // NOTE: When using E2B MCP tools, files are already in the sandbox
      // No need to sync again - they were written directly during code generation
      console.log(
        `[Preview] Starting preview server (files already in sandbox from MCP tools)`
      );

      // Start preview server (React+Vite)
      // Pass sandboxId to enable DB metadata checking for dev server coordination
      const previewResult = await startPreviewServer(
        sandboxResult.data.instance,
        input.projectId,
        project.files,
        sandboxResult.data.id
      );

      if (!previewResult.success || !previewResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: previewResult.error ?? 'Failed to start preview server',
        });
      }

      // Get current sandbox metadata from database
      const currentSandbox = await ctx.db.sandbox.findUnique({
        where: { id: sandboxResult.data.id },
        select: { metadata: true },
      });

      // Update sandbox with preview URL in database
      await ctx.db.sandbox.update({
        where: { id: sandboxResult.data.id },
        data: {
          previewUrl: previewResult.data.url,
          metadata: {
            ...(currentSandbox?.metadata as object | undefined),
            previewPort: previewResult.data.port,
            previewStartedAt: previewResult.data.startTime.toISOString(),
          },
        },
      });

      return {
        url: previewResult.data.url,
        port: previewResult.data.port,
        sandboxId: sandboxResult.data.id,
      };
    }),

  /**
   * Get existing preview URL for a project
   */
  getPreviewUrl: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify project ownership and get sandbox
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
        include: {
          sandboxes: {
            where: {
              status: 'ACTIVE',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      const sandbox = project.sandboxes[0];

      if (!sandbox?.previewUrl) {
        return {
          url: null,
          port: null,
        };
      }

      const metadata = sandbox.metadata as Record<string, unknown> | null;

      return {
        url: sandbox.previewUrl,
        port: metadata?.previewPort as number | null,
      };
    }),

  /**
   * Get project sandbox status and health
   * Used to check if project's sandbox is alive or expired
   */
  getProjectStatus: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify project ownership and get active sandbox
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
        include: {
          sandboxes: {
            where: {
              status: 'ACTIVE',
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      const sandbox = project.sandboxes[0];

      // No active sandbox
      if (!sandbox) {
        return {
          hasActiveSandbox: false,
          isExpired: true,
          status: 'STOPPED' as const,
          sandboxId: null,
        };
      }

      // Check if sandbox is expired
      const isExpired = sandbox.expiresAt
        ? sandbox.expiresAt < new Date()
        : false;

      // If expired, mark as STOPPED
      if (isExpired) {
        await ctx.db.sandbox.update({
          where: { id: sandbox.id },
          data: { status: 'STOPPED' },
        });

        return {
          hasActiveSandbox: false,
          isExpired: true,
          status: 'STOPPED' as const,
          sandboxId: sandbox.id,
        };
      }

      return {
        hasActiveSandbox: true,
        isExpired: false,
        status: sandbox.status,
        sandboxId: sandbox.id,
        expiresAt: sandbox.expiresAt,
      };
    }),

  /**
   * Regenerate preview from database files
   * Creates new sandbox, syncs files from DB, and starts preview
   */
  regeneratePreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();
      console.log(
        `[Sandbox Router] 🔄 Regenerating preview for project: ${input.projectId}`
      );

      try {
        // Verify project ownership and get files
        const project = await ctx.db.project.findUnique({
          where: {
            id: input.projectId,
            clerkUserId: ctx.auth.userId,
          },
          include: {
            files: true,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found or access denied',
          });
        }

        // Check if project has files
        if (project.files.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message:
              'No files found for this project. Please generate code first.',
          });
        }

        console.log(
          `[Sandbox Router] Found ${project.files.length} files to sync`
        );

        // CRITICAL FIX: Always create a FRESH sandbox for preview regeneration
        // This ensures npm is available and prevents exit code 127 errors
        // Resumed/reconnected sandboxes lose their environment setup (PATH)
        console.log(
          `[Sandbox Router] Creating fresh sandbox for regeneration (ensures clean npm environment)...`
        );
        const sandboxResult = await sandboxManager.recreateSandbox(
          ctx.db,
          input.projectId,
          ctx.auth.userId,
          E2B_CONFIG.maxTimeoutMs
        );

        if (!sandboxResult.success || !sandboxResult.data) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: sandboxResult.error ?? 'Failed to create sandbox',
          });
        }

        const { instance: sandbox, id: sandboxId } = sandboxResult.data;

        console.log(`[Sandbox Router] Sandbox ready: ${sandboxId}`);

        // Sync all files from database to sandbox
        console.log(`[Sandbox Router] 📂 Syncing files to sandbox...`);

        const fileSyncResult = await FileSync.syncAllFiles(
          sandbox,
          sandboxId,
          input.projectId,
          ctx.db
        );

        if (!fileSyncResult.success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: fileSyncResult.error ?? 'Failed to sync files to sandbox',
          });
        }

        console.log(
          `[Sandbox Router] ✅ Synced ${fileSyncResult.data?.syncedFiles ?? 0} files`
        );

        // Start preview server (this includes npm install if needed)
        console.log(`[Sandbox Router] 🚀 Starting preview server...`);

        // Pass sandboxId to enable DB metadata checking for dev server coordination
        // CRITICAL: Pass forceRestart=true since this is a FRESH sandbox with no existing server
        // This skips the health check on old URLs and saves ~18 seconds
        const previewResult = await startPreviewServer(
          sandbox,
          input.projectId,
          project.files,
          sandboxId,
          true // forceRestart - skip health check for fresh sandbox
        );

        if (!previewResult.success || !previewResult.data) {
          // Check if error is timeout-related
          const errorMsg =
            previewResult.error ?? 'Failed to start preview server';

          if (errorMsg.includes('npm command not found')) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message:
                'npm command not found in sandbox environment. Please try regenerating the preview again.',
            });
          }

          if (
            errorMsg.includes('timeout') ||
            errorMsg.includes('deadline_exceeded')
          ) {
            throw new TRPCError({
              code: 'TIMEOUT',
              message:
                'Preview generation timed out while installing dependencies. This usually happens with large projects. Please try again or contact support if the issue persists.',
            });
          }

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: errorMsg,
          });
        }

        // CRITICAL FIX: Save previewUrl to database so AI Stream can find it
        // Previously this was missing, causing AI Stream to think no server was running
        console.log(`[Sandbox Router] 💾 Saving preview URL to database...`);
        await ctx.db.sandbox.update({
          where: { id: sandboxId },
          data: {
            previewUrl: previewResult.data.url,
            lastActivity: new Date(),
          },
        });
        console.log(`[Sandbox Router] ✅ Preview URL saved to database`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `[Sandbox Router] ✅ Preview ready in ${duration}s: ${previewResult.data.url}`
        );

        return {
          url: previewResult.data.url,
          sandboxId,
          filesSynced: fileSyncResult.data?.syncedFiles ?? 0,
        };
      } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(
          `[Sandbox Router] ❌ Preview regeneration failed after ${duration}s:`,
          error
        );

        // Re-throw TRPCErrors as-is
        if (error instanceof TRPCError) {
          throw error;
        }

        if (error instanceof Error) {
          const errorMsg = error.message;

          // npm command not found (exit code 127)
          if (
            errorMsg.includes('npm command not found') ||
            errorMsg.includes('exit status 127') ||
            errorMsg.includes('command not found')
          ) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message:
                'npm command not found in sandbox environment. Please try regenerating the preview again.',
            });
          }

          // Handle timeout errors
          if (
            errorMsg.includes('timeout') ||
            errorMsg.includes('deadline_exceeded')
          ) {
            throw new TRPCError({
              code: 'TIMEOUT',
              message:
                'Operation timed out. The preview server took too long to start (likely due to npm install). Please try again.',
            });
          }
        }

        // Generic error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? error.message
              : 'Unknown error occurred during preview regeneration',
        });
      }
    }),

  /**
   * Get preview server logs
   */
  getPreviewLogs: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify project ownership
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      // Get sandbox
      const sandboxResult = await sandboxManager.getOrCreateSandbox(
        ctx.db,
        input.projectId,
        ctx.auth.userId
      );

      if (!sandboxResult.success || !sandboxResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: sandboxResult.error ?? 'Failed to get sandbox',
        });
      }

      // Get preview logs
      const logsResult = await getPreviewLogs(sandboxResult.data.instance);

      if (!logsResult.success || !logsResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: logsResult.error ?? 'Failed to get preview logs',
        });
      }

      return {
        logs: logsResult.data,
      };
    }),

  /**
   * Restart preview server
   */
  restartPreview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1, 'Project ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify project ownership
      const project = await ctx.db.project.findUnique({
        where: {
          id: input.projectId,
          clerkUserId: ctx.auth.userId,
        },
        include: {
          files: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or access denied',
        });
      }

      // Get sandbox
      const sandboxResult = await sandboxManager.getOrCreateSandbox(
        ctx.db,
        input.projectId,
        ctx.auth.userId
      );

      if (!sandboxResult.success || !sandboxResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: sandboxResult.error ?? 'Failed to get sandbox',
        });
      }

      // NOTE: When using E2B MCP tools, files are already in the sandbox
      // Files are written directly during code generation via MCP tools
      console.log(
        `[Preview] Restarting preview server (files already in sandbox from MCP tools)`
      );

      // Restart preview server
      // Pass sandboxId to enable DB metadata checking for dev server coordination
      const previewResult = await restartPreviewServer(
        sandboxResult.data.instance,
        input.projectId,
        project.files,
        sandboxResult.data.id
      );

      if (!previewResult.success || !previewResult.data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: previewResult.error ?? 'Failed to restart preview server',
        });
      }

      // Get current sandbox metadata from database
      const currentSandbox = await ctx.db.sandbox.findUnique({
        where: { id: sandboxResult.data.id },
        select: { metadata: true },
      });

      // Update sandbox with new preview URL
      await ctx.db.sandbox.update({
        where: { id: sandboxResult.data.id },
        data: {
          previewUrl: previewResult.data.url,
          metadata: {
            ...(currentSandbox?.metadata as object | undefined),
            previewPort: previewResult.data.port,
            previewStartedAt: previewResult.data.startTime.toISOString(),
          },
        },
      });

      return {
        url: previewResult.data.url,
        port: previewResult.data.port,
        sandboxId: sandboxResult.data.id,
      };
    }),

  resume: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const result = await sandboxManager.resumeSandbox(
        ctx.db,
        input.sandboxId
      );

      if (!result.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: result.error ?? 'Failed to resume sandbox',
        });
      }

      return { success: true };
    }),

  /**
   * Subscribe to real-time console logs for a sandbox
   * Uses tRPC subscriptions to stream log entries as they arrive
   */
  subscribeLogs: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
        includeHistory: z.boolean().default(true),
      })
    )
    .subscription(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      // Create observable from async iterator
      return observable<{
        id: string;
        sandboxId: string;
        level: 'stdout' | 'stderr' | 'info' | 'warn' | 'error';
        message: string;
        timestamp: number;
        source?: 'preview' | 'build' | 'install' | 'command';
      }>((emit) => {
        // Start streaming logs
        const streamLogs = async () => {
          try {
            for await (const log of logStreamer.subscribe(
              input.sandboxId,
              input.includeHistory
            )) {
              emit.next(log);
            }
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            emit.error(
              new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Log streaming error: ${errorMessage}`,
              })
            );
          }
        };

        void streamLogs();

        // Cleanup on unsubscribe
        return () => {
          // The async iterator cleanup happens automatically when the generator is closed
          console.log(
            `[Logs] Client unsubscribed from sandbox ${input.sandboxId}`
          );
        };
      });
    }),

  /**
   * Get historical logs for a sandbox (non-streaming)
   */
  getLogHistory: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
        limit: z.number().min(1).max(1000).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      const logs = logStreamer.getHistory(input.sandboxId, input.limit);

      return {
        logs,
        total: logs.length,
      };
    }),

  /**
   * Clear all logs for a sandbox
   */
  clearLogs: protectedProcedure
    .input(
      z.object({
        sandboxId: z.string().min(1, 'Sandbox ID is required'),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const sandbox = await ctx.db.sandbox.findUnique({
        where: { id: input.sandboxId },
        include: { project: true },
      });

      if (
        !sandbox ||
        !sandbox.project ||
        sandbox.project.clerkUserId !== ctx.auth.userId
      ) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Sandbox not found or access denied',
        });
      }

      logStreamer.clearLogs(input.sandboxId);

      return { success: true };
    }),

  /**
   * Get log streaming statistics
   */
  getLogStats: protectedProcedure.query(() => {
    const stats = logStreamer.getStats();

    return {
      activeBuffers: stats.activeBuffers,
      activeSubscribers: stats.activeSubscribers,
      totalLogs: stats.totalLogs,
    };
  }),
});
