/**
 * Framework Configuration Constants
 *
 * This app is specialized for React+Vite web applications.
 * All projects use the same tech stack for consistency and quality.
 */

export const FRAMEWORK_CONFIG = {
  /** Framework name */
  name: 'React + Vite',

  /** Framework identifier */
  id: 'react-vite',

  /** Development server port (Vite default) */
  port: 5173,

  /** Development server command */
  devCommand: 'npm run dev',

  /** Build command */
  buildCommand: 'npm run build',

  /** Preview command (for built app) */
  previewCommand: 'npm run preview',
} as const;

/**
 * Framework type for backward compatibility with existing code
 */
export const FRAMEWORK_TYPE = 'react' as const;

export type FrameworkType = typeof FRAMEWORK_TYPE;
