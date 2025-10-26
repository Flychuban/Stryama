import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import { projectRouter } from '~/server/api/routers/project';
import { aiRouter } from '~/server/api/routers/ai';

export const appRouter = createTRPCRouter({
  project: projectRouter,
  ai: aiRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
