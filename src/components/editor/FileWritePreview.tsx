/**
 * FileWritePreview Component
 *
 * Displays file content being written by the AI with syntax highlighting.
 * Shows a preview of the file with expand/collapse for long files.
 */

'use client';

import { useState } from 'react';
import {
  FileCode,
  FileJson,
  File,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface FileWritePreviewProps {
  filePath: string;
  content: string;
  maxLines?: number;
  className?: string;
}

export function FileWritePreview({
  filePath,
  content,
  maxLines = 20,
  className = '',
}: FileWritePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get file extension for language detection
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'css':
        return 'css';
      case 'html':
        return 'html';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'text';
    }
  };

  // Get appropriate icon for file type
  const getFileIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return <FileCode className="h-4 w-4 text-blue-500" />;
      case 'json':
        return <FileJson className="h-4 w-4 text-yellow-500" />;
      case 'css':
        return <File className="h-4 w-4 text-purple-500" />;
      case 'html':
        return <File className="h-4 w-4 text-orange-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  const language = getLanguage(filePath);
  const lines = content.split('\n');
  const totalLines = lines.length;
  const shouldTruncate = totalLines > maxLines;
  const displayLines =
    isExpanded || !shouldTruncate ? lines : lines.slice(0, maxLines);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      {/* File header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          {getFileIcon(filePath)}
          <code className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {filePath}
          </code>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {language}
          </span>
        </div>
        {shouldTruncate && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="h-3 w-3" />
                Collapse
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3" />
                Show all ({totalLines} lines)
              </>
            )}
          </button>
        )}
      </div>

      {/* Code content */}
      <div className="max-h-96 overflow-auto">
        <pre className="p-4 text-sm">
          <code className="text-gray-800 dark:text-gray-200">
            {displayLines.map((line, idx) => {
              const lineNumber = idx + 1;
              return (
                <div
                  key={lineNumber}
                  className="group flex hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <span className="mr-4 inline-block w-8 select-none text-right text-gray-400 dark:text-gray-600">
                    {lineNumber}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all">
                    {line || ' '}
                  </span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Truncation indicator */}
      {shouldTruncate && !isExpanded && (
        <div className="border-t border-gray-200 bg-gray-100 px-4 py-2 text-center dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            + {totalLines - maxLines} more lines
          </button>
        </div>
      )}
    </div>
  );
}
