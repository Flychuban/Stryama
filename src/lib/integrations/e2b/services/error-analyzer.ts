/**
 * Error Analysis Service for E2B Sandboxes
 * Analyzes errors from sandbox operations and provides detailed diagnostics
 *
 * Features:
 * - Classifies errors into specific categories
 * - Extracts stack traces and error details
 * - Provides user-friendly error messages
 * - Suggests potential fixes
 */

import type { E2BSandboxError } from '../errors';

export type ErrorCategory =
  | 'SYNTAX_ERROR'
  | 'BUILD_ERROR'
  | 'RUNTIME_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'PORT_CONFLICT'
  | 'OUT_OF_MEMORY'
  | 'PERMISSION_ERROR'
  | 'UNKNOWN_ERROR';

export type StackFrame = {
  readonly file: string;
  readonly line: number | null;
  readonly column: number | null;
  readonly function: string | null;
};

export type ErrorAnalysis = {
  readonly category: ErrorCategory;
  readonly title: string;
  readonly message: string;
  readonly originalError: string;
  readonly stackTrace: readonly StackFrame[] | null;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly recoverable: boolean;
  readonly affectedFiles: readonly string[];
  readonly timestamp: Date;
};

export class ErrorAnalyzer {
  analyzeError(
    error: unknown,
    context?: {
      readonly logs?: readonly string[];
      readonly command?: string;
      readonly source?: 'preview' | 'build' | 'install' | 'command';
    }
  ): ErrorAnalysis {
    const errorString = this.extractErrorString(error);
    const category = this.classifyError(errorString, context);
    const stackTrace = this.parseStackTrace(errorString);
    const affectedFiles = this.extractAffectedFiles(errorString, stackTrace);

    return {
      category,
      title: this.getErrorTitle(category),
      message: this.getUserFriendlyMessage(category, errorString),
      originalError: errorString,
      stackTrace,
      severity: this.getSeverity(category),
      recoverable: this.isRecoverable(category),
      affectedFiles,
      timestamp: new Date(),
    };
  }

  private classifyError(
    errorString: string,
    context?: {
      readonly logs?: readonly string[];
      readonly command?: string;
      readonly source?: 'preview' | 'build' | 'install' | 'command';
    }
  ): ErrorCategory {
    const lowerError = errorString.toLowerCase();
    const logs = context?.logs?.join('\n').toLowerCase() ?? '';

    // Syntax errors
    if (
      lowerError.includes('syntaxerror') ||
      lowerError.includes('unexpected token') ||
      lowerError.includes('unexpected identifier') ||
      lowerError.includes('parsing error')
    ) {
      return 'SYNTAX_ERROR';
    }

    // Build/compilation errors
    if (
      lowerError.includes('module not found') ||
      lowerError.includes('cannot find module') ||
      lowerError.includes('failed to compile') ||
      lowerError.includes('compilation error') ||
      logs.includes('npm err!') ||
      (context?.source === 'build' && lowerError.includes('error'))
    ) {
      return 'BUILD_ERROR';
    }

    // Dependency errors
    if (
      lowerError.includes('npm install failed') ||
      lowerError.includes('package.json') ||
      lowerError.includes('dependency') ||
      lowerError.includes('peer dependency') ||
      logs.includes('npm install') ||
      context?.command?.includes('npm install')
    ) {
      return 'DEPENDENCY_ERROR';
    }

    // Port conflicts
    if (
      lowerError.includes('eaddrinuse') ||
      lowerError.includes('port') ||
      lowerError.includes('address already in use')
    ) {
      return 'PORT_CONFLICT';
    }

    // Out of memory
    if (
      lowerError.includes('out of memory') ||
      lowerError.includes('enomem') ||
      lowerError.includes('heap out of memory') ||
      lowerError.includes('javascript heap')
    ) {
      return 'OUT_OF_MEMORY';
    }

    // Permission errors
    if (
      lowerError.includes('eacces') ||
      lowerError.includes('eperm') ||
      lowerError.includes('permission denied')
    ) {
      return 'PERMISSION_ERROR';
    }

    // Timeout errors
    if (
      lowerError.includes('timeout') ||
      lowerError.includes('timed out') ||
      lowerError.includes('etimedout')
    ) {
      return 'TIMEOUT_ERROR';
    }

    // Network errors
    if (
      lowerError.includes('network') ||
      lowerError.includes('econnrefused') ||
      lowerError.includes('enotfound') ||
      lowerError.includes('fetch failed') ||
      lowerError.includes('connection')
    ) {
      return 'NETWORK_ERROR';
    }

    // Runtime errors (must be after more specific checks)
    if (
      lowerError.includes('runtime error') ||
      lowerError.includes('referenceerror') ||
      lowerError.includes('typeerror') ||
      lowerError.includes('rangeerror') ||
      lowerError.includes('is not defined') ||
      lowerError.includes('cannot read')
    ) {
      return 'RUNTIME_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Parse stack trace from error string
   */
  private parseStackTrace(errorString: string): readonly StackFrame[] | null {
    // Match common stack trace patterns
    // e.g., "at functionName (file.js:10:5)" or "at file.js:10:5"
    const stackLineRegex = /at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/g;

    const frames: StackFrame[] = [];
    let match;

    while ((match = stackLineRegex.exec(errorString)) !== null) {
      frames.push({
        function: match[1]?.trim() ?? null,
        file: match[2]?.trim() ?? '',
        line: match[3] ? parseInt(match[3], 10) : null,
        column: match[4] ? parseInt(match[4], 10) : null,
      });
    }

    return frames.length > 0 ? frames : null;
  }

  /**
   * Extract affected files from error and stack trace
   */
  private extractAffectedFiles(
    errorString: string,
    stackTrace: readonly StackFrame[] | null
  ): readonly string[] {
    const files = new Set<string>();

    // From stack trace
    if (stackTrace) {
      for (const frame of stackTrace) {
        if (frame.file && !frame.file.includes('node_modules')) {
          files.add(frame.file);
        }
      }
    }

    // From error message (e.g., "in file.ts")
    const fileRegex = /(?:in|at|from)\s+([^\s:]+\.(?:ts|tsx|js|jsx|json))/gi;
    let match;

    while ((match = fileRegex.exec(errorString)) !== null) {
      const file = match[1];
      if (file && !file.includes('node_modules')) {
        files.add(file);
      }
    }

    return Array.from(files);
  }

  /**
   * Extract error string from various error types
   */
  private extractErrorString(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      return error.message;
    }

    return String(error);
  }

  /**
   * Get user-friendly error title
   */
  private getErrorTitle(category: ErrorCategory): string {
    switch (category) {
      case 'SYNTAX_ERROR':
        return 'Syntax Error';
      case 'BUILD_ERROR':
        return 'Build Failed';
      case 'RUNTIME_ERROR':
        return 'Runtime Error';
      case 'NETWORK_ERROR':
        return 'Network Connection Error';
      case 'TIMEOUT_ERROR':
        return 'Operation Timed Out';
      case 'DEPENDENCY_ERROR':
        return 'Dependency Installation Failed';
      case 'PORT_CONFLICT':
        return 'Port Already in Use';
      case 'OUT_OF_MEMORY':
        return 'Out of Memory';
      case 'PERMISSION_ERROR':
        return 'Permission Denied';
      case 'UNKNOWN_ERROR':
        return 'An Error Occurred';
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(
    category: ErrorCategory,
    originalError: string
  ): string {
    switch (category) {
      case 'SYNTAX_ERROR':
        return 'Your code contains a syntax error. Please check the highlighted line and fix the issue.';

      case 'BUILD_ERROR':
        return 'The build process failed. This usually means there is an issue with your code or configuration.';

      case 'RUNTIME_ERROR':
        return 'Your application encountered an error while running. Check the stack trace below for details.';

      case 'NETWORK_ERROR':
        return 'Unable to connect to the network. Please check your connection and try again.';

      case 'TIMEOUT_ERROR':
        return 'The operation took too long to complete and was cancelled. Try again or check for performance issues.';

      case 'DEPENDENCY_ERROR':
        return 'Failed to install project dependencies. Check your package.json file and network connection.';

      case 'PORT_CONFLICT':
        return 'The port is already in use by another process. The preview server will try a different port.';

      case 'OUT_OF_MEMORY':
        return 'The application ran out of memory. Try reducing memory usage or simplifying your code.';

      case 'PERMISSION_ERROR':
        return 'Permission denied while accessing a file or directory. This is usually a sandbox configuration issue.';

      case 'UNKNOWN_ERROR':
        // Try to extract a useful message from the error
        const lines = originalError.split('\n');
        const firstMeaningfulLine = lines.find(
          (line) => line.trim() && !line.startsWith('at ')
        );
        return (
          firstMeaningfulLine?.trim() ??
          'An unexpected error occurred. Check the console for more details.'
        );
    }
  }

  /**
   * Determine error severity
   */
  private getSeverity(category: ErrorCategory): ErrorAnalysis['severity'] {
    switch (category) {
      case 'SYNTAX_ERROR':
      case 'BUILD_ERROR':
        return 'high'; // Blocks execution

      case 'RUNTIME_ERROR':
      case 'DEPENDENCY_ERROR':
      case 'OUT_OF_MEMORY':
        return 'critical'; // App crashes

      case 'TIMEOUT_ERROR':
      case 'PORT_CONFLICT':
        return 'medium'; // Can often recover

      case 'NETWORK_ERROR':
      case 'PERMISSION_ERROR':
        return 'medium'; // May be temporary

      case 'UNKNOWN_ERROR':
        return 'medium'; // Conservative default
    }
  }

  /**
   * Determine if error is recoverable
   */
  private isRecoverable(category: ErrorCategory): boolean {
    switch (category) {
      case 'TIMEOUT_ERROR':
      case 'NETWORK_ERROR':
      case 'PORT_CONFLICT':
        return true; // Can retry

      case 'SYNTAX_ERROR':
      case 'BUILD_ERROR':
      case 'DEPENDENCY_ERROR':
        return true; // User can fix

      case 'OUT_OF_MEMORY':
      case 'PERMISSION_ERROR':
      case 'RUNTIME_ERROR':
        return false; // Requires code changes

      case 'UNKNOWN_ERROR':
        return false; // Unknown if recoverable
    }
  }
}

// Singleton instance
export const errorAnalyzer = new ErrorAnalyzer();
