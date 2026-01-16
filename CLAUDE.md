# Stryama

AI-powered no-code development platform. Production app with ~100 customers. Users describe apps in natural language → Claude generates code → E2B sandbox previews → deploy to GitHub/Netlify.

## Quick Commands

```bash
pnpm dev          # Dev server (turbo)
pnpm check        # Lint + typecheck
pnpm test         # Run vitest
pnpm db:studio    # Prisma Studio
pnpm db:generate  # Create migration
```

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript 5.8
- **Styling:** Tailwind CSS + shadcn/ui
- **API:** tRPC 11 + React Query (type-safe end-to-end)
- **Database:** Prisma 6.5 + PostgreSQL
- **Auth:** Clerk (no user table - use `clerkUserId` directly)
- **AI:** Anthropic Claude SDK
- **Sandbox:** E2B for code execution
- **Testing:** Vitest
- **Package Manager:** pnpm

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── shared/             # Reusable (ErrorBoundary, Logo)
│   └── [feature]/          # Feature-specific components
├── server/api/
│   ├── routers/            # tRPC routers
│   └── trpc.ts             # Procedures: publicProcedure, protectedProcedure, adminProcedure
├── lib/
│   ├── services/           # Business logic (UsageTrackingService, ModelSelectionService)
│   ├── integrations/       # External services (claude/, e2b/, github/, netlify/)
│   └── utils/              # Helpers
├── hooks/                  # React hooks
├── types/                  # TypeScript types
└── trpc/                   # tRPC client setup
```

## Code Patterns

### Import Order

```typescript
// 1. External libraries
import { useState } from 'react';
import { z } from 'zod';

// 2. UI components
import { Button } from '@/components/ui/button';

// 3. Types (always use 'import type')
import type { Project } from '~/types/project';

// 4. Hooks
import { useAnalytics } from '~/hooks/useAnalytics';

// 5. Utils/Services
import { cn } from '@/lib/utils';
```

### Path Aliases

Both `~/*` and `@/*` map to `./src/*`. Convention: `@/` for components, `~/` for server/lib code.

### Component Props

```typescript
interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  // ...
}
```

### tRPC Router

```typescript
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '~/server/api/trpc';

export const exampleRouter = createTRPCRouter({
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.example.findFirst({
        where: { id: input.id, clerkUserId: ctx.auth.userId },
      });

      if (!item) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return item;
    }),
});
```

### Service Class

```typescript
export class ExampleService {
  /**
   * Brief description of what this does.
   */
  static async doSomething(userId: string): Promise<Result> {
    // Implementation
  }
}
```

## TypeScript Guidelines

### Strict Mode Enabled

- `noUncheckedIndexedAccess: true` - Array access may be undefined
- `verbatimModuleSyntax: true` - Always use `import type` for types

### Do This

```typescript
// Named interfaces for props/params
interface ProcessConfig {
  name: string;
  value: number;
}

// Type imports
import type { UserPlan } from '~/types/pricing';

// Handle potential undefined from array access
const first = items[0];
if (first) {
  // use first
}
```

### Avoid This

```typescript
// any
const data: any = response;

// Non-null assertion without validation
const user = users[0]!;

// Inline object types in function signatures
function process(config: { name: string; value: number }) {}
```

## Auth (Clerk)

No User model in Prisma - use Clerk's userId directly:

```typescript
// In tRPC router
const userId = ctx.auth.userId;

// In Prisma queries - always filter by user
await db.project.findMany({ where: { clerkUserId: userId } });

// Get user's plan
import { getUserPlanFromClerk } from '~/lib/clerk/authorization';
const plan = await getUserPlanFromClerk();
```

## Testing

Tests are co-located with source files:

```
src/lib/services/usageTracking.ts
src/lib/services/usageTracking.test.ts
```

Pattern:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ServiceName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should do something specific', async () => {
    // Arrange
    const input = createTestInput();

    // Act
    const result = await ServiceName.method(input);

    // Assert
    expect(result).toMatchObject({ expected: 'value' });
  });
});
```

## Database

```bash
pnpm db:studio    # Visual browser
pnpm db:generate  # Create migration
pnpm db:push      # Push schema (dev only)
```

Prisma conventions:

- Models: PascalCase (`Project`, `AIGeneration`)
- Always index foreign keys: `@@index([clerkUserId])`
- Cascade delete for owned entities

## Code Quality Guidelines

When writing or cleaning up code:

1. **Extract inline types** to named interfaces
2. **Replace `any`** with proper types or `unknown`
3. **Remove dead code** - no commented-out code, no unused imports
4. **Consolidate duplicates** - extract to utility functions
5. **Use domain error classes** for specific error handling
6. **Keep functions focused** - single responsibility
7. **Prefer early returns** over nested conditionals
8. **Remove unecesary code comments** - only 100% needed comments should be in the code

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.
  EOF
