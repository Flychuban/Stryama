/**
 * GenerationPreview Component
 *
 * Animated preview display shown while AI is generating code.
 * Provides visual feedback and engaging animations during generation.
 */

'use client';

import { Brain, Code2, Terminal, Sparkles, FileCode } from 'lucide-react';
import type { StreamState } from '~/hooks/useAIGenerationStream';

interface GenerationPreviewProps {
  status: StreamState['status'];
  toolHistory: StreamState['toolHistory'];
  currentTool?: StreamState['currentTool'];
  className?: string;
}

export function GenerationPreview({
  status,
  toolHistory,
  currentTool,
  className = '',
}: GenerationPreviewProps) {
  // Get list of files being created from tool history
  const filesCreated = toolHistory
    .filter((tool) => tool.name === 'E2B_Write')
    .map((tool) => tool.input.file_path as string)
    .filter(Boolean);

  // Add current file being written if applicable
  if (currentTool?.name === 'E2B_Write' && currentTool.input.file_path) {
    filesCreated.push(currentTool.input.file_path as string);
  }

  const getStatusDisplay = () => {
    switch (status) {
      case 'initializing':
        return {
          icon: Sparkles,
          title: 'Initializing',
          subtitle: 'Setting up environment...',
          color: 'text-purple-500',
        };
      case 'thinking':
        return {
          icon: Brain,
          title: 'Thinking',
          subtitle: 'Planning your application...',
          color: 'text-blue-500',
        };
      case 'writing':
      case 'tool_use':
        return {
          icon: Code2,
          title: 'Writing Code',
          subtitle: 'Creating your files...',
          color: 'text-green-500',
        };
      case 'executing':
        return {
          icon: Terminal,
          title: 'Building',
          subtitle: 'Installing dependencies and starting preview...',
          color: 'text-yellow-500',
        };
      case 'completing':
        return {
          icon: Sparkles,
          title: 'Finalizing',
          subtitle: 'Almost ready...',
          color: 'text-indigo-500',
        };
      default:
        return {
          icon: Code2,
          title: 'Processing',
          subtitle: 'Working on your request...',
          color: 'text-gray-500',
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <div
      className={`flex h-full flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-8 dark:from-gray-900 dark:to-gray-950 ${className}`}
    >
      {/* Status icon with animation */}
      <div className="relative mb-8">
        {/* Pulsing background circles */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-32 animate-ping rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animation-delay-300 h-24 w-24 animate-ping rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20" />
        </div>

        {/* Main icon */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg dark:bg-gray-800">
          <StatusIcon
            className={`h-10 w-10 animate-pulse ${statusDisplay.color}`}
          />
        </div>
      </div>

      {/* Status text */}
      <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {statusDisplay.title}
      </h2>
      <p className="mb-8 text-sm text-gray-600 dark:text-gray-400">
        {statusDisplay.subtitle}
      </p>

      {/* File tree visualization */}
      {filesCreated.length > 0 && (
        <div className="w-full max-w-md">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <FileCode className="h-4 w-4" />
            <span>Files Created ({filesCreated.length})</span>
          </div>
          <div className="max-h-64 space-y-1 overflow-auto rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            {filesCreated.map((file, idx) => (
              <div
                key={`${file}-${idx}`}
                className="flex items-center gap-2 text-sm animate-in fade-in slide-in-from-left-2"
                style={{
                  animationDelay: `${idx * 100}ms`,
                  animationFillMode: 'backwards',
                }}
              >
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <code className="text-gray-700 dark:text-gray-300">{file}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Animated code lines (decorative) */}
      <div className="mt-8 w-full max-w-md space-y-2 opacity-30">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-3 animate-pulse rounded bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-700 dark:to-gray-600"
            style={{
              width: `${Math.random() * 40 + 60}%`,
              animationDelay: `${i * 200}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
