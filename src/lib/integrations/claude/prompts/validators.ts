import { z } from 'zod';
import type { PromptValidationResult } from './types';

const promptSchema = z.object({
  content: z
    .string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(2000, 'Prompt must not exceed 2000 characters'),
  framework: z.string().optional(),
});

const BLOCKED_KEYWORDS = [
  'hack',
  'exploit',
  'malware',
  'virus',
  'crack',
  'pirate',
  'steal',
] as const;

export function validatePrompt(prompt: string): PromptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const schemaResult = promptSchema.safeParse({ content: prompt });
  if (!schemaResult.success) {
    errors.push(...schemaResult.error.errors.map((e) => e.message));
  }

  const lowerPrompt = prompt.toLowerCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    if (lowerPrompt.includes(keyword)) {
      errors.push(`Prompt contains inappropriate keyword: ${keyword}`);
    }
  }

  if (prompt.split(' ').length < 5) {
    warnings.push(
      'Prompt might be too vague. Consider adding more details for better results.'
    );
  }

  const hasActionWord =
    lowerPrompt.includes('create') ||
    lowerPrompt.includes('build') ||
    lowerPrompt.includes('make') ||
    lowerPrompt.includes('generate') ||
    lowerPrompt.includes('develop');

  if (!hasActionWord) {
    warnings.push(
      'Consider using action words like "create", "build", or "make" for clearer instructions.'
    );
  }

  if (prompt.length > 3000) {
    warnings.push(
      'Prompt is very long. Consider breaking it into smaller, focused requests.'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function sanitizePrompt(prompt: string): string {
  let sanitized = prompt.replace(/\s+/g, ' ').trim();

  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');

  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
}

export function validateAndSanitizePrompt(prompt: string): {
  readonly sanitized: string;
  readonly validation: PromptValidationResult;
} {
  const sanitized = sanitizePrompt(prompt);
  const validation = validatePrompt(sanitized);

  return {
    sanitized,
    validation,
  };
}
