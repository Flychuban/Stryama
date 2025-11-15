/**
 * Stream Event Types for Claude Agent SDK
 *
 * Defines the event types emitted during AI code generation streaming.
 * These events provide real-time updates about the agent's activities.
 */

/**
 * Status event - Indicates current phase of generation
 */
export type StreamStatusEvent = {
  type: 'status';
  status:
    | 'initializing' // Setting up session and sandbox
    | 'thinking' // Claude is processing the request
    | 'tool_use' // Executing a tool
    | 'writing' // Writing files
    | 'executing' // Running commands
    | 'completing'; // Finalizing generation
  message?: string;
  timestamp: number;
};

/**
 * Tool use event - Emitted when Claude uses a tool
 */
export type StreamToolUseEvent = {
  type: 'tool_use';
  toolName: string;
  toolUseId: string;
  toolInput: Record<string, unknown>;
  timestamp: number;
};

/**
 * Tool result event - Emitted when a tool completes
 */
export type StreamToolResultEvent = {
  type: 'tool_result';
  toolName: string;
  toolUseId: string;
  isError: boolean;
  content?: string;
  timestamp: number;
};

/**
 * Content delta event - Streaming text content
 */
export type StreamContentDeltaEvent = {
  type: 'content_delta';
  delta: string;
  index: number; // Content block index
  timestamp: number;
};

/**
 * Thinking delta event - Claude's internal reasoning (extended thinking)
 */
export type StreamThinkingDeltaEvent = {
  type: 'thinking_delta';
  delta: string;
  timestamp: number;
};

/**
 * Usage update event - Token usage information
 */
export type StreamUsageEvent = {
  type: 'usage';
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  timestamp: number;
};

/**
 * Complete event - Generation finished successfully
 */
export type StreamCompleteEvent = {
  type: 'complete';
  result: {
    content: string;
    sessionId: string;
    sandboxId?: string;
    tokensUsed: number;
    totalCost: number;
    duration: number;
    files?: Array<{
      path: string;
      content: string;
      language: string;
    }>;
  };
  timestamp: number;
};

/**
 * Error event - Generation encountered an error
 */
export type StreamErrorEvent = {
  type: 'error';
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
  timestamp: number;
};

/**
 * Session init event - Session initialized
 */
export type StreamSessionInitEvent = {
  type: 'session_init';
  sessionId: string;
  model: string;
  timestamp: number;
};

/**
 * Sandbox event - E2B sandbox operations
 */
export type StreamSandboxEvent = {
  type: 'sandbox';
  action:
    | 'creating'
    | 'created'
    | 'installing_deps'
    | 'deps_installed'
    | 'setup_complete';
  sandboxId?: string;
  message?: string;
  timestamp: number;
};

/**
 * Preview event - Preview server URL updates
 * Emitted when the preview server is ready or URL changes
 */
export type StreamPreviewEvent = {
  type: 'preview_url_updated';
  url: string;
  sandboxId?: string;
  message?: string;
  timestamp: number;
};

/**
 * Union type of all stream events
 */
export type StreamEvent =
  | StreamStatusEvent
  | StreamToolUseEvent
  | StreamToolResultEvent
  | StreamContentDeltaEvent
  | StreamThinkingDeltaEvent
  | StreamUsageEvent
  | StreamCompleteEvent
  | StreamErrorEvent
  | StreamSessionInitEvent
  | StreamSandboxEvent
  | StreamPreviewEvent;

/**
 * Stream event callback type
 */
export type StreamEventCallback = (event: StreamEvent) => void;

/**
 * Stream options for generation
 */
export type StreamGenerationOptions = {
  onEvent?: StreamEventCallback;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  signal?: AbortSignal;
};
