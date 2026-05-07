import { env } from '~/env';
import { ClaudeModel } from './types';

// Default to Haiku 4.5 for cost optimization
// Model selection is now dynamic based on prompt complexity and user plan
export const DEFAULT_MODEL = ClaudeModel.HAIKU_4_5;

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
  FREE: {
    requestsPerMinute: 5,
    requestsPerDay: 50,
    maxTokensPerRequest: 4096,
  },
  BUILDER: {
    requestsPerMinute: 8,
    requestsPerDay: 150,
    maxTokensPerRequest: 8192,
  },
  PRO: {
    requestsPerMinute: 15,
    requestsPerDay: 500,
    maxTokensPerRequest: 16384,
  },
} as const;

export const MODEL_PRICING = {
  [ClaudeModel.SONNET_4_6]: {
    inputTokenPrice: 0.003,
    outputTokenPrice: 0.015,
  },
  [ClaudeModel.HAIKU_4_5]: {
    inputTokenPrice: 0.00025,
    outputTokenPrice: 0.00125,
  },
} as const;

export const CLAUDE_API_CONFIG = {
  apiKey: env.ANTHROPIC_API_KEY,
  baseUrl: 'https://api.anthropic.com',
  version: '2025-28-10',
} as const;
