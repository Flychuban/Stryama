export enum ClaudeModel {
  SONNET_4_5 = 'claude-sonnet-4-5',
  HAIKU_4_5 = 'claude-haiku-4-5',
}

export enum GenerationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ClaudeErrorType {
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  INVALID_RESPONSE = 'invalid_response',
  API_ERROR = 'api_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  NETWORK_ERROR = 'network_error',
}

/**
 * Framework type constant - app is specialized for React+Vite
 */
export const FRAMEWORK_TYPE = 'react' as const;
export type FrameworkType = typeof FRAMEWORK_TYPE;

export enum ProgrammingLanguage {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  CSS = 'css',
  HTML = 'html',
  JSON = 'json',
  MARKDOWN = 'markdown',
}

export type ProjectFile = {
  readonly path: string;
  readonly content: string;
  readonly language?: ProgrammingLanguage;
};

export type GenerationOptions = {
  readonly model?: ClaudeModel;
  readonly maxTurns?: number;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly allowedTools?: readonly string[];
};

export type ProjectContext = {
  readonly existingFiles?: readonly ProjectFile[];
  readonly framework?: FrameworkType;
  readonly dependencies?: readonly string[];
};

export type AIGenerationRequest = {
  readonly prompt: string;
  readonly projectId?: string;
  readonly context?: ProjectContext;
  readonly options?: GenerationOptions;
  readonly sessionId?: string;
};

export type GeneratedFile = {
  readonly path: string;
  readonly content: string;
  readonly language: ProgrammingLanguage;
};

export type AIGenerationResponse = {
  readonly id: string;
  readonly status: GenerationStatus;
  readonly files: readonly GeneratedFile[];
  readonly explanation?: string;
  readonly tokensUsed: number;
  readonly duration: number;
  readonly sessionId?: string;
  readonly totalCost?: number;
};

export type ServiceResult<T> = {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
};
