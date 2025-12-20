import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { netlifyClient } from '~/lib/integrations/netlify/client';
import { NetlifyDeployService } from '~/lib/integrations/netlify/services/deploy';
import {
  NetlifyAuthError,
  NetlifyDeployError,
  NetlifyBuildError,
  NetlifyBuildTooLargeError,
  NetlifyDeployTimeoutError,
  NetlifyRateLimitError,
  NetlifySiteConflictError,
} from '~/lib/integrations/netlify/errors';
import * as Sentry from '@sentry/nextjs';
import type { db as DbType } from '~/server/db';
import { sandboxManager } from '~/lib/integrations/e2b';
import type { Sandbox } from '@e2b/code-interpreter';

/**
 * Helper function to get Netlify token from database
 * Since we're using custom OAuth flow, tokens are stored in database
 */
async function getNetlifyToken(
  userId: string,
  db: typeof DbType
): Promise<string> {
  try {
    const connection = await db.netlifyConnection.findUnique({
      where: { clerkUserId: userId },
      select: { accessToken: true },
    });

    if (!connection?.accessToken) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Netlify not connected. Please connect your Netlify account.',
      });
    }

    return connection.accessToken;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    Sentry.captureException(error, {
      tags: { feature: 'netlify_get_token' },
      extra: { userId },
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve Netlify token',
      cause: error,
    });
  }
}

export const netlifyRouter = createTRPCRouter({
  /**
   * Verify Netlify connection after OAuth callback
   * Called automatically after user authorizes Netlify via custom OAuth flow
   * The API callback route already saved the connection, this just verifies and tracks analytics
   */
  connectAfterOAuth: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Verify connection exists in database (was created by API callback)
      const connection = await ctx.db.netlifyConnection.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Netlify connection not found. Please try connecting again.',
        });
      }

      return connection;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      Sentry.captureException(error, {
        tags: { feature: 'netlify_connect_after_oauth' },
        extra: { userId: ctx.auth.userId },
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify Netlify connection',
        cause: error,
      });
    }
  }),

  /**
   * Disconnect Netlify account
   */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await ctx.db.netlifyConnection.delete({
        where: { clerkUserId: ctx.auth.userId },
      });

      return { success: true };
    } catch (error) {
      // If connection doesn't exist, that's fine (Prisma P2025 error)
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        return { success: true };
      }

      Sentry.captureException(error, {
        tags: { feature: 'netlify_disconnect' },
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to disconnect Netlify account',
        cause: error,
      });
    }
  }),

  /**
   * Get Netlify connection status
   */
  getConnection: protectedProcedure.query(async ({ ctx }) => {
    const connection = await ctx.db.netlifyConnection.findUnique({
      where: { clerkUserId: ctx.auth.userId },
      include: {
        deployments: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return connection;
  }),

  /**
   * List user's Netlify sites
   */
  listSites: protectedProcedure.query(async ({ ctx }) => {
    try {
      const token = await getNetlifyToken(ctx.auth.userId, ctx.db);
      const client = netlifyClient.getClient(token);

      const sites = await client.listSites();

      // Return only necessary fields to reduce payload
      return sites.map((site) => ({
        id: site.id,
        name: site.name,
        url: site.ssl_url || site.url,
        createdAt: site.created_at,
      }));
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      if (error instanceof NetlifyAuthError) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: error.message,
        });
      }

      Sentry.captureException(error, {
        tags: { feature: 'netlify_list_sites' },
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to list Netlify sites',
        cause: error,
      });
    }
  }),

  /**
   * Deploy project to Netlify
   *
   * CRITICAL: This procedure connects to an ACTIVE E2B sandbox,
   * builds the project, and deploys it to Netlify.
   *
   * Requirements:
   * - User must have an active preview running (sandbox exists)
   * - Netlify account must be connected
   * - Project must belong to user
   */
  deployProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        projectName: z.string(),
        existingSiteId: z.string().optional().nullable(),
        customSubdomain: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let sandbox: Sandbox | null = null;
      let sandboxE2bId: string | null = null;

      try {
        // 1. Verify project ownership
        const project = await ctx.db.project.findFirst({
          where: {
            id: input.projectId,
            clerkUserId: ctx.auth.userId,
          },
          include: { files: true },
        });

        if (!project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found',
          });
        }

        if (!project.files || project.files.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Project has no files to deploy',
          });
        }

        // 2. Get ACTIVE sandbox for project using SandboxManager
        // CRITICAL: This gets a validated, cached E2B instance
        // The SandboxManager handles connection caching, validation, and error handling
        console.log(
          `[Netlify Deploy] Getting sandbox for project ${input.projectId}...`
        );

        const sandboxResult = await sandboxManager.getOrCreateSandbox(
          ctx.db,
          input.projectId,
          ctx.auth.userId
        );

        if (!sandboxResult.success || !sandboxResult.data) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message:
              sandboxResult.error ??
              'No active preview found. Please open the project in the editor and start a preview before deploying.',
          });
        }

        // Get the validated, cached sandbox instance
        sandbox = sandboxResult.data.instance;
        sandboxE2bId = sandboxResult.data.e2bId;

        console.log(`[Netlify Deploy] Connected to sandbox ${sandboxE2bId}...`);

        // 4. Get Netlify token
        const token = await getNetlifyToken(ctx.auth.userId, ctx.db);

        // 5. Get or verify connection
        const connection = await ctx.db.netlifyConnection.findUnique({
          where: { clerkUserId: ctx.auth.userId },
        });

        if (!connection) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'Netlify not connected',
          });
        }

        // 6. Create deployment record
        const deploymentRecord = await ctx.db.netlifyDeployment.create({
          data: {
            projectId: input.projectId,
            connectionId: connection.id,
            siteId: input.existingSiteId ?? 'pending',
            siteName: input.projectName,
            siteUrl: 'pending',
            status: 'BUILDING',
          },
        });

        try {
          // 7. Deploy to Netlify
          console.log(
            `[Netlify Deploy] Starting deployment for project ${input.projectId}...`
          );

          const result = await NetlifyDeployService.deployProject({
            accessToken: token,
            sandbox,
            projectId: input.projectId,
            projectName: input.projectName,
            existingSiteId: input.existingSiteId,
            customSubdomain: input.customSubdomain,
          });

          // 8. Update deployment record with success
          await ctx.db.netlifyDeployment.update({
            where: { id: deploymentRecord.id },
            data: {
              siteId: result.siteId,
              siteName: result.siteName,
              siteUrl: result.siteUrl,
              deployUrl: result.deployUrl,
              deployId: result.deployId,
              adminUrl: result.adminUrl,
              buildSize: result.buildSize,
              filesDeployed: result.filesDeployed,
              buildTime: result.buildTime,
              status: 'COMPLETED',
              completedAt: new Date(),
            },
          });

          // 9. Update connection last deploy time
          await ctx.db.netlifyConnection.update({
            where: { id: connection.id },
            data: { lastDeployAt: new Date() },
          });

          console.log(`[Netlify Deploy] ✅ Deployment successful`);

          return {
            success: true,
            deploymentId: deploymentRecord.id,
            siteUrl: result.siteUrl,
            deployUrl: result.deployUrl,
            adminUrl: result.adminUrl,
            siteName: result.siteName,
            filesDeployed: result.filesDeployed,
          };
        } catch (deployError) {
          // Update deployment record with error
          await ctx.db.netlifyDeployment.update({
            where: { id: deploymentRecord.id },
            data: {
              status: 'FAILED',
              errorMessage:
                deployError instanceof Error
                  ? deployError.message
                  : 'Unknown error',
              completedAt: new Date(),
            },
          });

          throw deployError;
        } finally {
          // NOTE: Sandbox is managed by SandboxManager - don't kill it
          // The instance remains cached and alive for other operations
          // SandboxManager will handle cleanup when sandbox expires
          if (sandbox && sandboxE2bId) {
            console.log(
              `[Netlify Deploy] Deployment complete, sandbox ${sandboxE2bId} remains active`
            );
          }
        }
      } catch (error) {
        // Handle specific error types
        if (error instanceof NetlifyBuildTooLargeError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }

        if (error instanceof NetlifyBuildError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Build failed: ${error.message}`,
          });
        }

        if (error instanceof NetlifyDeployTimeoutError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
          });
        }

        if (error instanceof NetlifySiteConflictError) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }

        if (error instanceof NetlifyRateLimitError) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: error.message,
          });
        }

        if (error instanceof NetlifyAuthError) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: error.message,
          });
        }

        if (error instanceof NetlifyDeployError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Deployment failed: ${error.message}`,
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        Sentry.captureException(error, {
          tags: { feature: 'netlify_deploy_project' },
          extra: {
            projectId: input.projectId,
            projectName: input.projectName,
          },
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to deploy to Netlify',
          cause: error,
        });
      } finally {
        // Sandbox remains managed by SandboxManager - no cleanup needed
      }
    }),

  /**
   * Update an existing Netlify site's subdomain
   */
  updateSiteName: protectedProcedure
    .input(
      z.object({
        siteId: z.string(),
        newSubdomain: z.string().min(1).max(63),
        deploymentId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // 1. Get Netlify token
        const token = await getNetlifyToken(ctx.auth.userId, ctx.db);
        const client = netlifyClient.getClient(token);

        // 2. Sanitize subdomain (same logic as deploy service)
        const sanitized = input.newSubdomain
          .toLowerCase()
          .replace(/[\s_]+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 63);

        if (!sanitized) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid subdomain format',
          });
        }

        // 3. Update site via Netlify API
        const updatedSite = await client.updateSite(input.siteId, {
          name: sanitized,
        });

        // 4. Update our database record
        await ctx.db.netlifyDeployment.update({
          where: { id: input.deploymentId },
          data: {
            siteName: updatedSite.name,
            siteUrl: updatedSite.ssl_url || updatedSite.url,
          },
        });

        return {
          siteName: updatedSite.name,
          siteUrl: updatedSite.ssl_url || updatedSite.url,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        if (error instanceof NetlifySiteConflictError) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This subdomain is already taken. Please choose another.',
          });
        }

        if (error instanceof NetlifyAuthError) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Please reconnect your Netlify account.',
          });
        }

        Sentry.captureException(error, {
          tags: { feature: 'netlify_update_site_name' },
          extra: {
            siteId: input.siteId,
            newSubdomain: input.newSubdomain,
          },
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update site subdomain',
          cause: error,
        });
      }
    }),

  /**
   * Get deployment history for a project
   */
  getProjectDeployments: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const deployments = await ctx.db.netlifyDeployment.findMany({
        where: {
          projectId: input.projectId,
          connection: {
            clerkUserId: ctx.auth.userId,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return deployments;
    }),
});
