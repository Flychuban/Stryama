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
- ShadCN UI for components (pre-configured with all common packages)

Core Principles:
- Use TypeScript with explicit types (avoid 'any')
- Use 'type' instead of 'interface'
- Follow functional programming patterns
- Implement proper error handling and accessibility
- Write clean, maintainable code

CRITICAL: Avoid AI-Generated "Tells":
- ❌ NO purple/indigo color defaults (indigo-500, purple-500, violet-*) - analyze context for appropriate brand colors
- ❌ NO emojis in production UI (unless brand is explicitly casual/playful)
- ❌ NO generic copy: "Transform your business", "Revolutionize", "Next-generation", "Unlock potential"
- ❌ NO fake testimonials or generic "Get Started" CTAs
- ❌ NO cookie-cutter layouts (hero + 3-box grid + testimonials)
- ❌ NO massive icons or random hover effects
- ❌ NO inconsistent spacing, shadows, or border radius

Context-Aware Design:
- Analyze user's description to choose appropriate colors:
  * Business/SaaS → blues (sky, cyan), grays (slate, zinc), greens (emerald, teal)
  * Creative → warm colors (orange, rose) or unique palettes
  * Technical → slate + emerald/cyan/amber
  * E-commerce → blue (trust) + orange/red (CTAs)
- Define 3-color system: Primary (brand), Accent (CTAs), Neutral (text/backgrounds)
- Pick ONE border radius (rounded-lg or rounded-xl) and use everywhere
- Define 2-3 shadow levels (shadow-sm, shadow-md) and use consistently
- Choose fonts based on brand personality (not default Inter/Poppins)
- Use Tailwind spacing scale consistently: py-12/py-24 sections, p-6/p-8 cards, gap-4/gap-6/gap-8

Functional Requirements (All Must Work):
- All buttons MUST have onClick handlers or type="submit"
- All forms MUST have onSubmit with preventDefault()
- Implement THREE states for async operations:
  1. Loading (skeleton UI or spinner)
  2. Error (user-friendly message + retry button)
  3. Empty ("No items yet" + helpful CTA)
- Use controlled components (value + onChange)
- Validate inputs with specific error messages
- Add disabled states during processing
- Support keyboard navigation (Tab, Enter, Escape)
- Use semantic HTML and aria-labels
- Lazy load images

Content Guidelines:
- Write SPECIFIC copy reflecting actual use case (not generic buzzwords)
- Make CTAs action-specific: "Create Project" not "Get Started"
- Use concrete language: "Deploy in 5 minutes" not "fast and easy"
- Skip testimonials unless specifically requested
- NO emojis in headings, buttons, navigation
- Headlines: 4-8 words, Subheadlines: 10-15 words

Libraries:
- Routing: React Router (for multi-page apps)
- State: React hooks → Context → Zustand (escalate only if needed)
- Forms: React Hook Form + Zod (for complex validation)
- Icons: Lucide React

ShadCN UI Components:
- All packages pre-installed (Dialog, Dropdown, Select, Tabs, Card, Button, etc.)
- components.json configured with proper aliases (@/components, @/lib/utils)
- src/lib/utils.ts with cn() utility function ready to use
- Create components in src/components/ui/ directory
- Use Radix UI primitives with cn() for className merging
- Follow Shadcn patterns: CVA for variants, forwardRef, proper TypeScript types
- ALWAYS use cn() utility for all className props in Shadcn components

Error Handling & Self-Verification:
- ALWAYS run build check (npm run build) BEFORE starting dev server
- Build must succeed with zero errors before showing preview
- Check build output for specific error patterns (Tailwind, imports, types)
- If build fails: fix issue, rebuild, verify (ONE retry only)
- Common fixes:
  * Tailwind errors → Only use defined classes (bg-primary, not bg-[#xxx])
  * Import errors → Verify file paths, add missing imports
  * Type errors → Fix TypeScript types, add proper interfaces
- Only return preview URL after successful build

Best Practices:
- Use ShadCN UI components for common elements
- Start simple, add complexity only when needed
- Ensure working functionality over feature completeness
- Verify app compiles before showing to user`;

/**
 * Landing page template
 */
export const LANDING_PAGE_TEMPLATE: PromptTemplate = {
  type: PromptTemplateType.LANDING_PAGE,
  systemPrompt: BASE_SYSTEM_PROMPT,
  userPromptBuilder: (context) => `
Create a modern, responsive landing page for: ${context.userInput}

Structure: src/App.tsx (main), src/App.css, index.html with proper meta tags

Design:
- Analyze description for brand-appropriate colors (AVOID purple/indigo unless contextually appropriate)
- Pick fonts matching brand personality (professional/creative/technical)
- Use consistent spacing: py-12/py-24 sections, p-6 cards, gap-4/gap-6 elements, max-w-7xl containers
- ONE border radius system, 2 shadow levels

Content:
- Write SPECIFIC copy (NO "Transform your business" buzzwords)
- CTAs: action-specific ("Create Project", "Download for Mac") not generic ("Get Started")
- 3-5 concrete features: "Deploy in 5 minutes", "Supports 15+ languages"
- SKIP testimonials unless requested, NO emojis

Layout (create UNIQUE structure, avoid cookie-cutter):
- Header: logo, navigation (3-5 items), CTA, hamburger menu (mobile)
- Hero: specific headline (4-8 words), subheadline (10-15 words), CTA, optional visual
- 2-4 sections: vary layouts (alternating, feature showcases, steps), use visual variety
- Footer: links, social, copyright

Functionality:
- All buttons/forms/navigation MUST work (onClick, onSubmit with preventDefault)
- Smooth scroll, mobile menu state, keyboard nav
- Loading/error states if async operations
- Responsive: mobile (<640px), tablet (640-1024px), desktop (>1024px)

SEO: Update index.html <title> and meta description (155 chars, specific)

Provide complete, production-ready code that compiles without errors.`,
  examples: [
    'Developer tool landing page for React debugging with real-time state tracking',
    'Coffee roaster e-commerce site with online ordering and subscriptions',
    'Freelance designer portfolio showcasing web and brand design projects',
  ],
};

/**
 * Dashboard template
 */
export const DASHBOARD_TEMPLATE: PromptTemplate = {
  type: PromptTemplateType.DASHBOARD,
  systemPrompt: BASE_SYSTEM_PROMPT,
  userPromptBuilder: (context) => `
Create a comprehensive dashboard interface for: ${context.userInput}

Structure: Use React Router if multi-page, ShadCN UI (Sheet, Card, Table, Button, Input, Select, Badge), install Recharts if charts needed

Layout:
- Sidebar: 240px desktop (fixed), Sheet component mobile, logo + 3-7 nav items with icons + active states
- Header: breadcrumbs, user menu, search (if appropriate), hamburger button (mobile)
- Main: max-w-7xl container, responsive grids, h1 page heading

Colors:
- Dashboard-appropriate: slate/gray neutral, blue/emerald/cyan primary (AVOID purple/indigo)
- Backgrounds: sidebar bg-white/gray-50, main bg-gray-50, cards bg-white shadow-sm
- Status: green (success), amber (warning), red (error), blue (info)

Data Visualization:
- Charts: Use Recharts with consistent colors, responsive, proper chart types
- Tables: ShadCN Table with sortable headers, search/filter, pagination, row actions (Edit/Delete/View)
- Empty states: icon + "No data yet" + CTA
- Loading states: skeleton UI (not just spinners), maintain layout shape

State Management (THREE states for ALL data):
1. Loading: skeleton UI, const [loading, setLoading] = useState(true)
2. Error: message + retry button, const [error, setError] = useState<string | null>(null)
3. Empty: "No items" + helpful CTA, const [data, setData] = useState<Item[]>([])
- Use realistic mock data (5-15 items), simulate async with setTimeout (1-2s)

Functionality:
- All navigation/buttons/forms MUST work (onClick, onSubmit, onChange)
- Active states, mobile sidebar closes after nav
- Working filters/search (client-side filtering OK)
- Table actions: edit modal, delete confirmation dialog
- Forms: validation, inline errors, disabled states, success feedback
- Keyboard nav, modals close on Escape
- Mobile: stack vertically, hamburger menu, touch-friendly sizes (h-10+), card layout for tables if too wide

Provide complete, production-ready code that compiles without errors.`,
  examples: [
    'Analytics dashboard monitoring API usage, response times, error rates',
    'Blog CMS dashboard with posts, categories, authors, publishing workflow',
    'Support dashboard with tickets, response times, agent performance, satisfaction',
  ],
};

/**
 * CRUD application template
 */
export const CRUD_APP_TEMPLATE: PromptTemplate = {
  type: PromptTemplateType.CRUD_APP,
  systemPrompt: BASE_SYSTEM_PROMPT,
  userPromptBuilder: (context) => `
Create a CRUD (Create, Read, Update, Delete) application for: ${context.userInput}

Structure: React + TypeScript, useState for state, ShadCN UI (Table, Dialog, AlertDialog, Button, Input, Label), install React Hook Form + Zod if complex validation needed

Data Structure: Define TypeScript type with id (string, use crypto.randomUUID()), relevant fields (string/number/boolean/Date), createdAt/updatedAt

State:
- items: useState<Item[]>(mockData)
- isLoading, error, editingItem, showCreateDialog, showDeleteDialog, itemToDelete, searchQuery

List View (Table):
- ShadCN Table: 5-7 important columns, actions column (Edit/Delete buttons)
- Sortable headers, search input, row count display
- Empty state: icon + "No [items] yet" + "Create First [Item]" button
- Actions: Edit (setEditingItem + open dialog), Delete (setItemToDelete + open AlertDialog)

Create/Edit Form (Dialog):
- Single dialog for both create and edit (pre-fill when editing)
- Proper input types: Input, Textarea, Select, date picker
- Validation: check required, show specific inline errors ("Email is required")
- Submission: disable button, show "Saving...", close on success, show success toast
- Cancel/Save buttons

Delete Confirmation (AlertDialog):
- Display: "Delete '[item.name]'?" + "This action cannot be undone."
- Cancel/Delete (destructive) buttons
- After: remove from state, show success, close dialog

CRUD Operations (Mock):
- CREATE: { id: crypto.randomUUID(), ...formData, createdAt: new Date() }
- UPDATE: items.map(item => item.id === editingItem.id ? { ...item, ...formData, updatedAt: new Date() } : item)
- DELETE: items.filter(item => item.id !== itemToDelete.id)

Functionality:
- All buttons/forms MUST work (onClick, onSubmit with preventDefault)
- Wrap operations in try-catch, user-friendly errors
- Optimistic updates, success toasts
- Keyboard shortcuts: Escape closes dialogs, Enter submits
- Mobile: stack fields, full-width dialogs, touch-friendly sizes (h-10+)

Mock Data: 3-5 realistic items with varied data

${context.dependencies ? `Dependencies: ${context.dependencies.join(', ')}` : ''}

Provide complete, production-ready code that compiles without errors.`,
  examples: [
    'Book collection manager: title, author, year, genre, rating',
    'Expense tracker: category, amount, date, description, payment method',
    'Recipe organizer: name, ingredients, instructions, prep time, difficulty',
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
