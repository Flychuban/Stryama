# Stryama Technical Guide

## Project Overview

Stryama is an AI-powered no-code development platform that converts natural language prompts into functional applications. The platform combines AI-driven code generation with real-time preview environments.

### Core Architecture

```
┌─────────────────────────────────────────────┐
│            Frontend (Next.js)               │
├─────────────────────────────────────────────┤
│  UI Components (ShadCN)  │  State (Zustand) │
├─────────────────────────────────────────────┤
│                API Layer (tRPC)             │
├─────────────────────────────────────────────┤
│  Auth (Clerk) │ AI (Claude) │ Sandbox (E2B) │
│  DB (Prisma)  │ Payments (Stripe)           │
└─────────────────────────────────────────────┘
```

### Key Principles
- **AI-First Architecture**: Every component designed with AI integration as primary concern
- **Type Safety**: End-to-end TypeScript with Zod validation
- **Security by Design**: Sandboxed execution with comprehensive input validation
- **Real-Time Feedback**: Sub-5 second prompt-to-preview latency

## Technology Stack

### Frontend: Next.js 15+ with App Router
- **Server Components**: Data-heavy components for optimal performance
- **Client Components**: Interactive features (marked with 'use client')
- **API Routes**: tRPC integration for type-safe backend communication

### UI: ShadCN + Tailwind CSS
- **Copy-paste components**: Full control without external dependencies
- **Design system**: Consistent tokens via CSS variables
- **Accessibility first**: Built-in ARIA patterns

### Backend: TypeScript + tRPC
- **End-to-end type safety**: Shared types between client/server
- **Router architecture**: Organized by feature domains
- **Middleware**: Authentication, rate limiting, error handling

### Database: Prisma + PostgreSQL
```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  projects  Project[]
  generations AIGeneration[]
}

model Project {
  id          String   @id @default(cuid())
  name        String
  structure   Json     // File tree
  files       File[]
  sandboxes   Sandbox[]
}

model AIGeneration {
  id       String   @id @default(cuid())
  prompt   String
  tokens   Int      // For billing
  duration Int      // Performance tracking
  files    File[]
}
```

### AI Integration: Claude Code SDK
- **Code generation**: Primary AI engine for converting prompts to code
- **Context awareness**: Maintains project structure understanding
- **Error handling**: Robust fallback strategies

### Sandbox: E2B Environment
- **Secure execution**: Isolated containers for code preview
- **Real-time updates**: File synchronization with live preview
- **Multiple frameworks**: Next.js, React, Vanilla JS support

### Authentication: Clerk
- **Complete auth solution**: Signup, signin, profile management
- **Multiple providers**: Email/password, Google OAuth
- **User sync**: Automatic database user creation via webhooks

### Payments: Stripe + Clerk Integration
- **Subscription management**: Free and Pro tiers
- **Usage tracking**: AI generation limits and billing
- **Self-service**: Customer portal for billing management

## Code Conventions

### File Naming
- **Components**: PascalCase (`CodeGenerator.tsx`)
- **Hooks**: camelCase with "use" prefix (`useAIGeneration.ts`)
- **Utilities**: camelCase (`formatCode.ts`)
- **Types**: PascalCase (`AIGenerationRequest`)

### Component Patterns
```typescript
// Always use 'type' for props, never 'interface'
type Props = {
  projectId: string;
  onCodeGenerated: (code: string) => void;
  isLoading?: boolean;
};

export function CodeGenerator({ projectId, onCodeGenerated }: Props) {
  const [prompt, setPrompt] = useState('');
  const { mutateAsync: generateCode } = api.ai.generateCode.useMutation();

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    const result = await generateCode({ prompt, projectId });
    onCodeGenerated(result.files);
  }, [prompt, projectId, generateCode, onCodeGenerated]);

  return (
    <div className="space-y-4">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe what you want to build..."
      />
      <Button onClick={handleGenerate} disabled={!prompt.trim()}>
        Generate Code
      </Button>
    </div>
  );
}
```

### TypeScript Standards
```typescript
// NEVER use 'any' - use 'unknown' with type guards
function parseAIResponse(response: unknown): GeneratedCode {
  if (!isGeneratedCodeResponse(response)) {
    throw new Error('Invalid AI response format');
  }
  return response;
}

// Use Zod for runtime validation with automatic type inference
const promptSchema = z.object({
  content: z.string().min(1).max(2000),
  context: z.object({
    framework: z.enum(['nextjs', 'react', 'vanilla']),
    existingFiles: z.array(fileSchema).optional(),
  }),
});

type PromptInput = z.infer<typeof promptSchema>;
```

### Import Organization
```typescript
// 1. External libraries
import React, { useState, useCallback } from 'react';
import { z } from 'zod';

// 2. Internal utilities
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// 3. Type imports
import type { Project, AIGeneration } from '@/types';

// 4. UI components
import { Button } from '@/components/ui/button';

// 5. Custom hooks
import { useAIGeneration } from '@/hooks/use-ai-generation';

// 6. Local components
import { PromptInput } from './PromptInput';
```

## Project Structure

```
app/
├── (auth)/sign-in, sign-up     # Authentication pages
├── (dashboard)/                # Protected routes
│   ├── dashboard/             # Main dashboard
│   ├── projects/              # Project management
│   └── settings/              # User settings
├── editor/[projectId]/        # Code editor interface
└── api/trpc/                  # tRPC API routes

components/
├── ui/                        # ShadCN base components
├── ai/                        # AI-specific components
│   ├── CodeGenerator.tsx      # Main AI interface
│   ├── PromptInput.tsx        # Prompt input
│   └── GenerationHistory.tsx  # AI history
├── editor/                    # Code editor components
├── project/                   # Project management
└── shared/                    # Common components

lib/
├── api.ts                     # tRPC client
├── db.ts                      # Prisma client
├── integrations/              # External services
│   ├── claude/                # Claude SDK setup
│   ├── e2b/                   # E2B sandbox management
│   └── stripe/                # Payment processing
└── validations/               # Zod schemas

server/api/
├── root.ts                    # Root router
├── trpc.ts                    # tRPC configuration
└── routers/                   # API endpoints
    ├── ai.ts                  # AI generation
    ├── project.ts             # Project CRUD
    └── sandbox.ts             # Sandbox management

types/
├── ai.ts                      # AI-related types
├── project.ts                 # Project types
└── sandbox.ts                 # Sandbox types
```

## AI-Specific Development Patterns

### Prompt Engineering
```typescript
const PROMPT_TEMPLATES = {
  codeGeneration: {
    systemPrompt: `You are an expert web developer. Generate clean, production-ready code following best practices.`,

    userPromptTemplate: (request: {
      description: string;
      framework: string;
      existingFiles?: string;
    }) => `
Create a ${request.framework} application: ${request.description}

${request.existingFiles ? `Context:\n${request.existingFiles}` : ''}

Provide complete files with proper TypeScript, error handling, and accessibility.
`,
  },
};
```

### AI Response Processing
```typescript
const aiResponseSchema = z.object({
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    language: z.string(),
  })),
  explanation: z.string(),
});

export async function processAIResponse(rawResponse: string) {
  // Parse and validate
  const parsed = aiResponseSchema.parse(JSON.parse(rawResponse));

  // Sanitize code content
  const sanitizedFiles = parsed.files.map(file => ({
    ...file,
    content: sanitizeCode(file.content),
  }));

  // Security check
  validateSecureCode(sanitizedFiles);

  return sanitizedFiles;
}
```

### Error Recovery
```typescript
export class AIErrorRecovery {
  async handleFailure(error: Error, originalRequest: AIRequest) {
    const errorType = this.classifyError(error);

    switch (errorType) {
      case 'RATE_LIMIT_EXCEEDED':
        await this.delay(5000);
        return this.retryWithBackoff(originalRequest);

      case 'TOKEN_LIMIT_EXCEEDED':
        const simplified = this.simplifyRequest(originalRequest);
        return this.retryRequest(simplified);

      case 'INVALID_RESPONSE':
        return this.generateFromTemplate(originalRequest);

      default:
        throw new AIRecoveryError('No recovery strategy available');
    }
  }
}
```

### Usage Tracking
```typescript
export async function trackAIGeneration(data: {
  userId: string;
  prompt: string;
  response: AIResponse;
  duration: number;
  success: boolean;
}) {
  await db.aIGeneration.create({
    data: {
      userId: data.userId,
      promptLength: data.prompt.length,
      promptComplexity: calculateComplexity(data.prompt),
      responseTokens: data.response.files.reduce((sum, file) => sum + file.content.length, 0),
      duration: data.duration,
      success: data.success,
      filesGenerated: data.response.files.length,
    },
  });
}
```

## Development Workflow

### Environment Setup
```bash
# Required tools
node >= 18.0.0
npm >= 8.0.0

# Environment variables
DATABASE_URL="postgresql://..."
CLAUDE_API_KEY="sk-ant-..."
E2B_API_KEY="e2b_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
```

### Essential Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev"
  }
}
```

### Git Workflow
```bash
# Branch naming
feature/ai-code-generation
fix/sandbox-preview-loading
hotfix/security-patch

# Commit format
feat(ai): add code generation with Claude SDK
fix(sandbox): resolve preview timeout issues
refactor(auth): simplify user session handling
```

### Testing Strategy
- **Unit Tests**: Jest + React Testing Library for components
- **Integration Tests**: tRPC endpoints with MSW mocking
- **Manual Testing**: Focus on AI generation and sandbox functionality

### Error Handling
```typescript
// Custom error types for different domains
export class AIGenerationError extends Error {
  constructor(message: string, public code: string, public details?: unknown) {
    super(message);
    this.name = 'AIGenerationError';
  }
}

// Error boundaries for AI components
export function AIErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error, resetError }) => (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">AI Generation Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error.message}</p>
            <Button onClick={resetError}>Try Again</Button>
          </CardContent>
        </Card>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
```

### Performance Guidelines
- **Code Splitting**: Lazy load AI-heavy components
- **Memoization**: Cache expensive AI operations
- **Bundle Analysis**: Regular monitoring with `ANALYZE=true npm run build`
- **Rate Limiting**: Implement per-user AI generation limits
- **Caching**: Cache AI responses for identical prompts

### Security Best Practices
- **Input Validation**: Zod schemas for all AI inputs
- **Code Sanitization**: Remove dangerous patterns from generated code
- **Sandbox Isolation**: E2B containers prevent malicious code execution
- **API Key Protection**: Never expose secrets in generated code
- **User Authentication**: Clerk middleware protects all sensitive routes

This condensed guide focuses on the essential patterns and practices needed to work effectively with the Stryama codebase. For detailed implementations, refer to the existing code examples in the components and services directories.