/**
 * Framework Configuration Utility
 *
 * This app is specialized for React+Vite web applications.
 * All projects use the same framework configuration.
 */

import { FRAMEWORK_CONFIG, FRAMEWORK_TYPE } from '@/lib/constants/framework';
import type { FrameworkType } from '@/lib/integrations/claude/types';

/**
 * Returns the framework type for this app (always React+Vite)
 *
 * @returns FrameworkType constant
 */
export function getFrameworkType(): FrameworkType {
  return FRAMEWORK_TYPE;
}

/**
 * Gets the port number for React+Vite development server
 *
 * @returns Port number (5173 - Vite default)
 */
export function getFrameworkPort(): number {
  return FRAMEWORK_CONFIG.port;
}

/**
 * Gets the development server start command for React+Vite
 *
 * @returns Command to start the development server
 */
export function getFrameworkCommand(): string {
  return `npm install && ${FRAMEWORK_CONFIG.devCommand}`;
}
