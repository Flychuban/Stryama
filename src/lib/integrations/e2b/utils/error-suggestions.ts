/**
 * Error Suggestions Utility
 * Provides actionable fix suggestions for common E2B sandbox errors
 *
 * Features:
 * - Hardcoded suggestions for common error patterns
 * - Actionable commands and code fixes
 * - Links to relevant documentation
 * - Can be extended with AI-powered suggestions
 */

import type { ErrorCategory, ErrorAnalysis } from '../services/error-analyzer';

export type FixSuggestion = {
  readonly title: string;
  readonly description: string;
  readonly action?: FixAction;
  readonly learnMoreUrl?: string;
  readonly priority: 'high' | 'medium' | 'low';
};

export type FixAction =
  | {
      readonly type: 'command';
      readonly command: string;
      readonly description: string;
    }
  | {
      readonly type: 'code';
      readonly file: string;
      readonly line?: number;
      readonly fix: string;
    }
  | {
      readonly type: 'retry';
      readonly description: string;
    };

/**
 * Generate fix suggestions based on error analysis
 *
 * @param errorAnalysis - Analyzed error
 * @returns Array of fix suggestions ordered by priority
 */
export function generateFixSuggestions(
  errorAnalysis: ErrorAnalysis
): readonly FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  // Get category-specific suggestions
  const categorySuggestions = getSuggestionsForCategory(
    errorAnalysis.category,
    errorAnalysis
  );
  suggestions.push(...categorySuggestions);

  // Get pattern-specific suggestions
  const patternSuggestions = getSuggestionsForPatterns(errorAnalysis);
  suggestions.push(...patternSuggestions);

  // Sort by priority
  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Get suggestions based on error category
 */
function getSuggestionsForCategory(
  category: ErrorCategory,
  errorAnalysis: ErrorAnalysis
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];

  switch (category) {
    case 'SYNTAX_ERROR':
      if (errorAnalysis.affectedFiles.length > 0) {
        suggestions.push({
          title: 'Fix syntax error',
          description: `Check the syntax in ${errorAnalysis.affectedFiles[0]} and fix any issues.`,
          priority: 'high',
          learnMoreUrl:
            'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Grammar_and_types',
        });
      }
      break;

    case 'BUILD_ERROR':
      suggestions.push(
        {
          title: 'Clean and rebuild',
          description: 'Remove node_modules and reinstall dependencies.',
          action: {
            type: 'command',
            command: 'rm -rf node_modules && npm install',
            description: 'Clean install dependencies',
          },
          priority: 'high',
        },
        {
          title: 'Check TypeScript configuration',
          description: 'Verify your tsconfig.json file is properly configured.',
          priority: 'medium',
          learnMoreUrl:
            'https://www.typescriptlang.org/docs/handbook/tsconfig-json.html',
        }
      );
      break;

    case 'DEPENDENCY_ERROR':
      suggestions.push(
        {
          title: 'Reinstall dependencies',
          description: 'Try installing dependencies again.',
          action: {
            type: 'command',
            command: 'npm install',
            description: 'Install dependencies',
          },
          priority: 'high',
        },
        {
          title: 'Clear npm cache',
          description: 'Clear the npm cache and try again.',
          action: {
            type: 'command',
            command: 'npm cache clean --force && npm install',
            description: 'Clear cache and reinstall',
          },
          priority: 'medium',
        },
        {
          title: 'Check package.json',
          description:
            'Verify all dependencies are correctly specified in package.json.',
          priority: 'medium',
        }
      );
      break;

    case 'PORT_CONFLICT':
      suggestions.push({
        title: 'Restart preview',
        description: 'The preview will automatically try a different port.',
        action: {
          type: 'retry',
          description: 'Click "Restart Preview" to try again',
        },
        priority: 'high',
      });
      break;

    case 'RUNTIME_ERROR':
      if (errorAnalysis.affectedFiles.length > 0) {
        suggestions.push({
          title: 'Check the error location',
          description: `Review the code in ${errorAnalysis.affectedFiles[0]} around the error location.`,
          priority: 'high',
        });
      }
      suggestions.push({
        title: 'Check console logs',
        description:
          'Review the console output for more detailed error information.',
        priority: 'medium',
      });
      break;

    case 'TIMEOUT_ERROR':
      suggestions.push(
        {
          title: 'Try again',
          description:
            'The operation may have been slow. Try running it again.',
          action: {
            type: 'retry',
            description: 'Retry the operation',
          },
          priority: 'high',
        },
        {
          title: 'Check for infinite loops',
          description:
            "Make sure your code doesn't have any infinite loops or very long-running operations.",
          priority: 'medium',
        }
      );
      break;

    case 'NETWORK_ERROR':
      suggestions.push(
        {
          title: 'Check internet connection',
          description: 'Verify your internet connection and try again.',
          action: {
            type: 'retry',
            description: 'Retry when connection is stable',
          },
          priority: 'high',
        },
        {
          title: 'Check external API URLs',
          description:
            'If your app calls external APIs, verify the URLs are correct.',
          priority: 'medium',
        }
      );
      break;

    case 'OUT_OF_MEMORY':
      suggestions.push(
        {
          title: 'Reduce memory usage',
          description:
            'Optimize your code to use less memory. Consider processing data in smaller chunks.',
          priority: 'high',
        },
        {
          title: 'Simplify the application',
          description:
            'Try removing complex features or large data sets temporarily.',
          priority: 'medium',
        }
      );
      break;

    case 'PERMISSION_ERROR':
      suggestions.push({
        title: 'Report the issue',
        description:
          'This is likely a sandbox configuration issue. Please report this error.',
        priority: 'high',
      });
      break;

    case 'UNKNOWN_ERROR':
      suggestions.push({
        title: 'Try restarting the preview',
        description: 'Sometimes restarting can resolve unexpected errors.',
        action: {
          type: 'retry',
          description: 'Restart the preview server',
        },
        priority: 'medium',
      });
      break;
  }

  return suggestions;
}

/**
 * Get suggestions based on specific error patterns
 */
function getSuggestionsForPatterns(
  errorAnalysis: ErrorAnalysis
): FixSuggestion[] {
  const suggestions: FixSuggestion[] = [];
  const errorLower = errorAnalysis.originalError.toLowerCase();

  // Module not found
  if (
    errorLower.includes('module not found') ||
    errorLower.includes('cannot find module')
  ) {
    const moduleMatch = /['"]([^'"]+)['"]/.exec(errorAnalysis.originalError);
    const moduleName = moduleMatch?.[1];

    if (moduleName) {
      suggestions.push({
        title: `Install missing module: ${moduleName}`,
        description: `The module "${moduleName}" is not installed.`,
        action: {
          type: 'command',
          command: `npm install ${moduleName}`,
          description: `Install ${moduleName}`,
        },
        priority: 'high',
      });
    }
  }

  // TypeScript errors
  if (errorLower.includes('typescript') || errorLower.includes('ts(')) {
    suggestions.push({
      title: 'Fix TypeScript errors',
      description: 'Review and fix the TypeScript type errors in your code.',
      priority: 'high',
      learnMoreUrl: 'https://www.typescriptlang.org/docs/handbook/intro.html',
    });
  }

  // React errors
  if (errorLower.includes('react') && errorLower.includes('hook')) {
    suggestions.push({
      title: 'Check React Hooks rules',
      description:
        "Make sure you're following the Rules of Hooks (only call hooks at the top level).",
      priority: 'high',
      learnMoreUrl: 'https://react.dev/reference/rules/rules-of-hooks',
    });
  }

  // Next.js errors
  if (errorLower.includes('next') && errorLower.includes('hydration')) {
    suggestions.push({
      title: 'Fix hydration mismatch',
      description:
        'Make sure server-rendered HTML matches client-side React output.',
      priority: 'high',
      learnMoreUrl: 'https://nextjs.org/docs/messages/react-hydration-error',
    });
  }

  // Missing dependencies in package.json
  if (errorLower.includes('package.json') && errorLower.includes('not found')) {
    suggestions.push({
      title: 'Add missing dependency',
      description: 'Add the required dependency to your package.json file.',
      priority: 'high',
    });
  }

  // ESLint errors
  if (errorLower.includes('eslint')) {
    suggestions.push({
      title: 'Fix linting errors',
      description: 'Review and fix the ESLint errors in your code.',
      action: {
        type: 'command',
        command: 'npm run lint',
        description: 'Run ESLint to see all errors',
      },
      priority: 'low',
    });
  }

  return suggestions;
}

/**
 * Cache for AI-generated suggestions (future enhancement)
 * Can be used to avoid calling AI for the same error multiple times
 */
const suggestionCache = new Map<string, readonly FixSuggestion[]>();

/**
 * Generate AI-powered suggestions for complex errors
 * (Placeholder for future implementation using Claude)
 *
 * @param errorAnalysis - Analyzed error
 * @returns Array of AI-generated suggestions
 */
export async function generateAISuggestions(
  errorAnalysis: ErrorAnalysis
): Promise<readonly FixSuggestion[]> {
  // Check cache
  const cacheKey = `${errorAnalysis.category}-${errorAnalysis.originalError.substring(0, 100)}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Post-MVP: Use Claude AI to analyze complex compilation errors
  // Current rule-based error suggestions work well for common errors
  // Future enhancement: Send error to Claude for intelligent error analysis and custom fix suggestions

  const aiSuggestions: FixSuggestion[] = [];

  // Cache the result
  suggestionCache.set(cacheKey, aiSuggestions);

  return aiSuggestions;
}

/**
 * Clear the suggestion cache
 */
export function clearSuggestionCache(): void {
  suggestionCache.clear();
}
