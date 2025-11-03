import { env } from '~/env';
import { ClaudeModel } from './types';

export const DEFAULT_MODEL = ClaudeModel.SONNET_4;

export const GENERATION_CONFIG = {
  maxTurns: 65,
  temperature: 0.7,
  maxTokens: 4096,
  timeout: 240000, // 240 seconds

  // E2B Sandbox Mode (recommended for project code generation)
  // Uses custom MCP tools that proxy to E2B sandboxes
  e2bMode: {
    disallowedTools: ['Write', 'Edit', 'Bash'] as const, // Block local filesystem operations
    allowedTools: [
      'Read',
      'Glob',
      'Grep',
      'mcp__e2b-sandbox__E2B_Write',
      'mcp__e2b-sandbox__E2B_Read',
      'mcp__e2b-sandbox__E2B_Bash',
      'mcp__e2b-sandbox__E2B_List',
      'mcp__e2b-sandbox__E2B_GetPreviewURL',
    ] as const,
  },

  // Local Mode (fallback for non-project or read-only operations)
  localMode: {
    allowedTools: ['Read', 'Edit', 'Glob', 'Grep', 'Bash'] as const,
  },
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
