/**
 * Dependency Detector Utility
 *
 * Analyzes generated code files to detect imported npm packages
 * and their required versions.
 */

import type { File } from '@prisma/client';

/**
 * Common npm packages with their latest stable versions
 * Used when we detect imports but don't know exact version
 */
const COMMON_PACKAGE_VERSIONS: Record<string, string> = {
  'react-router-dom': '^6.28.0',
  'react-router': '^6.28.0',
  axios: '^1.7.9',
  'framer-motion': '^11.15.0',
  'lucide-react': '^0.460.0',
  '@radix-ui/react-dialog': '^1.1.2',
  '@radix-ui/react-dropdown-menu': '^2.1.2',
  '@radix-ui/react-select': '^2.1.2',
  '@radix-ui/react-tabs': '^1.1.1',
  '@radix-ui/react-tooltip': '^1.1.4',
  // Additional Radix UI primitives (for edge case detection)
  '@radix-ui/react-label': '^2.1.0',
  '@radix-ui/react-separator': '^1.1.0',
  '@radix-ui/react-checkbox': '^1.1.2',
  '@radix-ui/react-switch': '^1.1.1',
  '@radix-ui/react-radio-group': '^1.2.1',
  '@radix-ui/react-popover': '^1.1.2',
  '@radix-ui/react-accordion': '^1.2.1',
  '@radix-ui/react-avatar': '^1.1.1',
  '@radix-ui/react-progress': '^1.1.0',
  '@radix-ui/react-slider': '^1.2.1',
  '@radix-ui/react-scroll-area': '^1.2.0',
  '@radix-ui/react-toast': '^1.2.2',
  '@radix-ui/react-context-menu': '^2.2.2',
  '@radix-ui/react-hover-card': '^1.1.2',
  '@radix-ui/react-menubar': '^1.1.2',
  '@radix-ui/react-navigation-menu': '^1.2.1',
  'class-variance-authority': '^0.7.1',
  clsx: '^2.1.1',
  'tailwind-merge': '^2.6.0',
  'date-fns': '^4.1.0',
  zustand: '^5.0.2',
  'react-hook-form': '^7.54.0',
  zod: '^3.24.1',
  '@tanstack/react-query': '^5.62.7',
  '@tanstack/react-table': '^8.20.6',
  recharts: '^2.15.0',
  'react-hot-toast': '^2.4.1',
  sonner: '^1.7.1',
  'next-themes': '^0.4.4',
} as const;

/**
 * Node.js built-in modules that should not be treated as npm packages
 * These are available in Node.js runtime without installation
 */
const NODE_BUILTINS = new Set([
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'https',
  'net',
  'os',
  'path',
  'punycode',
  'querystring',
  'readline',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'zlib',
]);

/**
 * Packages that should be in devDependencies instead of dependencies
 */
const DEV_DEPENDENCIES = new Set([
  '@types/node',
  '@types/react',
  '@types/react-dom',
  'tailwindcss',
  'autoprefixer',
  'postcss',
  'eslint',
  'prettier',
]);

/**
 * Regex patterns to extract import statements
 * Matches:
 * - import foo from 'package-name'
 * - import { foo } from 'package-name'
 * - import * as foo from 'package-name'
 * - import 'package-name' (side-effect imports)
 * - const foo = require('package-name')
 * - import('package-name') (dynamic imports)
 * - export { foo } from 'package-name' (re-exports)
 * - export * from 'package-name' (re-exports)
 */
const IMPORT_PATTERNS = [
  /import\s+(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g, // Standard imports
  /import\s+['"]([^'"]+)['"]/g, // Side-effect imports
  /require\(['"]([^'"]+)['"]\)/g, // CommonJS require
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // Dynamic imports
  /export\s+(?:\*|{[^}]+})\s+from\s+['"]([^'"]+)['"]/g, // Re-exports
  /export\s+\*\s+as\s+\w+\s+from\s+['"]([^'"]+)['"]/g, // Named re-exports
] as const;

/**
 * Extract the package name from an import path
 * Examples:
 * - "react-router-dom" -> "react-router-dom"
 * - "@radix-ui/react-dialog" -> "@radix-ui/react-dialog"
 * - "react-router-dom/dist/index" -> "react-router-dom"
 */
function extractPackageName(importPath: string): string {
  if (!importPath) return '';

  // Scoped packages (@org/package)
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    if (parts.length < 2) return importPath;
    return parts.slice(0, 2).join('/'); // @org/package
  }

  // Regular packages
  const parts = importPath.split('/');
  return parts[0] ?? '';
}

/**
 * Check if an import path is an npm package (not a local file or built-in module)
 */
function isNpmPackage(importPath: string): boolean {
  // Local imports start with ./ or ../ or /
  if (
    importPath.startsWith('./') ||
    importPath.startsWith('../') ||
    importPath.startsWith('/')
  ) {
    return false;
  }

  // Built-in Node.js modules with node: prefix
  if (importPath.startsWith('node:')) {
    return false;
  }

  // Check if it's a Node.js built-in module without prefix
  const packageName = extractPackageName(importPath);
  if (NODE_BUILTINS.has(packageName)) {
    return false;
  }

  return true;
}

/**
 * Scan file content for import statements and extract package names
 */
function scanFileForImports(content: string): Set<string> {
  const packages = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    // Reset regex lastIndex to ensure we scan from the beginning
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath) continue;

      if (isNpmPackage(importPath)) {
        const packageName = extractPackageName(importPath);
        packages.add(packageName);
      }
    }
  }

  return packages;
}

/**
 * Detect npm dependencies from an array of files
 *
 * @param files - Array of File objects or file-like objects with path and content
 * @returns Object with dependencies and devDependencies
 *
 * @example
 * ```typescript
 * const deps = detectDependencies(files);
 * console.log(deps.dependencies);
 * // { 'react-router-dom': '^6.28.0', 'axios': '^1.7.9' }
 * ```
 */
export function detectDependencies(
  files: readonly (File | { path: string; content: string })[]
): {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
} {
  const allPackages = new Set<string>();

  // Scan all files for imports
  for (const file of files) {
    // Only scan TypeScript/JavaScript files
    if (
      file.path.endsWith('.ts') ||
      file.path.endsWith('.tsx') ||
      file.path.endsWith('.js') ||
      file.path.endsWith('.jsx')
    ) {
      const filePackages = scanFileForImports(file.content);
      filePackages.forEach((pkg) => allPackages.add(pkg));
    }
  }

  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};

  // Categorize packages and assign versions
  for (const packageName of allPackages) {
    // Skip React core packages (already included by default)
    if (packageName === 'react' || packageName === 'react-dom') {
      continue;
    }

    const version = COMMON_PACKAGE_VERSIONS[packageName] ?? 'latest';

    if (DEV_DEPENDENCIES.has(packageName)) {
      devDependencies[packageName] = version;
    } else {
      dependencies[packageName] = version;
    }
  }

  return { dependencies, devDependencies };
}

/**
 * Log detected dependencies for debugging
 */
export function logDetectedDependencies(
  deps: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  },
  logPrefix: string
): void {
  const depCount = Object.keys(deps.dependencies).length;
  const devDepCount = Object.keys(deps.devDependencies).length;

  if (depCount > 0) {
    console.log(
      `${logPrefix} 📦 Detected ${depCount} additional dependencies:`,
      Object.keys(deps.dependencies)
    );
  }

  if (devDepCount > 0) {
    console.log(
      `${logPrefix} 🔧 Detected ${devDepCount} dev dependencies:`,
      Object.keys(deps.devDependencies)
    );
  }

  if (depCount === 0 && devDepCount === 0) {
    console.log(
      `${logPrefix} ℹ️ No additional dependencies detected (using base React setup)`
    );
  }
}
