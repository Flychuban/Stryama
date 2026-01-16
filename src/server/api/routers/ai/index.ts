import { createTRPCRouter } from '~/server/api/trpc';
import { historyRouter } from './history.router';
import { generationRouter } from './generation.router';
import { streamRouter } from './stream.router';

export const aiRouter = createTRPCRouter({
  getHistory: historyRouter.getHistory,
  getById: historyRouter.getById,
  getRateLimitStatus: historyRouter.getRateLimitStatus,
  initializeGeneration: generationRouter.initializeGeneration,
  generateCode: generationRouter.generateCode,
  streamGeneration: streamRouter.streamGeneration,
});
