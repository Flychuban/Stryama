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
- Always use TypeScript with explicit types (avoid 'any' unless absolutely necessary)
- Always use 'type' instead of 'interface'
- Use enums for 3+ string literal values
- Follow functional programming patterns
- Implement proper error handling
- Include accessibility features
- Write clean, maintainable code
- Add helpful comments for complex logic

Design Guidelines (Avoid Unless Context-Appropriate):
- Avoid defaulting to purple/indigo colors (indigo-500, purple-500, violet-*) - analyze user's context for appropriate brand colors
- Minimize emoji usage in production UI - reserve for casual/playful brands only
- Choose fonts based on brand personality rather than defaulting to Inter/Poppins
- Create specific, context-relevant copy instead of generic "Transform your business" language
- Skip testimonials unless specifically requested (they often look AI-generated)
- Keep icons appropriately sized (max 24px for UI elements, 48px for hero sections)
- Apply hover effects only to interactive elements
- Design unique layouts based on content rather than cookie-cutter patterns
- Maintain consistent border radius throughout (pick one system)
- Use shadows purposefully with 2-3 defined elevation levels
- Write concrete, specific copy that reflects the actual use case

Design System Principles:

Color System (Context-Aware):
- Analyze the user's description to determine appropriate brand colors:
  * Business/SaaS: blues (sky, cyan), grays (slate, zinc), greens (emerald, teal)
  * Creative/artistic: warm colors (orange, rose) or unique palettes
  * Technical/dev tools: slate + emerald/cyan/amber accents
  * E-commerce: trust colors (blue) + conversion (orange/red CTAs)
- Define a 3-color system: Primary (brand color), Accent (CTAs/highlights), Neutral (text/backgrounds)
- Use CSS variables OR Tailwind utilities consistently throughout
- Example CSS variable approach:
  :root {
    --primary: 220 70% 50%;    /* Appropriate brand color */
    --accent: 142 71% 45%;     /* CTA color */
    --neutral: 215 16% 47%;    /* Text/backgrounds */
  }

Typography System:
- Choose fonts based on brand personality:
  * Professional/Corporate: system fonts, Inter, Roboto, Open Sans
  * Creative/Artistic: Playfair Display, Merriweather, Lora
  * Technical/Modern: JetBrains Mono, Fira Code, Source Code Pro
  * Minimal/Clean: system fonts work great!
- Establish clear hierarchy:
  * h1: text-4xl (2.5rem) font-bold leading-tight
  * h2: text-3xl (2rem) font-semibold leading-snug
  * h3: text-2xl (1.5rem) font-medium leading-normal
  * body: text-base (1rem) font-normal leading-relaxed
  * small: text-sm (0.875rem)
- Use consistent font weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)
- Limit to 2 font families maximum (headings + body, or just one)
- Line-height: 1.2 for headings, 1.6-1.8 for body text

Spacing System:
- Use Tailwind's 4px-based scale consistently
- Define semantic spacing:
  * Tight: gap-2 (8px) - icon-text pairs
  * Normal: gap-4 (16px) - form fields, card content
  * Relaxed: gap-6 (24px) - section elements
  * Loose: gap-8 (32px) - distinct sections
- Section spacing: py-12 (48px mobile) / py-24 (96px desktop) for vertical padding
- Card padding: p-6 (24px) standard, p-8 (32px) for large cards
- Container max-width: max-w-7xl (1280px) for content areas

Component Consistency:
- Pick ONE border radius system and use everywhere:
  * Modern: rounded-lg (8px) for cards, rounded-md (6px) for inputs
  * Friendly: rounded-xl (12px) for cards, rounded-lg (8px) for inputs
  * Sharp: rounded (4px) minimal, or rounded-none for brutalist
- Define 2-3 shadow levels:
  * Subtle: shadow-sm - flat cards, subtle elevation
  * Medium: shadow-md - modals, dropdowns, elevated cards
  * Large: shadow-lg - only for major overlays
- Button sizing consistency:
  * Small: h-8 px-3 text-sm
  * Medium: h-10 px-4 text-base (default)
  * Large: h-12 px-6 text-lg
- Input heights must match button heights
- Maintain consistent border colors (border-gray-300 or similar)

Functional Requirements:

TypeScript & Type Safety:
- Use explicit types for all props, state, and function parameters
- Define 'type' for object types (not 'interface')
- Create enum types for sets of related constants (3+ values)
- Example:
  type UserProfile = {
    name: string;
    email: string;
    role: 'admin' | 'user' | 'guest';
  };

Error Handling:
- Wrap ALL async operations in try-catch blocks
- Display user-friendly error messages (never expose stack traces or technical errors)
- Example: "Unable to load data. Please try again." not "Error: fetch failed at line 42"
- Provide actionable recovery: "Retry" buttons, "Go back" links
- Add error boundaries for React components where appropriate
- Validate all user inputs before processing

State Management & Loading:
- Implement loading/error/empty states for ALL async operations:
  * Loading: Show skeleton UI or spinner with "Loading..." text
  * Error: Show error message with retry button
  * Empty: Show "No items yet" with helpful CTA
- Use proper TypeScript types for all state (useState<Type>)
- Avoid infinite render loops (check useEffect dependency arrays)
- Example pattern:
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

Interactive Elements (All Must Work):
- All buttons must have onClick handlers or be type="submit" in forms
- All forms must have onSubmit handlers with preventDefault()
- All links must have valid href (use "#" for placeholder, better: use actual routes)
- Add disabled states during loading/processing
- Implement keyboard navigation (Tab, Enter, Escape key handlers)
- Example:
  <button
    onClick={handleSubmit}
    disabled={isLoading}
    className="..."
  >
    {isLoading ? 'Saving...' : 'Save'}
  </button>

Forms & Validation:
- Use controlled components (value + onChange)
- Validate inputs before submission
- Show inline error messages below fields
- Disable submit during processing
- Clear form or show success after submission
- Use proper input types: email, password, number, date
- Example:
  <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    className={errors.email ? 'border-red-500' : 'border-gray-300'}
  />
  {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}

Accessibility (WCAG AA Standards):
- Use semantic HTML: <header>, <nav>, <main>, <footer>, <article>, <section>
- Add aria-label to icon-only buttons: <button aria-label="Close">×</button>
- Ensure color contrast ratios: 4.5:1 for normal text, 3:1 for large text
- Add descriptive alt text to images (not "image" or "photo")
- Support keyboard navigation for all interactive elements
- Use proper heading hierarchy (one h1, logical h2/h3 structure)

Performance:
- Lazy load images: <img loading="lazy" />
- Use Tailwind classes (avoid inline styles)
- Use React.memo for expensive components
- Provide proper key props in lists (unique IDs, not array indices)
- Minimize unnecessary re-renders

Content & Copywriting Standards:

General Principles:
- Write specific copy that reflects the user's actual use case
- Avoid generic business jargon and buzzwords
- Use clear, action-oriented language
- Be conversational but professional
- Match tone to brand personality

Avoid Generic Phrases:
- "Transform your business" / "Revolutionize your workflow"
- "Take your [X] to the next level"
- "Cutting-edge" / "Next-generation"
- "Unlock your potential" / "Empower your team"
- "Seamless experience" / "Game-changing"
- Instead: Be specific about actual features and benefits

Headlines & CTAs:
- Make headlines specific to the actual product/service (4-8 words)
- Subheadlines explain the benefit (10-15 words)
- CTAs describe actual action: "Create Your First Project", "Download for Mac", "View Pricing"
- Avoid: "Get Started", "Learn More", "Click Here" (too generic)

Feature Descriptions:
- List concrete, specific benefits (not vague claims)
- Use numbers when possible: "Deploy in 5 minutes" vs "simple setup"
- Focus on outcomes: "Save 10 hours/week" vs "efficient tool"

Placeholder Content:
- Use context-appropriate names based on user's description
- Skip testimonials unless specifically requested
- Use realistic, modest numbers for statistics
- Write realistic content for blog posts/features

Emoji Usage:
- DEFAULT: No emojis in production UI
- Only use if brand is explicitly casual/playful OR user specifically requests
- Never in: headings, buttons, CTAs, navigation, professional UIs, error messages
- Acceptable sparingly in: marketing pages (1-2 max) if brand-appropriate

Text Length Guidelines:
- Headlines: 4-8 words maximum
- Subheadlines: 10-15 words
- Body paragraphs: 2-3 sentences (40-60 words)
- Button text: 1-3 words
- Feature descriptions: 1 sentence (15-20 words)

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

FILE STRUCTURE:
- Create src/App.tsx as the main component
- Create src/App.css or src/index.css for custom styles if needed
- Update index.html with proper meta tags
- Use TypeScript with proper types (avoid 'any')
- Use Tailwind CSS for styling
- Use ShadCN UI components where appropriate (Button, Card, etc.)

DESIGN REQUIREMENTS:

Color & Branding:
- Analyze the description to determine appropriate brand colors
  * Business/SaaS → blues (sky, cyan), grays (slate), greens (emerald, teal)
  * Creative/artistic → warm colors (orange, rose) or unique palettes
  * Technical/dev tools → slate + emerald/cyan/amber accents
  * E-commerce → trust colors (blue) + conversion (orange/red CTAs)
  * AVOID purple/indigo unless specifically appropriate for this use case
- Define colors as CSS variables OR use Tailwind utilities consistently
- Use a clear 3-color system: Primary (brand), Accent (CTAs), Neutral (text/backgrounds)

Typography & Spacing:
- Choose fonts that match brand personality:
  * Professional: system fonts, Inter, Roboto
  * Creative: Playfair Display, Merriweather
  * Technical: JetBrains Mono, Source Code Pro
  * Simple/minimal: system fonts work perfectly!
- Establish clear hierarchy (h1: text-4xl bold, h2: text-3xl semibold, h3: text-2xl medium)
- Use consistent spacing:
  * Sections: py-12 (mobile) / py-24 (desktop)
  * Cards: p-6 or p-8 padding
  * Gaps: gap-4, gap-6, or gap-8 for elements
  * Content containers: max-w-7xl
- Pick ONE border radius (rounded-lg or rounded-xl) and use consistently
- Define 2 shadow levels: shadow-sm for cards, shadow-md for elevated elements

CONTENT REQUIREMENTS:

Headlines & Copy:
- Write specific copy based on the actual description
  * NO generic "Transform your business" or buzzword language
  * Use concrete, specific language about the actual product/service
  * Make the value proposition clear and specific
- Headlines: 4-8 words, specific to the product
- Subheadlines: 10-15 words explaining the benefit
- Example: "Debug React Apps Faster" (headline) + "Visualize component trees and track state changes in real-time" (subheadline)

Call-to-Action (CTA):
- Make CTAs action-specific, not generic:
  * Good: "Start Building", "Download for Mac", "View Pricing", "Create Account"
  * Avoid: "Get Started", "Learn More", "Click Here"
- Primary CTA should be prominently displayed in hero section
- Secondary CTAs can appear in other sections

Features & Benefits:
- List 3-5 concrete, specific features/benefits
  * Good: "Deploy in 5 minutes", "Supports 15+ languages", "Export to CSV/JSON/PDF"
  * Avoid: "Easy to use", "Powerful features", "Flexible workflow"
- Use numbers when possible to add specificity
- Focus on outcomes: "Save 10 hours/week" not just "efficient"

Testimonials & Social Proof:
- SKIP testimonials unless specifically requested (they often look AI-generated)
- If statistics are needed, use realistic, modest numbers
- Use context-appropriate company/user names (not "Acme Corp" or "John D.")

Emoji Policy:
- DEFAULT: No emojis in UI elements
- Only use emojis if the brand is explicitly casual/playful
- Never in: headings, navigation, CTAs, or professional contexts

LAYOUT STRUCTURE:

Create a UNIQUE layout based on the content (avoid cookie-cutter patterns):

Header (Sticky):
- Logo or brand name
- Navigation links (3-5 items relevant to content)
- Primary CTA button
- Mobile: Hamburger menu (collapsible navigation)

Hero Section:
- Compelling headline (specific to product)
- Subheadline explaining benefit
- Primary CTA button
- Optional: Visual element (illustration, screenshot, or image with alt text)
- Consider varying the layout: centered, left-aligned with right visual, etc.

2-4 Main Sections:
- Vary the layout between sections (don't use only 3-column grids)
- Consider: alternating layouts, feature showcases, how-it-works steps, use cases
- Each section should have visual variety (different backgrounds, spacing, alignment)
- Use max-w-7xl containers with proper padding

Optional Sections (based on description):
- Social proof / trust indicators (if appropriate)
- Pricing preview (if mentioned)
- FAQ section (if complex product)
- Final CTA section before footer

Footer:
- Navigation links or sitemap
- Social media links (if applicable)
- Copyright notice
- Keep it simple and professional

FUNCTIONAL REQUIREMENTS:

Interactive Elements:
- All navigation links must work (use # for placeholders or implement smooth scroll)
- All buttons must have onClick handlers or href links
- Implement smooth scroll for anchor links:
  * Add onClick handlers that use scrollIntoView
  * Or use <a href="#section-id"> with corresponding id attributes
- Mobile menu must open/close properly (use state)

Forms (if included):
- Use controlled components (value + onChange)
- Add proper validation with error messages
- Show loading state during submission
- Display success message after submission
- Use proper input types (email, tel, text)

Responsive Design:
- Mobile-first approach with proper breakpoints:
  * Mobile: <640px (stack vertically, full-width elements)
  * Tablet: 640-1024px (2-column layouts where appropriate)
  * Desktop: >1024px (multi-column layouts, full design)
- Navigation: hamburger menu on mobile, full menu on desktop
- Touch-friendly button sizes on mobile (min h-10 or 44px)
- Test that all sections work well on all screen sizes

Loading & Error States:
- If any async operations (forms, data fetching): implement loading/error/empty states
- Show loading spinner or skeleton UI while processing
- Display user-friendly error messages with retry options

Keyboard Navigation:
- All interactive elements accessible via Tab key
- Support Enter key for buttons and links
- Escape key closes mobile menu if open

SEO & META TAGS:

Update index.html with:
- Relevant <title> tag (not "Vite App")
  * Example: "DevDebugger - Debug React Apps Faster"
- Meta description (155 characters max, specific to product)
  * Example: "Visualize React component trees, track state changes, and identify performance bottlenecks in real-time. Debug faster with DevDebugger."
- Viewport meta tag (should already exist in Vite template)
- Optional: Open Graph tags for social sharing
  * <meta property="og:title" content="..." />
  * <meta property="og:description" content="..." />

Semantic HTML:
- Use proper semantic structure:
  * <header> for header section
  * <nav> for navigation
  * <main> for main content
  * <section> for distinct sections with headings
  * <footer> for footer
- Proper heading hierarchy:
  * One <h1> (usually in hero)
  * Logical <h2> for section headings
  * <h3> for subsections

Accessibility:
- All images must have descriptive alt text (not "image" or "photo")
- Icon-only buttons must have aria-label attributes
- Color contrast must meet WCAG AA standards (4.5:1 for text)
- Support keyboard navigation throughout

Provide complete, production-ready code files that compile without errors.`,
  examples: [
    'A landing page for a developer tool that helps debug React applications with real-time state tracking',
    'A landing page for a boutique coffee roaster offering online ordering and subscription boxes',
    'A landing page for a freelance designer portfolio showcasing web and brand design projects',
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

FILE STRUCTURE:
- Use React Router for routing if multi-page dashboard (install if needed)
- Use TypeScript with explicit types (avoid 'any')
- Use ShadCN UI components: Sheet, Card, Table, Button, Input, Select, Badge, etc.
- Create proper component structure:
  * Layout component (sidebar + main content)
  * Sidebar component
  * Header component
  * Page components for different views
- Install Recharts if charts/graphs are needed

LAYOUT & STRUCTURE:

Sidebar Navigation:
- Desktop: Fixed sidebar, 240px width, positioned on left
- Mobile: Slide-over drawer using Sheet component (opens from left)
- Include in sidebar:
  * Logo or app name at top
  * Navigation links with icons (use Lucide React)
  * Active state highlighting for current page
  * User menu or settings at bottom
- Navigation items should be 3-7 relevant sections based on use case

Header Bar:
- Breadcrumbs showing current location in navigation hierarchy
- User menu / profile dropdown (upper right)
- Search input if appropriate for use case
- Mobile: Hamburger menu button to toggle sidebar (upper left)

Main Content Area:
- Use max-w-7xl centered container with proper padding (px-4 lg:px-8)
- Responsive grid layouts for content (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Proper spacing between sections (gap-6 or gap-8)
- Page heading (h1) at top of content area

COLOR & STYLING:

Dashboard Color Scheme:
- Choose dashboard-appropriate colors:
  * Recommended: slate/gray for neutral, blue/emerald/cyan for primary
  * AVOID purple/indigo unless specifically brand-appropriate
- Use subtle backgrounds for visual separation:
  * Sidebar: bg-white or bg-gray-50
  * Main content: bg-gray-50 or bg-slate-50
  * Cards: bg-white with shadow-sm
- Define status colors consistently:
  * Success: green-500 or emerald-500
  * Warning: amber-500 or yellow-500
  * Error: red-500 or rose-500
  * Info: blue-500 or sky-500
- Consistent card elevation: shadow-sm for all cards
- Border radius: rounded-lg (8px) for all cards, inputs, and buttons
- Sidebar styling: slightly darker or lighter background than main content

DATA VISUALIZATION:

If Charts/Graphs Needed:
- Install and use Recharts library
- Use consistent color palette across all charts (match brand colors)
- Add tooltips for data points (Recharts includes this)
- Make charts responsive (use ResponsiveContainer)
- Choose appropriate chart types:
  * Line charts for trends over time
  * Bar charts for comparisons
  * Pie/Donut charts for proportions
  * Area charts for cumulative data

Empty States:
- Show proper empty states when no data:
  * Icon (from Lucide React)
  * "No data yet" or "No [items] found" message
  * Helpful CTA like "Create First Item" or "Import Data"
  * Example: <EmptyState icon={FileX} message="No reports yet" action="Generate Report" />

Loading States:
- Use skeleton UI for data loading (not just spinners):
  * Gray pulse animations matching content layout
  * Maintain layout shape during loading
  * Example: Skeleton cards while fetching dashboard data
- Loading state for charts: skeleton boxes matching chart dimensions

Tables:
- Use ShadCN Table component for data tables
- Features to implement:
  * Sortable column headers (visual indicator: arrow icons)
  * Filtering/search UI (Input component above table)
  * Pagination for large datasets (show "Page 1 of X")
  * Row actions (Edit, Delete, View buttons/icons)
  * Alternating row colors or borders for readability
- Show row count: "Showing 10 of 247 items"

STATE MANAGEMENT:

Implement THREE States for ALL Data:
1. Loading state: show skeleton UI
   const [loading, setLoading] = useState(true);
2. Error state: show error message with retry button
   const [error, setError] = useState<string | null>(null);
3. Empty state: show "no data" with helpful action
   const [data, setData] = useState<Item[]>([]);

Example State Pattern:
\`\`\`typescript
const [data, setData] = useState<DashboardData[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      setData(mockData);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };
  fetchData();
}, []);
\`\`\`

Use Realistic Mock Data:
- Create mock data that matches the dashboard use case
- Include realistic values, names, dates, and numbers
- 5-15 items for tables, appropriate data for charts
- Ensure mock data demonstrates all features

Add Loading Delays:
- Simulate async behavior with setTimeout (1-2 seconds)
- Makes the UI feel more realistic and shows loading states work

FUNCTIONAL REQUIREMENTS:

Navigation:
- All navigation items must work:
  * If using React Router: use <Link to="/path"> components
  * If single-page: implement onClick handlers for tab/view switching
- Active state should highlight current page/section
- Mobile sidebar must close after navigation (on mobile)

Filters & Search:
- All filter dropdowns must have working onChange handlers
- Search input must filter/search data (even if just client-side filtering)
- Show "No results found" if search/filter returns empty
- Clear filters button to reset

Table Actions:
- Edit button: opens edit modal/form or navigates to edit page
- Delete button: opens confirmation dialog, then removes item
- View button: shows detail modal or navigates to detail page
- All actions must have working onClick handlers

Forms (if creating/editing):
- Implement proper form validation
- Show inline error messages
- Disabled states during submission
- Success feedback after save (toast notification)

Keyboard Shortcuts:
- Document keyboard shortcuts if implemented:
  * Cmd/Ctrl + K for search
  * Escape to close modals/sidebar
- Add help tooltip or modal listing shortcuts

Mobile Responsiveness:
- Stack layouts vertically on mobile
- Hamburger menu for sidebar (Sheet component)
- Touch-friendly button sizes (min h-10 or 44px)
- Tables: consider card layout on mobile if table too wide
- Test all interactions work on mobile viewports

INTERACTIVE ELEMENTS:

Buttons & Actions:
- All buttons must have onClick handlers or be form submissions
- Use proper button variants:
  * Primary actions: default variant
  * Secondary actions: outline or ghost variant
  * Destructive actions: destructive variant (red)

Modals & Dialogs:
- Must have working close buttons (X icon and Cancel button)
- Escape key should close modals
- Click outside to close (if appropriate)

Forms:
- Must have onSubmit with preventDefault()
- Proper validation before submission
- Loading state on submit button ("Saving..." text)
- Disable form during submission

Dropdowns & Selects:
- Must have working onChange handlers
- Update state when selection changes
- Show current selection

ACCESSIBILITY:

Semantic HTML:
- Use <nav> for navigation
- Use <main> for main content area
- Use <aside> for sidebar
- Proper heading hierarchy (h1 for page title, h2 for section headings)

ARIA Labels:
- Add aria-label to icon-only buttons
- Example: <Button aria-label="Edit user"><Edit className="h-4 w-4" /></Button>
- Add aria-current="page" to active navigation item

Keyboard Navigation:
- All interactive elements accessible via Tab
- Proper focus states visible
- Modal focus trap (focus stays within modal when open)

Color Contrast:
- Ensure text meets WCAG AA contrast ratios
- Status colors should have sufficient contrast
- Don't rely solely on color to convey information

Provide complete, production-ready code files that compile without errors.`,
  examples: [
    'An analytics dashboard for monitoring API usage, response times, and error rates across different endpoints',
    'A content management dashboard for a blog platform with posts, categories, authors, and publishing workflow',
    'A customer support dashboard showing tickets, response times, agent performance, and satisfaction ratings',
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

FILE STRUCTURE:
- Use React with TypeScript
- Use local state (useState) for data management
- Use ShadCN UI components: Table, Dialog, AlertDialog, Button, Input, Label, Select, Textarea
- If validation needed: install React Hook Form + Zod (recommended for complex forms)
- Create src/App.tsx as the main component

DATA STRUCTURE:

Define Clear TypeScript Types:
\`\`\`typescript
type Item = {
  id: string;
  // Add fields based on user's description
  // Use appropriate types: string, number, boolean, Date
  createdAt: Date;
  updatedAt?: Date;
};
\`\`\`

Field Types Based on Use Case:
- Use realistic field names matching the description
- Include proper TypeScript types for each field
- Common fields to consider:
  * id: string (use crypto.randomUUID())
  * name/title: string
  * description: string (use textarea for longer text)
  * category/type: string (use select dropdown)
  * amount/price/quantity: number
  * date fields: Date
  * boolean flags: boolean
  * timestamps: createdAt, updatedAt

Validation Rules:
- Required fields (must not be empty)
- Min/max length for strings
- Number ranges (min/max values)
- Email/URL format validation
- Date constraints

STATE MANAGEMENT:

Implement Complete CRUD State:
\`\`\`typescript
const [items, setItems] = useState<Item[]>(mockData);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [editingItem, setEditingItem] = useState<Item | null>(null);
const [showCreateDialog, setShowCreateDialog] = useState(false);
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
const [searchQuery, setSearchQuery] = useState('');
\`\`\`

LIST VIEW (Table):

Display Items in Table:
- Use ShadCN Table component
- Show 5-7 most important columns (not all fields)
- Include an actions column with Edit and Delete buttons
- Add sortable column headers (click to sort ascending/descending)
- Implement search/filter functionality:
  * Search input above table
  * Filter by key fields if appropriate (category, status, etc.)
- Show row count: "Showing X items" or "Showing X of Y items" if filtered
- Add pagination if >10 items (or set reasonable limit)

Table Actions Column:
\`\`\`typescript
<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    setEditingItem(item);
    setShowCreateDialog(true);
  }}
>
  <Edit className="h-4 w-4" />
</Button>
<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    setItemToDelete(item);
    setShowDeleteDialog(true);
  }}
>
  <Trash className="h-4 w-4 text-red-600" />
</Button>
\`\`\`

Empty State:
- When no items exist:
  * Icon (from Lucide React, e.g., Inbox)
  * "No [items] yet" message
  * "Create First [Item]" button that opens create dialog

Search & Filter:
- Search input that filters items by relevant fields
- Show "No results found" if search returns empty
- Clear search button to reset

CREATE/EDIT FORM:

Use Dialog Component:
- Single dialog for both create and edit
- Dialog opens when clicking "Create" button or "Edit" action
- Pre-fill form when editing (use editingItem state)
- Clear form when creating new item

Form Fields:
- Use appropriate input types based on data structure:
  * Text inputs for strings (Input component)
  * Number inputs for numbers (Input type="number")
  * Textarea for longer text (Textarea component)
  * Select for dropdowns (Select component)
  * Date picker for dates (Input type="date")
- Add proper labels with Label component
- Group related fields together
- Use proper spacing (gap-4 between fields)

Form Validation:
- Check required fields
- Validate formats (email, URL, etc.)
- Show specific error messages below each field:
  * "Email is required" not "Invalid input"
  * "Must be at least 3 characters"
  * "Must be a positive number"
- Display validation errors inline (red text below input)
- Example:
  \`\`\`typescript
  {errors.name && (
    <p className="text-sm text-red-600">{errors.name}</p>
  )}
  \`\`\`

Form Submission:
- Disable submit button during processing
- Show loading state: "Saving..." button text
- Clear form after successful creation
- Close dialog after success
- Show success toast/alert notification
- Handle errors gracefully

Form Actions:
- "Cancel" button (closes dialog without saving)
- "Save" or "Create" button (submits form)
- Use proper button variants (primary for save, ghost for cancel)

DELETE CONFIRMATION:

Use AlertDialog Component:
- Show when clicking delete button
- Display item details in confirmation:
  * "Delete '[item.name]'?"
  * Warning text: "This action cannot be undone."
- Action buttons:
  * "Cancel" button (closes dialog)
  * "Delete" button (destructive variant, performs deletion)

After Deletion:
- Remove item from state
- Show success message (toast/alert)
- Close dialog
- Update table immediately

CRUD OPERATIONS (Mock Implementation):

CREATE Operation:
\`\`\`typescript
const handleCreate = (formData: Omit<Item, 'id' | 'createdAt'>) => {
  const newItem: Item = {
    id: crypto.randomUUID(),
    ...formData,
    createdAt: new Date(),
  };
  setItems([...items, newItem]);
  setShowCreateDialog(false);
  // Show success message
};
\`\`\`

READ Operation:
- Already implemented by displaying items in table
- Implement search/filter to find specific items
- Optional: View detail modal showing all fields

UPDATE Operation:
\`\`\`typescript
const handleUpdate = (formData: Omit<Item, 'id' | 'createdAt'>) => {
  if (!editingItem) return;

  setItems(items.map(item =>
    item.id === editingItem.id
      ? { ...item, ...formData, updatedAt: new Date() }
      : item
  ));
  setEditingItem(null);
  setShowCreateDialog(false);
  // Show success message
};
\`\`\`

DELETE Operation:
\`\`\`typescript
const handleDelete = () => {
  if (!itemToDelete) return;

  setItems(items.filter(item => item.id !== itemToDelete.id));
  setItemToDelete(null);
  setShowDeleteDialog(false);
  // Show success message
};
\`\`\`

ERROR HANDLING:

Wrap Operations in Try-Catch:
\`\`\`typescript
try {
  setIsLoading(true);
  // Perform operation
  handleCreate(formData);
} catch (err) {
  setError(err instanceof Error ? err.message : 'An error occurred');
} finally {
  setIsLoading(false);
}
\`\`\`

User-Friendly Error Messages:
- "Failed to save [item]" not technical errors
- "Failed to delete [item]"
- "Failed to load data"
- Add retry buttons for failed operations

Validate Before Submission:
- Check all required fields filled
- Validate data formats
- Prevent submission if invalid
- Show specific validation errors

Handle Edge Cases:
- Empty strings
- Null/undefined values
- Invalid numbers
- Out-of-range dates

UI/UX POLISH:

Optimistic Updates:
- Update UI immediately (before "API call")
- Revert on error if needed
- Makes app feel faster

Success Feedback:
- Toast notifications after actions:
  * "Item created successfully"
  * "Item updated successfully"
  * "Item deleted successfully"
- Use subtle, non-intrusive notifications

Loading States:
- Show loading state during operations
- Disable buttons during processing
- Use "Saving...", "Deleting..." text in buttons

Keyboard Shortcuts:
- Escape key closes dialogs/modals
- Enter key submits forms (when not in textarea)
- Tab navigation through form fields

Mobile Responsive:
- Stack form fields vertically on mobile
- Use full-width dialogs on mobile (or responsive sizing)
- Touch-friendly button sizes (min h-10 or 44px)
- Consider card layout for table on mobile if too wide
- Ensure all actions accessible on mobile

Visual Feedback:
- Hover states on table rows
- Active states on buttons
- Focus states on inputs
- Disabled states clearly visible

MOCK DATA:

Create Realistic Mock Data:
- 3-5 initial items demonstrating the feature set
- Use realistic names, values, dates based on use case
- Vary the data to show different scenarios
- Example for book collection:
  \`\`\`typescript
  const mockData: Item[] = [
    {
      id: '1',
      title: 'The Pragmatic Programmer',
      author: 'David Thomas, Andrew Hunt',
      year: 2019,
      genre: 'Programming',
      rating: 5,
      createdAt: new Date('2024-01-15'),
    },
    // ... more items
  ];
  \`\`\`

${context.dependencies ? `Available dependencies: ${context.dependencies.join(', ')}` : ''}

Provide complete, production-ready code files that compile without errors.`,
  examples: [
    'A book collection manager with title, author, publication year, genre, and rating',
    'An expense tracker with category, amount, date, description, and payment method',
    'A recipe organizer with name, ingredients list, instructions, prep time, and difficulty level',
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
