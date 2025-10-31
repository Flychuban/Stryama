import { env } from '~/env';
import { ClaudeModel } from './types';

export const DEFAULT_MODEL = ClaudeModel.SONNET_4;

export const GENERATION_CONFIG = {
  maxTurns: 65,
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 240000, // 240 seconds
  allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'] as const,
} as const;

export const RATE_LIMIT_CONFIG = {
  free: {
    requestsPerMinute: 5, // Increased from 2 for better editor experience
    requestsPerDay: 50, // Increased from 5 to allow for proper development/testing
    maxTokensPerRequest: 4096,
  },
  pro: {
    requestsPerMinute: 10, // Increased from 3
    requestsPerDay: 200, // Increased from 20
    maxTokensPerRequest: 8192,
  },
  enterprise: {
    requestsPerMinute: 20, // Increased from 5
    requestsPerDay: 1000, // Increased from 100
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
  version: '2025-28-10',
} as const;
