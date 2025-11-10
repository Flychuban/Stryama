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

Tech Stack (Mandatory):
- React 18+ with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- ShadCN UI for components (copy components as needed with npx shadcn@latest add <component>)

Core Principles:
- Always use TypeScript with explicit types (never 'any')
- Always use 'type' instead of 'interface'
- Use enums for 3+ string literal values
- Follow functional programming patterns
- Implement proper error handling
- Include accessibility features
- Write clean, maintainable code
- Add helpful comments for complex logic

Recommended Libraries (use judgment based on needs):
- Routing: React Router (for multi-page apps)
- State Management: React hooks → Context → Zustand (escalate only if needed)
- Data Fetching: fetch API → TanStack Query (for complex cases)
- Forms: React Hook Form + Zod validation
- Icons: Lucide React

Component Guidelines:
- Use ShadCN UI components for common UI elements (buttons, inputs, dialogs, etc.)
- Components are installed with: npx shadcn@latest add <component>
- Components live in src/components/ui/
- Customize via Tailwind classes, not CSS files
- Build custom components only when ShadCN doesn't have what you need

Best Practices:
- Start simple, add complexity only when needed
- Prefer built-in solutions over external libraries
- Ensure working functionality over feature completeness
- Follow React best practices (hooks, composition, etc.)`;

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
- Create src/App.tsx as the main component
- Use TypeScript with proper types
- Use Tailwind CSS for styling
- Use ShadCN UI components (Button, Card, etc.)
- Include proper meta tags for SEO (update index.html)
- Implement responsive design (mobile-first)
- Include call-to-action sections
- Use modern design patterns

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
- Use React Router for routing if needed
- Use TypeScript with explicit types
- Use ShadCN UI components for all UI elements (Sheet, Card, Table, etc.)
- Implement proper layout with sidebar navigation
- Include data visualization where appropriate (consider Recharts)
- Add responsive design (collapsible sidebar on mobile)
- Implement loading states
- Include error handling

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
- Use React with TypeScript
- Use local state (useState) or Zustand if complex state needed
- Use ShadCN UI components for forms, tables, and dialogs
- Include form validation with Zod + React Hook Form
- Implement proper error handling
- Add loading and success states
- Include delete confirmations (using AlertDialog)
- Use optimistic updates for better UX

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
- Use ShadCN UI components as building blocks when appropriate
- Implement proper accessibility (ARIA labels, keyboard navigation)
- Include JSDoc comments for props
- Add proper error handling
- Make it reusable and composable

Provide the complete component code.`,
  examples: [
    'A reusable search input component with debouncing',
    'A custom file upload component with drag-and-drop',
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
