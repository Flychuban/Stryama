import { ProgrammingLanguage } from './types';
import type { GeneratedFile } from './types';

export type ParsedCodeBlock = {
  readonly language: string;
  readonly content: string;
  readonly detectedPath?: string;
};

/**
 * Dangerous patterns that should be blocked or warned about
 */
const DANGEROUS_PATTERNS = [
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /__proto__/gi,
  /constructor\s*\[\s*['"]prototype['"]\s*\]/gi,
];

/**
 * SQL injection patterns to warn about
 */
const SQL_INJECTION_PATTERNS = [
  /'\s*OR\s*'1'\s*=\s*'1/gi,
  /;\s*DROP\s+TABLE/gi,
  /UNION\s+SELECT/gi,
  /--\s*$/gm,
];

export class CodeParser {
  static extractCodeBlocks(text: string): ParsedCodeBlock[] {
    const codeBlockRegex = /```(\w+)\n([\s\S]*?)```/g;
    const blocks: ParsedCodeBlock[] = [];

    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const language = match[1] ?? 'text';
      const content = match[2] ?? '';

      const detectedPath = this.extractFilePathFromContext(text, match.index);

      blocks.push({
        language,
        content: content.trim(),
        detectedPath,
      });
    }

    return blocks;
  }

  private static extractFilePathFromContext(
    text: string,
    blockIndex: number
  ): string | undefined {
    const contextStart = Math.max(0, blockIndex - 500);
    const context = text.slice(contextStart, blockIndex);

    const patterns = [
      /(?:\/\/|#)\s*File:\s*([^\n]+)/i,
      /File:\s*([^\n]+)/i,
      /Create\s+file:\s*([^\n]+)/i,
      /(?:\/\/|#)\s*Path:\s*([^\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = context.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  static detectFilePath(block: ParsedCodeBlock, index: number): string {
    if (block.detectedPath) {
      let path = block.detectedPath.trim();
      path = path.replace(/^['"`](.*)['"`]$/, '$1');
      return path;
    }

    const lang = block.language.toLowerCase();

    if (lang === 'typescript' || lang === 'tsx') {
      if (
        block.content.includes('export default') ||
        block.content.includes('export function')
      ) {
        return index === 0
          ? 'src/app/page.tsx'
          : `src/components/Component${index}.tsx`;
      }
      return `src/lib/utils${index}.ts`;
    }

    if (lang === 'javascript' || lang === 'jsx') {
      return index === 0
        ? 'src/app/page.jsx'
        : `src/components/Component${index}.jsx`;
    }

    if (lang === 'css') {
      return index === 0
        ? 'src/styles/globals.css'
        : `src/styles/styles${index}.css`;
    }

    if (lang === 'html') {
      return 'index.html';
    }

    if (lang === 'json') {
      return 'config.json';
    }

    if (lang === 'markdown' || lang === 'md') {
      return 'README.md';
    }

    // Default
    return `file${index}.${lang}`;
  }

  static mapLanguage(lang: string): ProgrammingLanguage {
    const normalized = lang.toLowerCase().trim();

    switch (normalized) {
      case 'typescript':
      case 'ts':
      case 'tsx':
        return ProgrammingLanguage.TYPESCRIPT;

      case 'javascript':
      case 'js':
      case 'jsx':
        return ProgrammingLanguage.JAVASCRIPT;

      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return ProgrammingLanguage.CSS;

      case 'html':
      case 'htm':
        return ProgrammingLanguage.HTML;

      case 'json':
      case 'jsonc':
        return ProgrammingLanguage.JSON;

      case 'markdown':
      case 'md':
        return ProgrammingLanguage.MARKDOWN;

      default:
        // Default to TypeScript for unknown code languages
        return ProgrammingLanguage.TYPESCRIPT;
    }
  }

  static validateSecurity(content: string): {
    readonly safe: boolean;
    readonly warnings: readonly string[];
  } {
    const warnings: string[] = [];

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(
          `Potentially dangerous code pattern detected: ${pattern.source}`
        );
      }
    }

    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        warnings.push(
          `Possible SQL injection pattern detected: ${pattern.source}`
        );
      }
    }

    const hasCriticalIssue = /eval\s*\(|Function\s*\(/gi.test(content);

    return {
      safe: !hasCriticalIssue,
      warnings,
    };
  }

  static parseClaudeResponse(responseText: string): GeneratedFile[] {
    const blocks = this.extractCodeBlocks(responseText);

    if (blocks.length === 0) {
      return [];
    }

    const files: GeneratedFile[] = [];

    blocks.forEach((block, index) => {
      const validation = this.validateSecurity(block.content);

      if (!validation.safe) {
        console.warn(
          `[Parser] Skipping potentially dangerous code block at index ${index}`
        );
        return; // Skip this block
      }

      if (validation.warnings.length > 0) {
        console.warn(
          `[Parser] Security warnings for block ${index}:`,
          validation.warnings
        );
      }

      const path = this.detectFilePath(block, index);
      const language = this.mapLanguage(block.language);

      files.push({
        path,
        content: block.content,
        language,
      });
    });

    return files;
  }
}
