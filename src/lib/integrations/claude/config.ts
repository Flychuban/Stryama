import { env } from '~/env';
import { ClaudeModel } from './types';

export const DEFAULT_MODEL = ClaudeModel.SONNET_4;

export const GENERATION_CONFIG = {
  maxTurns: 5,
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 60000, // 60 seconds
  allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'] as const,
} as const;

export const RATE_LIMIT_CONFIG = {
  free: {
    requestsPerMinute: 2,
    requestsPerDay: 5,
    maxTokensPerRequest: 4096,
  },
  pro: {
    requestsPerMinute: 3,
    requestsPerDay: 20,
    maxTokensPerRequest: 8192,
  },
  enterprise: {
    requestsPerMinute: 5,
    requestsPerDay: 100,
    maxTokensPerRequest: 16384,
  },
} as const;

export const MODEL_PRICING = {
  [ClaudeModel.SONNET_4]: {
    inputTokenPrice: 0.003,
    outputTokenPrice: 0.015,
  },
  [ClaudeModel.OPUS]: {
    inputTokenPrice: 0.015,
    outputTokenPrice: 0.075,
  },
  [ClaudeModel.HAIKU]: {
    inputTokenPrice: 0.00025,
    outputTokenPrice: 0.00125,
  },
} as const;

export const CLAUDE_API_CONFIG = {
  apiKey: env.ANTHROPIC_API_KEY,
  baseUrl: 'https://api.anthropic.com',
  version: '2023-06-01',
} as const;
