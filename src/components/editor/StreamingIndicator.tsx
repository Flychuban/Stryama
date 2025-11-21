/**
 * StreamingIndicator Component
 *
 * Displays real-time status of AI code generation with visual indicators.
 * Shows what Claude is currently doing with animations and tool usage details.
 */

'use client';

import { useEffect, useState } from 'react';
import { Progress } from '~/components/ui/progress';
import type { StreamState } from '~/hooks/useAIGenerationStream';
import { FileWritePreview } from './FileWritePreview';
import { CommandOutput } from './CommandOutput';
import { ProgressTimeline } from './ProgressTimeline';

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
        const filePath = input.file_path as string;
        const content = input.content as string;

        if (filePath && content) {
          return (
            <div className="mt-3">
              <FileWritePreview filePath={filePath} content={content} />
            </div>
          );
        }
        return (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Writing:{' '}
            <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
              {filePath}
            </code>
          </div>
        );

      case 'E2B_Bash':
        const command = input.command as string;

        // Try to get result from tool history if this tool has completed
        const toolResult = state.toolHistory.find(
          (t) => t.id === state.currentTool?.id
        );

        return (
          <div className="mt-3">
            <CommandOutput
              command={command}
              output={toolResult?.result}
              isError={toolResult?.isError}
              isRunning={!toolResult}
            />
          </div>
        );

      case 'E2B_GetPreviewURL':
        return (
          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Generating preview URL...
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
      className={`rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl" aria-label={state.status}>
          {getStatusIcon()}
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          {/* Status header */}
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {getStatusText()}
              {state.isStreaming && (
                <span className="inline-block w-8 text-left">{dots}</span>
              )}
            </p>

            {/* Token usage */}
            {state.tokensUsed > 0 && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                {state.tokensUsed.toLocaleString()} tokens
                {state.totalCost > 0 && ` • $${state.totalCost.toFixed(4)}`}
              </div>
            )}
          </div>

          {/* Progress timeline */}
          {(state.toolHistory.length > 0 || state.currentTool) && (
            <ProgressTimeline
              toolHistory={state.toolHistory}
              currentTool={state.currentTool}
              sandboxStatus={state.sandboxStatus}
              status={state.status}
            />
          )}

          {/* Thinking content (prominent display) */}
          {state.thinking && state.isStreaming && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                  💭 Thinking
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto text-sm text-purple-900 dark:text-purple-100">
                {state.thinking}
              </div>
            </div>
          )}

          {/* Accumulated content (AI explanation) */}
          {state.accumulatedContent && state.isStreaming && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="mb-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                📝 AI Response
              </div>
              <div className="max-h-32 overflow-y-auto text-sm text-blue-900 dark:text-blue-100">
                {state.accumulatedContent}
              </div>
            </div>
          )}

          {/* Tool details */}
          {getToolDetails()}

          {/* Error details */}
          {state.hasError && state.error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
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

          {/* Completion summary */}
          {state.isComplete && state.result && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  ✅ Generation Complete
                </span>
              </div>
              <div className="space-y-1 text-xs text-green-700 dark:text-green-400">
                {state.result.files && (
                  <div>📁 {state.result.files.length} files created</div>
                )}
                {state.toolHistory.length > 0 && (
                  <div>🔧 {state.toolHistory.length} tools used</div>
                )}
                <div>
                  ⏱️ Duration: {(state.result.duration / 1000).toFixed(1)}s
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
