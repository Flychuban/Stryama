/**
 * Framework Detection Utility
 *
 * Auto-detects the framework type from project files to determine
 * which development server command to run and which port to use.
 */

import type { File } from '@prisma/client';
import { FrameworkType } from '@/lib/integrations/claude/types';

/**
 * Detects the framework type based on project files.
 *
 * Detection logic:
 * 1. Next.js: Presence of next.config.js or next.config.mjs
 * 2. React/Vite: Presence of vite.config.ts, vite.config.js, or vite.config.mjs
 * 3. Vanilla HTML: Presence of index.html without framework configs
 * 4. Custom: Fallback for unknown project structures
 *
 * @param files - Array of project files to analyze
 * @returns Detected FrameworkType
 */
export function detectFramework(files: readonly File[]): FrameworkType {
  // Extract file names from paths for easier checking
  const fileNames = files.map((file) => {
    const parts = file.path.split('/');
    return parts[parts.length - 1]?.toLowerCase() ?? '';
  });

  // Check for Next.js configuration files
  const hasNextConfig = fileNames.some(
    (name) =>
      name === 'next.config.js' ||
      name === 'next.config.mjs' ||
      name === 'next.config.ts'
  );

  if (hasNextConfig) {
    return FrameworkType.NEXTJS;
  }

  // Check for Vite configuration files (React/Vite)
  const hasViteConfig = fileNames.some(
    (name) =>
      name === 'vite.config.js' ||
      name === 'vite.config.ts' ||
      name === 'vite.config.mjs'
  );

  if (hasViteConfig) {
    return FrameworkType.REACT;
  }

  // Check for vanilla HTML (index.html without framework configs)
  const hasIndexHtml = fileNames.some((name) => name === 'index.html');

  if (hasIndexHtml) {
    return FrameworkType.VANILLA;
  }

  // Default to custom for unknown project structures
  return FrameworkType.CUSTOM;
}

/**
 * Gets the recommended port number for a given framework.
 *
 * @param framework - The framework type
 * @returns Port number to use for the development server
 */
export function getFrameworkPort(framework: FrameworkType): number {
  switch (framework) {
    case FrameworkType.NEXTJS:
      return 3000;
    case FrameworkType.REACT:
      return 5173; // Vite default port
    case FrameworkType.VANILLA:
      return 8080;
    case FrameworkType.CUSTOM:
      return 3000; // Default fallback
    default:
      return 3000;
  }
}

/**
 * Gets the development server start command for a given framework.
 *
 * @param framework - The framework type
 * @returns Command to start the development server
 */
export function getFrameworkCommand(framework: FrameworkType): string {
  switch (framework) {
    case FrameworkType.NEXTJS:
      return 'npm install && npm run dev';
    case FrameworkType.REACT:
      return 'npm install && npm run dev';
    case FrameworkType.VANILLA:
      // Use npx serve for vanilla HTML projects
      return 'npx serve . -p 8080';
    case FrameworkType.CUSTOM:
      // Try npm run dev as a reasonable default
      return 'npm install && npm run dev';
    default:
      return 'npm install && npm run dev';
  }
}
