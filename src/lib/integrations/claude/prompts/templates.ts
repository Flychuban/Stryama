/**
 * Prompt Templates
 *
 * Pre-built prompt templates for different types of code generation.
 * Each template includes system prompts and context-aware user prompt builders.
 */

import { PromptTemplateType } from './types';
import type { PromptTemplate } from './types';

/**
 * Base system prompt for all code generation
 */
const BASE_SYSTEM_PROMPT = `You are an expert web developer specializing in modern TypeScript applications.

Core Principles:
- Always use TypeScript with explicit types (never 'any')
- Always use 'type' instead of 'interface'
- Use enums for 3+ string literal values
- Follow functional programming patterns
- Implement proper error handling
- Include accessibility features
- Write clean, maintainable code
- Add helpful comments for complex logic

Code Standards:
- Use Next.js 15 with App Router
- Use Tailwind CSS for styling
- Use ShadCN/UI components when applicable
- Implement proper TypeScript types
- Include error boundaries
- Follow React best practices`;

/**
 * Landing page template
 */
export const LANDING_PAGE_TEMPLATE: PromptTemplate = {
  type: PromptTemplateType.LANDING_PAGE,
  systemPrompt: BASE_SYSTEM_PROMPT,
  userPromptBuilder: (context) => `
Create a modern, responsive landing page for the following description:

${context.userInput}

Requirements:
- Use Next.js 15 with App Router (create app/page.tsx)
- Use TypeScript with proper types
- Use Tailwind CSS for styling
- Include proper meta tags for SEO
- Implement responsive design (mobile-first)
- Include call-to-action sections
- Use modern design patterns

${context.framework ? `Framework: ${context.framework}` : ''}

Provide complete, production-ready code files.`,
  examples: [
    'A landing page for a SaaS product with hero section, features, pricing, and footer',
    'A portfolio landing page with projects showcase and contact form',
  ],
};

/**
 * Dashboard template
 */
export const DASHBOARD_TEMPLATE: PromptTemplate = {
  type: PromptTemplateType.DASHBOARD,
  systemPrompt: BASE_SYSTEM_PROMPT,
  userPromptBuilder: (context) => `
Create a comprehensive dashboard interface for:

${context.userInput}

Requirements:
- Use Next.js 15 with App Router
- Use TypeScript with explicit types
- Use ShadCN/UI components for UI elements
- Implement proper layout with sidebar navigation
- Include data visualization where appropriate
- Add responsive design
- Implement loading states
- Include error handling

${context.framework ? `Framework: ${context.framework}` : ''}

Provide complete, production-ready code files.`,
  examples: [
    'An analytics dashboard with charts and data tables',
    'A project management dashboard with tasks and team members',
  ],
};

/**
 * CRUD application template
 */
export const CRUD_APP_TEMPLATE: PromptTemplate = {
  type: PromptTemplateType.CRUD_APP,
  systemPrompt: BASE_SYSTEM_PROMPT,
  userPromptBuilder: (context) => `
Create a CRUD (Create, Read, Update, Delete) application for:

${context.userInput}

Requirements:
- Use Next.js 15 with App Router
- Use TypeScript with proper types
- Implement tRPC for API communication
- Use Prisma schema for data models
- Use ShadCN/UI components for forms and tables
- Include form validation with Zod
- Implement proper error handling
- Add loading and success states
- Include delete confirmations

${context.framework ? `Framework: ${context.framework}` : ''}
${context.dependencies ? `Available dependencies: ${context.dependencies.join(', ')}` : ''}

Provide complete, production-ready code files.`,
  examples: [
    'A blog post management system with create, edit, and delete',
    'A product inventory tracker with CRUD operations',
  ],
};

/**
 * Component generation template
 */
export const COMPONENT_TEMPLATE: PromptTemplate = {
  type: PromptTemplateType.COMPONENT,
  systemPrompt: BASE_SYSTEM_PROMPT,
  userPromptBuilder: (context) => `
Create a React component for:

${context.userInput}

Requirements:
- Use TypeScript with explicit prop types (use 'type', not 'interface')
- Use functional components with hooks
- Use Tailwind CSS for styling
- Implement proper accessibility
- Include JSDoc comments
- Add proper error handling
- Make it reusable and composable

${context.framework ? `Framework: ${context.framework}` : ''}

Provide the complete component code.`,
  examples: [
    'A reusable button component with variants',
    'A modal dialog component with accessibility',
  ],
};

/**
 * File modification template
 */
export const FILE_MODIFICATION_TEMPLATE: PromptTemplate = {
  type: PromptTemplateType.FILE_MODIFICATION,
  systemPrompt: BASE_SYSTEM_PROMPT,
  userPromptBuilder: (context) => `
Modify the existing code based on the following request:

${context.userInput}

Existing Files:
${context.existingFiles?.join('\n\n') ?? 'No existing files'}

Requirements:
- Maintain existing code style and patterns
- Preserve existing functionality unless explicitly asked to change
- Use TypeScript with proper types
- Keep changes minimal and focused
- Add comments explaining significant changes
- Ensure backward compatibility when possible

Provide the complete updated files.`,
  examples: [
    'Add error handling to the login function',
    'Update the user profile component to include a bio field',
  ],
};

/**
 * Custom template (fallback)
 */
export const CUSTOM_TEMPLATE: PromptTemplate = {
  type: PromptTemplateType.CUSTOM,
  systemPrompt: BASE_SYSTEM_PROMPT,
  userPromptBuilder: (context) => context.userInput,
  examples: [],
};

export const PROMPT_TEMPLATES: Record<PromptTemplateType, PromptTemplate> = {
  [PromptTemplateType.LANDING_PAGE]: LANDING_PAGE_TEMPLATE,
  [PromptTemplateType.DASHBOARD]: DASHBOARD_TEMPLATE,
  [PromptTemplateType.CRUD_APP]: CRUD_APP_TEMPLATE,
  [PromptTemplateType.COMPONENT]: COMPONENT_TEMPLATE,
  [PromptTemplateType.FILE_MODIFICATION]: FILE_MODIFICATION_TEMPLATE,
  [PromptTemplateType.CUSTOM]: CUSTOM_TEMPLATE,
};
