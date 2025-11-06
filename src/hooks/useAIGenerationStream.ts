/**
 * useAIGenerationStream Hook
 *
 * React hook for consuming real-time AI generation events.
 * Provides live updates as Claude works on code generation.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { api } from '~/trpc/react';
import type { StreamEvent } from '~/lib/integrations/claude/types/stream-events';

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
  });

  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Memoize subscription input to prevent unnecessary subscription restarts
  const subscriptionInput = useMemo(
    () => ({
      prompt: currentPrompt ?? '',
      projectId,
      useSandbox,
    }),
    [currentPrompt, projectId, useSandbox]
  );

  // Process stream events
  const handleStreamEvent = useCallback((event: StreamEvent) => {
    console.log('[Stream Event]', event);

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
          if (newState.currentTool?.id === event.toolUseId) {
            newState.currentTool = undefined;
          }
          newState.toolHistory.push({
            name: event.toolName,
            id: event.toolUseId,
            input: newState.currentTool?.input ?? {},
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
          break;

        case 'error':
          newState.status = 'error';
          newState.hasError = true;
          newState.isStreaming = false;
          newState.error = event.error;
          break;
      }

      return newState;
    });
  }, []);

  // Subscribe to stream
  const startStreaming = useCallback(
    (prompt: string) => {
      if (!prompt || state.isStreaming) {
        return;
      }

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
      });

      setCurrentPrompt(prompt);
    },
    [state.isStreaming]
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

  // Set up tRPC subscription with memoized input
  api.ai.streamGeneration.useSubscription(subscriptionInput, {
    enabled: !!currentPrompt,
    onData: handleStreamEvent,
    onError: handleSubscriptionError,
  });

  // Call error callback when error occurs
  useEffect(() => {
    if (state.hasError && state.error && onError) {
      onError(state.error);
    }
  }, [state.hasError, state.error, onError]);

  // Cancel streaming
  const cancel = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }
    setCurrentPrompt(null);
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
