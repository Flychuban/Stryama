/**
 * useAIGenerationStream Hook
 *
 * React hook for consuming real-time AI generation events.
 * Provides live updates as Claude works on code generation.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { api } from '~/trpc/react';
import { useAnalytics } from './useAnalytics';
import type { StreamEvent } from '~/lib/integrations/claude/types/stream-events';
import { logger } from '~/lib/utils/logger';

export interface StreamState {
  // Current status
  status:
    | 'idle'
    | 'initializing'
    | 'thinking'
    | 'tool_use'
    | 'writing'
    | 'executing'
    | 'completing'
    | 'completed'
    | 'error';
  statusMessage?: string;

  // Sandbox info
  sandboxId?: string;
  sandboxStatus?:
    | 'creating'
    | 'created'
    | 'installing_deps'
    | 'deps_installed'
    | 'setup_complete';

  // Preview info
  previewUrl?: string;
  skipPreviewReload?: boolean; // If true, don't reload iframe (Vite HMR will handle it)

  // Session info
  sessionId?: string;
  model?: string;

  // Streaming content
  accumulatedContent: string;
  thinking: string; // Extended thinking content

  // Tool usage tracking
  currentTool?: {
    name: string;
    id: string;
    input: Record<string, unknown>;
  };
  toolHistory: Array<{
    name: string;
    id: string;
    input: Record<string, unknown>;
    result?: string;
    isError: boolean;
    timestamp: number;
  }>;

  // Token and cost tracking
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;

  // Final result
  result?: {
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

  // Error state
  error?: {
    message: string;
    code: string;
  };

  // Flags
  isStreaming: boolean;
  isComplete: boolean;
  hasError: boolean;
  isDatabasePersisted: boolean; // True when server has saved all data to DB

  // Event timestamps (from server) - used for deduplication to prevent duplicate processing
  completionTimestamp: number; // Timestamp when 'complete' event was received
  databasePersistedTimestamp: number; // Timestamp when 'database_persisted' event was received
  previewUpdateTimestamp: number; // Timestamp when 'preview_url_updated' event was received
}

interface UseAIGenerationStreamOptions {
  projectId?: string;
  useSandbox?: boolean;
  onError?: (error: StreamState['error']) => void;
  autoStart?: boolean; // Auto-start streaming when prompt provided
}

export function useAIGenerationStream(
  options: UseAIGenerationStreamOptions = {}
) {
  const { projectId, useSandbox = true, onError } = options;
  const { trackAIGenerationCompleted, trackAIGenerationFailed } =
    useAnalytics();

  // Track generation start time for duration calculation
  const generationStartTime = useRef<number>(0);

  const [state, setState] = useState<StreamState>({
    status: 'idle',
    accumulatedContent: '',
    thinking: '',
    toolHistory: [],
    tokensUsed: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalCost: 0,
    isStreaming: false,
    isComplete: false,
    hasError: false,
    isDatabasePersisted: false,
    completionTimestamp: 0,
    databasePersistedTimestamp: 0,
    previewUpdateTimestamp: 0,
  });

  const [generationId, setGenerationId] = useState<string | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Initialize generation mutation (Phase 1: Store prompt in database)
  const initializeGenerationMutation = api.ai.initializeGeneration.useMutation({
    onSuccess: (data) => {
      logger.debug('[Stream] Generation initialized:', data.generationId);
      setGenerationId(data.generationId);
    },
    onError: (error) => {
      console.error('[Stream] Failed to initialize generation:', error);

      // Extract error type from backend's cause field (if available)
      // Backend sends error.data.cause but TypeScript doesn't know about it
      interface ErrorData {
        cause?: {
          type?: string;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      }
      const errorData = error.data as ErrorData | undefined;
      const errorType = errorData?.cause?.type ?? 'UNKNOWN';

      // Determine user-friendly error message and code
      let userMessage = error.message;
      let errorCode = 'INITIALIZATION_ERROR';

      switch (errorType) {
        case 'VALIDATION_ERROR':
          errorCode = 'VALIDATION_ERROR';
          userMessage = error.message; // Already user-friendly from backend
          break;
        case 'LIMIT_EXCEEDED':
          errorCode = 'LIMIT_EXCEEDED';
          userMessage = error.message; // Already user-friendly from backend
          break;
        case 'RATE_LIMIT_EXCEEDED':
          errorCode = 'RATE_LIMIT_EXCEEDED';
          userMessage = error.message; // Already user-friendly from backend
          break;
        case 'DATABASE_ERROR':
          errorCode = 'DATABASE_ERROR';
          userMessage =
            'Database connection issue. Please try again in a few moments.';
          break;
        case 'UNKNOWN_ERROR':
          errorCode = 'UNKNOWN_ERROR';
          userMessage =
            'An unexpected error occurred. Please try again or contact support if the issue persists.';
          break;
        default:
          // Fallback to generic message
          errorCode = 'INITIALIZATION_ERROR';
          userMessage = error.message;
      }

      console.error(
        `[Stream] Initialization error - Type: ${errorType}, Code: ${errorCode}`
      );

      setState((prev) => ({
        ...prev,
        status: 'error',
        hasError: true,
        isStreaming: false,
        error: {
          message: userMessage,
          code: errorCode,
        },
      }));

      // Call error callback if provided
      if (onError) {
        onError({
          message: userMessage,
          code: errorCode,
        });
      }
    },
  });

  // Memoize subscription input to prevent unnecessary subscription restarts
  // Phase 2: Stream using generationId
  const subscriptionInput = useMemo(
    () => ({
      generationId: generationId ?? '',
    }),
    [generationId]
  );

  // Process stream events
  const handleStreamEvent = useCallback(
    (event: StreamEvent) => {
      logger.debug('[Stream Event]', event);

      setState((prev) => {
        const newState = { ...prev };

        switch (event.type) {
          case 'session_init':
            newState.sessionId = event.sessionId;
            newState.model = event.model;
            break;

          case 'status':
            newState.status = event.status;
            newState.statusMessage = event.message;
            break;

          case 'sandbox':
            newState.sandboxStatus = event.action;
            if (event.sandboxId) {
              newState.sandboxId = event.sandboxId;
            }
            if (event.message) {
              newState.statusMessage = event.message;
            }
            break;

          case 'preview_url_updated':
            logger.debug('[Stream] Preview URL updated:', event.url);
            logger.debug('[Stream] Skip reload:', event.skipReload ?? false);
            newState.previewUrl = event.url;
            newState.previewUpdateTimestamp = event.timestamp;
            newState.skipPreviewReload = event.skipReload ?? false;
            if (event.sandboxId) {
              newState.sandboxId = event.sandboxId;
            }
            if (event.message) {
              newState.statusMessage = event.message;
            }
            break;

          case 'tool_use':
            newState.currentTool = {
              name: event.toolName,
              id: event.toolUseId,
              input: event.toolInput,
            };
            newState.status = 'tool_use';
            newState.statusMessage = `Using tool: ${event.toolName}`;
            break;

          case 'tool_result':
            // Capture input before clearing currentTool
            const toolInput =
              newState.currentTool?.id === event.toolUseId
                ? newState.currentTool.input
                : {};

            if (newState.currentTool?.id === event.toolUseId) {
              newState.currentTool = undefined;
            }
            newState.toolHistory.push({
              name: event.toolName,
              id: event.toolUseId,
              input: toolInput,
              result: event.content,
              isError: event.isError,
              timestamp: event.timestamp,
            });
            break;

          case 'content_delta':
            newState.accumulatedContent += event.delta;
            break;

          case 'thinking_delta':
            newState.thinking += event.delta;
            break;

          case 'usage':
            newState.inputTokens = event.inputTokens;
            newState.outputTokens = event.outputTokens;
            newState.tokensUsed = event.inputTokens + event.outputTokens;
            break;

          case 'complete':
            newState.status = 'completed';
            newState.isComplete = true;
            newState.isStreaming = false;
            newState.result = event.result;
            newState.tokensUsed = event.result.tokensUsed;
            newState.totalCost = event.result.totalCost;
            newState.completionTimestamp = event.timestamp;

            // Track AI generation completed event
            if (projectId && event.result) {
              const duration = Date.now() - generationStartTime.current;
              const filesGenerated = event.result.files?.length ?? 0;
              const totalFileSize =
                event.result.files?.reduce(
                  (sum, file) => sum + (file.content?.length ?? 0),
                  0
                ) ?? 0;

              trackAIGenerationCompleted({
                duration_ms: duration,
                tokens_used: event.result.tokensUsed,
                input_tokens: newState.inputTokens,
                output_tokens: newState.outputTokens,
                cost_usd: event.result.totalCost,
                model_used: 'claude-sonnet-4-6', // TODO: Get from event if available
                files_generated: filesGenerated,
                total_file_size_bytes: totalFileSize,
                sandbox_id: event.result.sandboxId,
                session_id: event.result.sessionId,
                generation_number: 1, // TODO: Track this per project if needed
                project_id: projectId,
              });
            }
            break;

          case 'database_persisted':
            logger.debug(
              '[Stream] Database operations complete - safe to refetch'
            );
            newState.isDatabasePersisted = true;
            newState.databasePersistedTimestamp = event.timestamp;
            break;

          case 'error':
            newState.status = 'error';
            newState.hasError = true;
            newState.isStreaming = false;
            newState.error = event.error;

            // Track AI generation failed event
            if (event.error) {
              const duration = Date.now() - generationStartTime.current;

              // Determine error type from error code
              let errorType:
                | 'initialization'
                | 'streaming'
                | 'preview'
                | 'unknown' = 'unknown';
              if (
                event.error.code.includes('PREVIEW') ||
                event.error.code.includes('SANDBOX')
              ) {
                errorType = 'preview';
              } else if (
                event.error.code.includes('VALIDATION') ||
                event.error.code.includes('LIMIT')
              ) {
                errorType = 'initialization';
              } else if (event.error.code.includes('STREAM')) {
                errorType = 'streaming';
              }

              trackAIGenerationFailed({
                error_code: event.error.code,
                error_message: event.error.message,
                error_type: errorType,
                duration_ms: duration,
                tokens_used:
                  newState.tokensUsed > 0 ? newState.tokensUsed : undefined,
                prompt_length: 0, // TODO: Store prompt length if needed
                retry_count: undefined,
                project_id: projectId,
              });
            }
            break;
        }

        return newState;
      });
    },
    [projectId, trackAIGenerationCompleted, trackAIGenerationFailed]
  );

  // Start streaming (two-phase approach)
  const startStreaming = useCallback(
    (prompt: string) => {
      if (!prompt || state.isStreaming) {
        return;
      }

      // Track generation start time for analytics
      generationStartTime.current = Date.now();

      // Reset state for new generation
      setState({
        status: 'initializing',
        accumulatedContent: '',
        thinking: '',
        toolHistory: [],
        tokensUsed: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        isStreaming: true,
        isComplete: false,
        hasError: false,
        isDatabasePersisted: false,
        completionTimestamp: 0,
        databasePersistedTimestamp: 0,
        previewUpdateTimestamp: 0,
      });

      // Phase 1: Initialize generation with prompt
      // This stores the prompt in the database and returns a generationId
      // The generationId is then used for streaming to avoid 431 errors
      initializeGenerationMutation.mutate({
        prompt,
        projectId,
        useSandbox,
      });
    },
    [state.isStreaming, initializeGenerationMutation, projectId, useSandbox]
  );

  // Memoize error handler to prevent subscription restarts
  const handleSubscriptionError = useCallback((error: unknown) => {
    console.error('[Stream Error]', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Subscription error';
    setState((prev) => ({
      ...prev,
      status: 'error',
      hasError: true,
      isStreaming: false,
      error: {
        message: errorMessage,
        code: 'SUBSCRIPTION_ERROR',
      },
    }));
  }, []);

  // Set up tRPC subscription with memoized input (Phase 2)
  // Only start subscription when generationId is available
  api.ai.streamGeneration.useSubscription(subscriptionInput, {
    enabled: !!generationId,
    onData: handleStreamEvent,
    onError: handleSubscriptionError,
  });

  // Call error callback when error occurs
  useEffect(() => {
    if (state.hasError && state.error && onError) {
      onError(state.error);
    }
  }, [state.hasError, state.error, onError]);

  // Warn user before refresh/close during generation
  useEffect(() => {
    // Only show warning when actively streaming
    if (!state.isStreaming) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // This prevents the page from closing/refreshing
      e.preventDefault();

      // Modern browsers ignore custom messages and show their own generic warning
      // But we still need to set returnValue for the dialog to appear
      e.returnValue = '';
    };

    // Add event listener
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup: remove listener when component unmounts or streaming stops
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.isStreaming]); // Re-run when streaming status changes

  // Cancel streaming
  const cancel = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    setGenerationId(null);
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      status: 'idle',
    }));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    cancel();
    setState({
      status: 'idle',
      accumulatedContent: '',
      thinking: '',
      toolHistory: [],
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0,
      isStreaming: false,
      isComplete: false,
      hasError: false,
      isDatabasePersisted: false,
      completionTimestamp: 0,
      databasePersistedTimestamp: 0,
      previewUpdateTimestamp: 0,
    });
  }, [cancel]);

  return {
    state,
    startStreaming,
    cancel,
    reset,
    isStreaming: state.isStreaming,
    isComplete: state.isComplete,
    hasError: state.hasError,
  };
}
