export { claudeClient, ClaudeClient } from './client';

export { rateLimiter, RateLimiter } from './rateLimiter';
export type { UserPlan, RateLimitStatus } from './rateLimiter';

export { CodeParser } from './parser';
export type { ParsedCodeBlock } from './parser';

export { PromptBuilder } from './prompts/builder';
export { PROMPT_TEMPLATES } from './prompts/templates';
export {
  validatePrompt,
  sanitizePrompt,
  validateAndSanitizePrompt,
} from './prompts/validators';
export { PromptTemplateType } from './prompts/types';
export type {
  PromptTemplate,
  PromptContext,
  PromptValidationResult,
} from './prompts/types';

export {
  DEFAULT_MODEL,
  GENERATION_CONFIG,
  RATE_LIMIT_CONFIG,
  MODEL_PRICING,
} from './config';

export {
  ClaudeGenerationError,
  classifyError,
  getUserFriendlyErrorMessage,
} from './errors';

export { retryHandler, withRetry, RetryHandler } from './errors/retry-handler';
export { FallbackStrategy } from './errors/fallback-strategies';

export { ProjectContextGatherer } from './context/project-context';
export { ConflictDetector, ConflictType } from './context/conflict-detector';
export type { FileConflict } from './context/conflict-detector';

// Types
export {
  ClaudeModel,
  GenerationStatus,
  ClaudeErrorType,
  FrameworkType,
  ProgrammingLanguage,
} from './types';
export type {
  ProjectFile,
  GenerationOptions,
  ProjectContext,
  AIGenerationRequest,
  GeneratedFile,
  AIGenerationResponse,
  ServiceResult,
} from './types';
