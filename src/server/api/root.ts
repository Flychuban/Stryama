import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
import { projectRouter } from '~/server/api/routers/project';
import { aiRouter } from '~/server/api/routers/ai';
import { sandboxRouter } from '~/server/api/routers/sandbox';
import { usageRouter } from '~/server/api/routers/usage';
import { subscriptionRouter } from '~/server/api/routers/subscription';
import { feedbackRouter } from '~/server/api/routers/feedback';

export const appRouter = createTRPCRouter({
  project: projectRouter,
  ai: aiRouter,
  sandbox: sandboxRouter,
  usage: usageRouter,
  subscription: subscriptionRouter,
  feedback: feedbackRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
