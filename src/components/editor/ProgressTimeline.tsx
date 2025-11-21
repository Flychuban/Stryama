/**
 * ProgressTimeline Component
 *
 * Visual timeline showing tool execution progress.
 * Displays completed, current, and upcoming steps with icons and status.
 */

'use client';

import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import type { StreamState } from '~/hooks/useAIGenerationStream';

interface ProgressTimelineProps {
  toolHistory: StreamState['toolHistory'];
  currentTool?: StreamState['currentTool'];
  sandboxStatus?: StreamState['sandboxStatus'];
  status: StreamState['status'];
  className?: string;
}

export function ProgressTimeline({
  toolHistory,
  currentTool,
  sandboxStatus,
  status,
  className = '',
}: ProgressTimelineProps) {
  const getToolDisplayName = (
    toolName: string,
    input?: Record<string, unknown>,
    isCompleted?: boolean
  ): string => {
    // Extract actual tool name from MCP format (mcp__e2b-sandbox__E2B_Write -> E2B_Write)
    const parts = toolName.split('__');
    const lastPart = parts.pop() ?? '';
    const actualToolName = lastPart || toolName;

    switch (actualToolName) {
      case 'E2B_Write':
        const filePath = input?.file_path as string | undefined;
        if (filePath) {
          return isCompleted ? `Wrote ${filePath}` : `Writing ${filePath}`;
        }
        return isCompleted ? 'Wrote files' : 'Writing files';
      case 'E2B_Bash':
        const command = input?.command as string | undefined;
        if (command) {
          // Show first 40 characters of command
          const prefix = isCompleted ? 'Ran' : 'Running';
          return command.length > 40
            ? `${prefix}: ${command.slice(0, 40)}...`
            : `${prefix}: ${command}`;
        }
        return isCompleted ? 'Ran commands' : 'Running commands';
      case 'E2B_Read':
        const readPath = input?.file_path as string | undefined;
        if (readPath) {
          return isCompleted ? `Read ${readPath}` : `Reading ${readPath}`;
        }
        return isCompleted ? 'Read files' : 'Reading files';
      case 'E2B_List':
        return isCompleted ? 'Listed files' : 'Listing files';
      case 'E2B_GetPreviewURL':
        return isCompleted ? 'Got preview' : 'Getting preview';
      default:
        return actualToolName.replace('E2B_', '').replace(/_/g, ' ');
    }
  };

  const steps: Array<{
    key: string;
    label: string;
    status: 'completed' | 'current' | 'pending' | 'error';
  }> = [];

  // Add sandbox setup step
  if (sandboxStatus) {
    const sandboxCompleted = sandboxStatus === 'setup_complete';
    const sandboxCurrent =
      !sandboxCompleted &&
      ['creating', 'created', 'installing_deps', 'deps_installed'].includes(
        sandboxStatus
      );

    steps.push({
      key: 'sandbox',
      label:
        sandboxStatus === 'installing_deps'
          ? 'Installing dependencies'
          : 'Setting up sandbox',
      status: sandboxCompleted
        ? 'completed'
        : sandboxCurrent
          ? 'current'
          : 'pending',
    });
  }

  // Add completed tools
  toolHistory.forEach((tool, idx) => {
    steps.push({
      key: `${tool.id}-${idx}`,
      label: getToolDisplayName(tool.name, tool.input, true),
      status: tool.isError ? 'error' : 'completed',
    });
  });

  // Add current tool
  if (currentTool && status === 'tool_use') {
    steps.push({
      key: currentTool.id,
      label: getToolDisplayName(currentTool.name, currentTool.input, false),
      status: 'current',
    });
  }

  // Don't show timeline if no steps yet
  if (steps.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
        Progress
      </div>
      <div className="space-y-1">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex items-center gap-2">
            {/* Status icon */}
            <div className="flex-shrink-0">
              {step.status === 'completed' && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {step.status === 'current' && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
              {step.status === 'pending' && (
                <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
              )}
              {step.status === 'error' && (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>

            {/* Step label */}
            <div
              className={`flex-1 text-sm ${
                step.status === 'completed'
                  ? 'text-gray-600 dark:text-gray-400'
                  : step.status === 'current'
                    ? 'font-medium text-blue-600 dark:text-blue-400'
                    : step.status === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-400 dark:text-gray-600'
              }`}
            >
              {step.label}
            </div>

            {/* Connecting line */}
            {idx < steps.length - 1 && (
              <div className="absolute ml-2 mt-6 h-4 w-px bg-gray-200 dark:bg-gray-700" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
