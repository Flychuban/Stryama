import type { File } from '@prisma/client';

export type ValidationResult = {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
};

const FILE_SIZE_LIMITS = {
  MAX_SINGLE_FILE: 5 * 1024 * 1024, // 5MB
  MAX_TOTAL_PROJECT: 50 * 1024 * 1024, // 50MB
  MAX_FILES_PER_PROJECT: 100,
} as const;

/**
 * Dangerous code patterns that should be blocked
 */
const DANGEROUS_PATTERNS = [
  { pattern: /eval\s*\(/gi, name: 'eval() usage' },
  { pattern: /Function\s*\(/gi, name: 'Function() constructor' },
  { pattern: /__proto__/gi, name: '__proto__ manipulation' },
  {
    pattern: /constructor\s*\[\s*['"]prototype['"]\s*\]/gi,
    name: 'prototype pollution',
  },
] as const;

/**
 * SQL injection patterns to warn about
 */
const SQL_INJECTION_PATTERNS = [
  { pattern: /'\s*OR\s*'1'\s*=\s*'1/gi, name: "SQL OR '1'='1' pattern" },
  { pattern: /;\s*DROP\s+TABLE/gi, name: 'SQL DROP TABLE' },
  { pattern: /UNION\s+SELECT/gi, name: 'SQL UNION SELECT' },
  { pattern: /--\s*$/gm, name: 'SQL comment injection' },
] as const;

/**
 * XSS patterns to warn about
 */
const XSS_PATTERNS = [
  {
    pattern: /<script[^>]*>[\s\S]*?<\/script>/gi,
    name: 'script tag injection',
  },
  { pattern: /on\w+\s*=\s*['"][^'"]*['"]/gi, name: 'inline event handler' },
  { pattern: /javascript:/gi, name: 'javascript: protocol' },
] as const;

/**
 * Path traversal patterns
 */
const PATH_TRAVERSAL_PATTERNS = [
  { pattern: /\.\.\//g, name: 'parent directory traversal (..)' },
  { pattern: /\.\.\\/g, name: 'parent directory traversal (Windows)' },
  { pattern: /^\//, name: 'absolute path' },
  { pattern: /\0/g, name: 'null byte injection' },
] as const;

/**
 * Allowed file extensions
 */
const ALLOWED_EXTENSIONS = new Set([
  // Web
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  // JavaScript/TypeScript
  'js',
  'jsx',
  'ts',
  'tsx',
  'mjs',
  'cjs',
  // Config
  'json',
  'jsonc',
  'yaml',
  'yml',
  'toml',
  // Documentation
  'md',
  'mdx',
  'txt',
  // Python
  'py',
  'pyi',
  // Other
  'xml',
  'svg',
  'env',
  'gitignore',
  'eslintrc',
  'prettierrc',
]);

/**
 * File validator for E2B sandbox uploads
 */
export class FileValidator {
  static validateFile(file: File): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const fileSize = Buffer.byteLength(file.content, 'utf8');
    if (fileSize > FILE_SIZE_LIMITS.MAX_SINGLE_FILE) {
      errors.push(
        `File "${file.path}" exceeds maximum size of ${FILE_SIZE_LIMITS.MAX_SINGLE_FILE / 1024 / 1024}MB (${(fileSize / 1024 / 1024).toFixed(2)}MB)`
      );
    }

    const pathValidation = this.validatePath(file.path);
    if (!pathValidation.valid) {
      errors.push(...pathValidation.errors);
    }
    warnings.push(...pathValidation.warnings);

    const extensionValidation = this.validateExtension(file.path);
    if (!extensionValidation.valid) {
      warnings.push(...extensionValidation.errors);
    }

    const securityValidation = this.validateSecurity(file.content);
    if (!securityValidation.valid) {
      errors.push(...securityValidation.errors);
    }
    warnings.push(...securityValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateFiles(files: File[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (files.length > FILE_SIZE_LIMITS.MAX_FILES_PER_PROJECT) {
      errors.push(
        `Project exceeds maximum file count of ${FILE_SIZE_LIMITS.MAX_FILES_PER_PROJECT} (${files.length} files)`
      );
    }

    const totalSize = files.reduce(
      (sum, file) => sum + Buffer.byteLength(file.content, 'utf8'),
      0
    );
    if (totalSize > FILE_SIZE_LIMITS.MAX_TOTAL_PROJECT) {
      errors.push(
        `Project exceeds maximum total size of ${FILE_SIZE_LIMITS.MAX_TOTAL_PROJECT / 1024 / 1024}MB (${(totalSize / 1024 / 1024).toFixed(2)}MB)`
      );
    }

    files.forEach((file) => {
      const validation = this.validateFile(file);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validatePath(path: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const { pattern, name } of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(path)) {
        errors.push(`File path "${path}" contains ${name}`);
      }
    }

    const normalized = path.trim().replace(/\\/g, '/');
    if (normalized !== path) {
      warnings.push(`File path "${path}" was normalized to "${normalized}"`);
    }

    if (normalized.split('/').some((part) => part.startsWith('.'))) {
      warnings.push(`File path "${path}" contains hidden file or directory`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateExtension(path: string): ValidationResult {
    const errors: string[] = [];

    const lastDot = path.lastIndexOf('.');
    if (lastDot === -1) {
      // No extension - this is okay for some files like README
      return { valid: true, errors: [], warnings: [] };
    }

    const extension = path.slice(lastDot + 1).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      errors.push(
        `File extension ".${extension}" is not allowed for file "${path}"`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /**
   * Validate file content for security issues
   */
  private static validateSecurity(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const { pattern, name } of DANGEROUS_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`Dangerous code pattern detected: ${name}`);
      }
    }

    // Check for SQL injection patterns (warning only)
    for (const { pattern, name } of SQL_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(`Possible SQL injection pattern detected: ${name}`);
      }
    }

    // Check for XSS patterns (warning only)
    for (const { pattern, name } of XSS_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(`Possible XSS pattern detected: ${name}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Sanitize file path for safe usage in sandbox
   */
  static sanitizePath(path: string): string {
    return path
      .trim()
      .replace(/\\/g, '/') // Normalize backslashes
      .replace(/\.\.+/g, '.') // Remove directory traversal
      .replace(/^\/+/, '') // Remove leading slashes
      .replace(/\/+/g, '/') // Collapse multiple slashes
      .replace(/\0/g, ''); // Remove null bytes
  }
}
