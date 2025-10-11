# Stryama Frontend Implementation Specification

## Core Design Principles

1. **Conversation-First Design** - Natural language is the primary interface, not an afterthought
2. **Immediate Visual Feedback** - Every prompt shows results within 5 seconds with loading states
3. **Progressive Disclosure** - Start simple, reveal complexity only when needed
4. **Eliminate Development Intimidation** - Use approachable aesthetics and clear language

## Key User Flows

### First-Time User (15-minute success target)
```
Landing → Sign Up → Welcome → Project Creation → Guided First Prompt →
AI Generation → Live Preview → Success Celebration → Iteration Suggestion
```

### Iterative Development
```
Open Project → Review Preview → Enter Modification → Context Analysis →
Show Change Preview → User Confirms → AI Generation → Preview Updates
```

### Project Sharing
```
Project Dashboard → Select Project → Share Action → Configure Permissions →
Generate Link → Copy URL → Share Success
```

## Screen Layouts

### Main Development Interface (Primary Workspace)
- **Layout**: 50/50 split screen (desktop)
- **Left Panel**: Prompt input area (ChatGPT-style large textarea)
- **Right Panel**: Live preview iframe
- **Sidebar**: Collapsible context panel (files, history, settings)
- **Mobile**: Stacked layout (prompt above preview)

### Project Dashboard
- **Layout**: Grid view with project cards
- **Card Size**: 280px x 200px with thumbnail
- **Actions**: Hover reveals (edit, share, duplicate, delete)
- **Search**: Top bar with filter options

### Landing Page
- **Hero**: Large headline + interactive demo
- **Demo Area**: Live prompt input showing real generation
- **CTA**: "Start Building Now" button (prominent)

## Component Specifications

### Prompt Input Component
- **Base**: Large textarea, auto-resize, ChatGPT styling
- **States**: Empty, typing, submitting, success, error
- **Features**: Smart suggestions, example prompts, send button

### Preview Panel Component
- **Base**: Iframe with sandbox isolation
- **Controls**: Refresh, device simulation, full-screen, error display
- **States**: Loading, ready, error, updating
- **Loading**: Skeleton placeholder with shimmer

### Generation Status Component
- **Progress**: Linear progress bar with estimated time
- **States**: Processing, success, error, retry
- **Animation**: Breathing effect during AI processing

### Project Card Component
- **Size**: 280px x 200px
- **Content**: Thumbnail, name, last modified, framework icon
- **Actions**: Quick actions on hover
- **States**: Default, hover, selected

## Design System

### Colors
```css
/* Primary */
--primary: #6366F1;
--primary-hover: #5855F7;

/* Accent */
--accent: #10B981;
--accent-hover: #059669;

/* Status */
--success: #059669;
--warning: #F59E0B;
--error: #EF4444;

/* Neutrals */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-500: #6B7280;
--gray-900: #111827;
```

### Typography
```css
/* Fonts */
--font-primary: Inter, system-ui, sans-serif;
--font-mono: JetBrains Mono, monospace;

/* Scale */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing
```css
/* 8px base unit */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
```

## Responsive Breakpoints

```css
/* Mobile First */
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1440px) { /* Wide */ }
```

### Layout Adaptations
- **Mobile (320-767px)**: Single column, stacked layout, bottom navigation
- **Tablet (768-1023px)**: Side-by-side with resizable panels
- **Desktop (1024-1439px)**: Full split-screen with persistent sidebar
- **Wide (1440px+)**: Multi-panel layout with dedicated code view

## Performance Requirements

### Loading Targets
- **Initial Load**: < 2 seconds on 3G
- **UI Response**: < 100ms feedback
- **AI Acknowledgment**: < 200ms
- **Animation**: 60fps

### Optimization Strategy
- **JavaScript**: Max 250KB initial bundle
- **Images**: WebP format, responsive sizing
- **Fonts**: Preload Inter (400, 600 weights only)
- **Code Splitting**: Route-based chunks

## Animation Guidelines

### Key Animations
```css
/* Prompt submission */
.prompt-submit { transition: all 200ms ease-out; }

/* Generation progress */
.progress-breath { animation: breathe 1000ms ease-in-out infinite; }

/* Success celebration */
.success-pop { animation: pop 600ms ease-out; }

/* Loading shimmer */
.shimmer { animation: shimmer 1500ms linear infinite; }

/* Panel transitions */
.panel-slide { transition: transform 300ms ease-in-out; }
```

### Performance Rules
- **Transform/opacity only** for 60fps
- **Respect prefers-reduced-motion**
- **Hardware acceleration** for all animations
- **Duration**: 150-600ms max

## Technical Integration

### Tech Stack Alignment
- **Base**: ShadCN/UI + Tailwind CSS
- **Custom Components**: Extend ShadCN for conversation UI
- **Icons**: Heroicons (24px standard, 16px small)
- **State Management**: Zustand for UI state

### Key Libraries
- **@shadcn/ui**: Button, Input, Card, Dialog, Toast
- **@lucide-react**: Consistent icon system
- **framer-motion**: Complex animations (optional)
- **tailwindcss**: Utility-first styling

## Onboarding and Help System

### Interactive Onboarding Flow
- **Welcome Screen**: Platform overview with value proposition
- **Feature Tour**: Guided walkthrough of main interface elements
- **First Project Creation**: Step-by-step project setup with templates
- **Guided Generation**: Suggested prompts leading to successful first app
- **Success Celebration**: Achievement animation and sharing options

### Contextual Help System
- **Tooltip Integration**: Hover/focus hints for all interactive elements
- **Help Panel**: Slide-out panel with searchable help content
- **Smart Suggestions**: Context-aware prompt suggestions and examples
- **Progress Indicators**: Clear visual feedback for onboarding completion
- **Error Recovery**: Helpful guidance when users encounter issues

### Help Content Management
- **Searchable FAQ**: In-app search for common questions
- **Video Tutorials**: Embedded tutorials for key workflows
- **Interactive Examples**: Live examples users can modify and learn from
- **Feature Discovery**: Progressive disclosure of advanced features
- **Documentation Links**: Deep links to relevant help sections

### Component Specifications

#### Onboarding Overlay Component
```typescript
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetElement: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  action?: 'click' | 'input' | 'wait';
  nextCondition?: () => boolean;
}

interface OnboardingProps {
  steps: OnboardingStep[];
  currentStep: number;
  onStepComplete: (step: number) => void;
  onComplete: () => void;
  onSkip: () => void;
}
```

#### Help Tooltip Component
```typescript
interface HelpTooltipProps {
  content: string;
  children: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  showOnFocus?: boolean;
  maxWidth?: number;
}
```

#### Progress Indicator Component
```typescript
interface ProgressProps {
  steps: Array<{
    id: string;
    title: string;
    completed: boolean;
    current?: boolean;
  }>;
  showLabels?: boolean;
  variant?: 'linear' | 'circular';
}
```

## Implementation Priorities

### Phase 1: Core Interface
1. Main development interface layout
2. Prompt input component
3. Preview panel component
4. Basic project dashboard

### Phase 2: Enhanced UX
1. Generation status and animations
2. Context sidebar
3. Smart suggestions
4. Mobile responsiveness
5. Basic help tooltips and contextual hints

### Phase 3: Onboarding and Help System
1. Interactive onboarding flow components
2. Guided first-time user experience
3. Contextual help panel and search
4. Progress indicators and success celebrations
5. Smart prompt suggestions and examples

### Phase 4: Polish and Advanced Features
1. Advanced animations and micro-interactions
2. Performance optimizations
3. Accessibility enhancements
4. Cross-browser testing
5. Advanced help features (video tutorials, interactive examples)

## Accessibility Essentials

### Must-Have Features
- **Focus indicators**: 2px solid outline with 2px offset
- **Color contrast**: 4.5:1 minimum for text
- **Alt text** for all meaningful images


*This specification provides the essential implementation guidelines for building Stryama's conversational development interface. Focus on the core user experience first, then progressively enhance with advanced features.*