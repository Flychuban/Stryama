/**
 * CommandOutput Component
 *
 * Displays bash command execution with terminal-style output.
 * Shows command, status, and output in a terminal-like interface.
 */

'use client';

import { Terminal, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface CommandOutputProps {
  command: string;
  output?: string;
  isError?: boolean;
  isRunning?: boolean;
  className?: string;
}

export function CommandOutput({
  command,
  output,
  isError = false,
  isRunning = false,
  className = '',
}: CommandOutputProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-gray-300 bg-gray-900 font-mono text-sm dark:border-gray-600 ${className}`}
    >
      {/* Terminal header */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-green-400" />
          <span className="text-xs text-gray-400">Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <>
              <Clock className="h-3 w-3 animate-pulse text-yellow-400" />
              <span className="text-xs text-yellow-400">Running...</span>
            </>
          )}
          {!isRunning && output && !isError && (
            <>
              <CheckCircle2 className="h-3 w-3 text-green-400" />
              <span className="text-xs text-green-400">Success</span>
            </>
          )}
          {!isRunning && output && isError && (
            <>
              <XCircle className="h-3 w-3 text-red-400" />
              <span className="text-xs text-red-400">Error</span>
            </>
          )}
        </div>
      </div>

      {/* Command and output */}
      <div className="p-4">
        {/* Command */}
        <div className="flex items-start gap-2">
          <span className="text-green-400">$</span>
          <span className="flex-1 text-gray-100">{command}</span>
        </div>

        {/* Output */}
        {output && (
          <div
            className={`mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words ${
              isError ? 'text-red-400' : 'text-gray-300'
            }`}
          >
            {output}
          </div>
        )}

        {/* Running indicator */}
        {isRunning && !output && (
          <div className="mt-2 flex items-center gap-2 text-gray-400">
            <div className="flex gap-1">
              <span className="animate-pulse">▓</span>
              <span className="animation-delay-200 animate-pulse">▓</span>
              <span className="animation-delay-400 animate-pulse">▓</span>
            </div>
            <span className="text-xs">Executing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
