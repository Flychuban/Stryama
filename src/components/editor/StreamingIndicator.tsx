/**
 * StreamingIndicator Component
 *
 * Displays real-time status of AI code generation with visual indicators.
 * Shows what Claude is currently doing with animations and tool usage details.
 */

'use client';

import { useEffect, useState } from 'react';
import type { StreamState } from '~/hooks/useAIGenerationStream';

interface StreamingIndicatorProps {
  state: StreamState;
  className?: string;
}

export function StreamingIndicator({
  state,
  className = '',
}: StreamingIndicatorProps) {
  const [dots, setDots] = useState('');

  // Animated dots effect
  useEffect(() => {
    if (!state.isStreaming) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);

    return () => clearInterval(interval);
  }, [state.isStreaming]);

  // Show component when streaming, completed, or has error
  if (
    !state.isStreaming &&
    !state.isComplete &&
    !state.hasError &&
    state.status === 'idle'
  ) {
    return null;
  }

  const getStatusIcon = () => {
    switch (state.status) {
      case 'initializing':
        return '🔄';
      case 'thinking':
        return '🤔';
      case 'tool_use':
        return '🔧';
      case 'writing':
        return '✏️';
      case 'executing':
        return '⚡';
      case 'completing':
        return '✨';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '🤖';
    }
  };

  const getStatusText = () => {
    if (state.statusMessage) {
      return state.statusMessage;
    }

    switch (state.status) {
      case 'initializing':
        return 'Initializing AI agent';
      case 'thinking':
        return 'Claude is thinking';
      case 'tool_use':
        return state.currentTool
          ? `Using ${state.currentTool.name}`
          : 'Using tool';
      case 'writing':
        return 'Writing files';
      case 'executing':
        return 'Running commands';
      case 'completing':
        return 'Finalizing';
      case 'completed':
        return 'Generation complete';
      case 'error':
        return state.error?.message ?? 'Error occurred';
      default:
        return 'Processing';
    }
  };

  const getToolDetails = () => {
    if (!state.currentTool) return null;

    const { name, input } = state.currentTool;

    switch (name) {
      case 'E2B_Write':
        return (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Writing:{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
              {input.file_path as string}
            </code>
          </div>
        );
      case 'E2B_Bash':
        return (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Running:{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
              {input.command as string}
            </code>
          </div>
        );
      case 'E2B_GetPreviewURL':
        return (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Generating preview URL
          </div>
        );
      default:
        return (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Tool: {name}
          </div>
        );
    }
  };

  return (
    <div
      className={`rounded-lg border bg-white p-4 dark:bg-gray-900 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl" aria-label={state.status}>
          {getStatusIcon()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {getStatusText()}
              {state.isStreaming && (
                <span className="inline-block w-8 text-left">{dots}</span>
              )}
            </p>
          </div>

          {/* Tool details */}
          {getToolDetails()}

          {/* Sandbox status */}
          {state.sandboxStatus && state.sandboxStatus !== 'setup_complete' && (
            <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
              {state.sandboxStatus === 'creating' && 'Creating sandbox...'}
              {state.sandboxStatus === 'created' && 'Sandbox created'}
              {state.sandboxStatus === 'installing_deps' &&
                'Installing dependencies...'}
              {state.sandboxStatus === 'deps_installed' &&
                'Dependencies installed'}
            </div>
          )}

          {/* Token usage */}
          {state.tokensUsed > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              {state.tokensUsed.toLocaleString()} tokens
              {state.totalCost > 0 && ` • $${state.totalCost.toFixed(4)}`}
            </div>
          )}

          {/* Tool history summary */}
          {state.toolHistory.length > 0 && state.isComplete && (
            <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-500">
                Tools used: {state.toolHistory.length}
              </p>
              <div className="flex flex-wrap gap-1">
                {state.toolHistory.slice(0, 5).map((tool, idx) => (
                  <span
                    key={`${tool.id}-${idx}`}
                    className={`rounded px-2 py-1 text-xs ${
                      tool.isError
                        ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                    }`}
                  >
                    {tool.name}
                  </span>
                ))}
                {state.toolHistory.length > 5 && (
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    +{state.toolHistory.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Error details */}
          {state.hasError && state.error && (
            <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {state.error.message}
              </p>
              {state.error.code && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Error code: {state.error.code}
                </p>
              )}
            </div>
          )}

          {/* Thinking content (if available) */}
          {state.thinking && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300">
                View extended thinking
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto rounded bg-gray-50 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {state.thinking}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
