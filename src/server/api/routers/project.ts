import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Framework } from '@prisma/client';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';
import { UsageTrackingService } from '~/lib/services/usageTracking';

export const projectRouter = createTRPCRouter({
  // Get all projects for the authenticated user
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const projects = await ctx.db.project.findMany({
      where: {
        clerkUserId: ctx.auth.userId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return projects;
  }),

  // Get a single project by ID (only if it belongs to the user)
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.db.project.findFirst({
        where: {
          id: input.id,
          clerkUserId: ctx.auth.userId,
        },
        include: {
          files: true,
          sandboxes: true,
        },
      });

      if (!project) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have access to it',
        });
      }

      return project;
    }),

  // Create a new project
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        framework: z.nativeEnum(Framework).optional().default(Framework.REACT),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check project limit before creating
      try {
        await UsageTrackingService.checkProjectLimit(ctx.auth.userId);
      } catch (error) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message:
            error instanceof Error ? error.message : 'Project limit exceeded',
        });
      }

      const project = await ctx.db.project.create({
        data: {
          name: input.name,
          description: input.description,
          framework: input.framework,
          clerkUserId: ctx.auth.userId,
        },
      });

      return project;
    }),

  // Update a project
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().optional(),
        framework: z.nativeEnum(Framework).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First verify the project belongs to the user
      const existingProject = await ctx.db.project.findFirst({
        where: {
          id: input.id,
          clerkUserId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have access to it',
        });
      }

      const updatedProject = await ctx.db.project.update({
        where: {
          id: input.id,
        },
        data: {
          name: input.name,
          description: input.description,
          framework: input.framework,
        },
      });

      return updatedProject;
    }),

  // Delete a project
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First verify the project belongs to the user
      const existingProject = await ctx.db.project.findFirst({
        where: {
          id: input.id,
          clerkUserId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Project not found or you do not have access to it',
        });
      }

      await ctx.db.project.delete({
        where: {
          id: input.id,
        },
      });

      return { success: true };
    }),
});
