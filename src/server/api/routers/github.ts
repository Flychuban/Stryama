import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { githubClient } from '~/lib/integrations/github/client';
import { GitHubExportService } from '~/lib/integrations/github/services/export';
import { GitHubRepositoryService } from '~/lib/integrations/github/services/repository';
import { generateCommitMessage } from '~/lib/integrations/github/utils/commit-message';
import {
  GitHubAuthError,
  GitHubExportError,
  GitHubRepositoryExistsError,
  GitHubRateLimitError,
} from '~/lib/integrations/github/errors';
import * as Sentry from '@sentry/nextjs';
import { trackGitHubConnectedServer } from '~/lib/analytics/server-tracking';
import type { db as DbType } from '~/server/db';

/**
 * Helper function to get GitHub token from database
 * Since we're using custom OAuth flow, tokens are stored in database
 */
async function getGitHubToken(
  userId: string,
  db: typeof DbType
): Promise<string> {
  try {
    const connection = await db.gitHubConnection.findUnique({
      where: { clerkUserId: userId },
      select: { accessToken: true },
    });

    if (!connection?.accessToken) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'GitHub not connected. Please connect your GitHub account.',
      });
    }

    return connection.accessToken;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    Sentry.captureException(error, {
      tags: { feature: 'github_get_token' },
      extra: { userId },
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve GitHub token',
      cause: error,
    });
  }
}

export const githubRouter = createTRPCRouter({
  /**
   * Connect GitHub account (create/update metadata record)
   */
  connect: protectedProcedure
    .input(
      z.object({
        githubUsername: z.string(),
        githubUserId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify token exists
        const token = await getGitHubToken(ctx.auth.userId, ctx.db);

        // Verify token is valid
        const isValid = await githubClient.verifyToken(token);
        if (!isValid) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'GitHub token is invalid',
          });
        }

        // Create or update connection
        const connection = await ctx.db.gitHubConnection.upsert({
          where: { clerkUserId: ctx.auth.userId },
          create: {
            clerkUserId: ctx.auth.userId,
            githubUsername: input.githubUsername,
            githubUserId: input.githubUserId,
            accessToken: token, // Store the validated token
          },
          update: {
            githubUsername: input.githubUsername,
            githubUserId: input.githubUserId,
            accessToken: token, // Update token if refreshed
          },
        });

        return connection;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        Sentry.captureException(error, {
          tags: { feature: 'github_connect' },
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to connect GitHub account',
          cause: error,
        });
      }
    }),

  /**
   * Verify GitHub connection after OAuth callback
   * Called automatically after user authorizes GitHub via custom OAuth flow
   * The API callback route already saved the connection, this just verifies and tracks analytics
   */
  connectAfterOAuth: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Verify connection exists in database (was created by API callback)
      const connection = await ctx.db.gitHubConnection.findUnique({
        where: { clerkUserId: ctx.auth.userId },
      });

      if (!connection) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'GitHub connection not found. Please try connecting again.',
        });
      }

      // Track analytics
      trackGitHubConnectedServer(ctx.auth.userId, {
        github_username: connection.githubUsername,
        github_user_id: connection.githubUserId,
      });

      return connection;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      Sentry.captureException(error, {
        tags: { feature: 'github_connect_after_oauth' },
        extra: { userId: ctx.auth.userId },
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify GitHub connection',
        cause: error,
      });
    }
  }),

  /**
   * Disconnect GitHub account
   */
  disconnect: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await ctx.db.gitHubConnection.delete({
        where: { clerkUserId: ctx.auth.userId },
      });

      return { success: true };
    } catch (error) {
      // If connection doesn't exist, that's fine
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        return { success: true };
      }

      Sentry.captureException(error, {
        tags: { feature: 'github_disconnect' },
      });

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to disconnect GitHub account',
        cause: error,
      });
    }
  }),

  /**
   * Get GitHub connection status
   */
  getConnection: protectedProcedure.query(async ({ ctx }) => {
    const connection = await ctx.db.gitHubConnection.findUnique({
      where: { clerkUserId: ctx.auth.userId },
      include: {
        exports: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return connection;
  }),

  /**
   * List user's GitHub repositories
   */
  listRepositories: protectedProcedure
    .input(
      z.object({
        page: z.number().default(1),
        perPage: z.number().default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const token = await getGitHubToken(ctx.auth.userId, ctx.db);
        const octokit = githubClient.getClient(token);

        return await GitHubRepositoryService.getUserRepositories(
          octokit,
          input.page,
          input.perPage
        );
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        Sentry.captureException(error, {
          tags: { feature: 'github_list_repositories' },
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list repositories',
          cause: error,
        });
      }
    }),

  /**
   * Create new GitHub repository
   */
  createRepository: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        isPrivate: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const token = await getGitHubToken(ctx.auth.userId, ctx.db);
        const octokit = githubClient.getClient(token);

        return await GitHubRepositoryService.createRepository(
          octokit,
          input.name,
          input.isPrivate
        );
      } catch (error) {
        if (error instanceof GitHubRepositoryExistsError) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        Sentry.captureException(error, {
          tags: { feature: 'github_create_repository' },
          extra: { repositoryName: input.name },
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create repository',
          cause: error,
        });
      }
    }),

  /**
   * Export project to GitHub
   */
  exportProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        repoOwner: z.string(),
        repoName: z.string(),
        branch: z.string().default('main'),
        commitMessage: z.string().optional(),
        createNewRepo: z.boolean().default(false),
        isPrivate: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
            message: 'Project has no files to export',
          });
        }

        // 2. Get GitHub token
        const token = await getGitHubToken(ctx.auth.userId, ctx.db);
        const octokit = githubClient.getClient(token);

        // 3. Create repository if needed
        let repoOwner = input.repoOwner;
        let repoName = input.repoName;
        let branch = input.branch;

        if (input.createNewRepo) {
          const repo = await GitHubRepositoryService.createRepository(
            octokit,
            input.repoName,
            input.isPrivate
          );
          repoOwner = repo.owner;
          repoName = repo.name;
          branch = repo.defaultBranch;
        }

        // 4. Get or verify connection
        const connection = await ctx.db.gitHubConnection.findUnique({
          where: { clerkUserId: ctx.auth.userId },
        });

        if (!connection) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'GitHub not connected',
          });
        }

        // 5. Check if this is the first export to this repository
        const previousExports = await ctx.db.gitHubExport.findMany({
          where: {
            projectId: input.projectId,
            repoFullName: `${repoOwner}/${repoName}`,
            status: 'COMPLETED',
          },
          take: 1,
        });

        const isFirstExport =
          previousExports.length === 0 || input.createNewRepo;

        // 6. Generate commit message
        const commitMessage =
          input.commitMessage ??
          generateCommitMessage(project.name, isFirstExport);

        // 7. Create export record
        const exportRecord = await ctx.db.gitHubExport.create({
          data: {
            projectId: input.projectId,
            connectionId: connection.id,
            repoOwner,
            repoName,
            repoFullName: `${repoOwner}/${repoName}`,
            repoUrl: `https://github.com/${repoOwner}/${repoName}`,
            branch,
            commitMessage,
            status: 'IN_PROGRESS',
          },
        });

        try {
          // 8. Export files
          const result = await GitHubExportService.exportToRepository(
            octokit,
            repoOwner,
            repoName,
            branch,
            project.files,
            commitMessage
          );

          // 9. Update export record
          await ctx.db.gitHubExport.update({
            where: { id: exportRecord.id },
            data: {
              status: 'COMPLETED',
              commitSha: result.commitSha,
              filesExported: result.filesExported,
              completedAt: new Date(),
            },
          });

          // 10. Update connection last sync
          await ctx.db.gitHubConnection.update({
            where: { id: connection.id },
            data: { lastSyncAt: new Date() },
          });

          return {
            success: true,
            exportId: exportRecord.id,
            commitUrl: result.commitUrl,
            repoUrl: `https://github.com/${repoOwner}/${repoName}`,
            filesExported: result.filesExported,
          };
        } catch (exportError) {
          // Update export record with error
          await ctx.db.gitHubExport.update({
            where: { id: exportRecord.id },
            data: {
              status: 'FAILED',
              errorMessage:
                exportError instanceof Error
                  ? exportError.message
                  : 'Unknown error',
              completedAt: new Date(),
            },
          });

          throw exportError;
        }
      } catch (error) {
        if (error instanceof GitHubRateLimitError) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: error.message,
          });
        }

        if (error instanceof GitHubAuthError) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: error.message,
          });
        }

        if (error instanceof GitHubExportError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to export to GitHub. Please try again.',
          });
        }

        if (error instanceof GitHubRepositoryExistsError) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: error.message,
          });
        }

        if (error instanceof TRPCError) {
          throw error;
        }

        Sentry.captureException(error, {
          tags: { feature: 'github_export_project' },
          extra: {
            projectId: input.projectId,
            repoFullName: `${input.repoOwner}/${input.repoName}`,
          },
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to export to GitHub',
          cause: error,
        });
      }
    }),

  /**
   * Get export history for a project
   */
  getProjectExports: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const exports = await ctx.db.gitHubExport.findMany({
        where: {
          projectId: input.projectId,
          connection: {
            clerkUserId: ctx.auth.userId,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return exports;
    }),
});
