# Pricing Implementation Guide

## Stryama AI Development Platform

**Version:** 1.0
**Date:** 2025-11-08
**Goal:** Implement sustainable 4-tier pricing with Haiku-first architecture

---

## Table of Contents

1. [Overview](#overview)
2. [Current State Analysis](#current-state-analysis)
3. [New Pricing Structure](#new-pricing-structure)
4. [Database Changes](#database-changes)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Model Selection Logic](#model-selection-logic)
8. [Usage Tracking](#usage-tracking)
9. [E2B Sandbox Management](#e2b-sandbox-management)
10. [Monitoring & Analytics](#monitoring--analytics)
11. [Testing Checklist](#testing-checklist)
12. [Launch Checklist](#launch-checklist)

---

## Overview

### What We're Building

A **4-tier pricing system** with:

- **Haiku-first model selection** (85% cost reduction)
- **Project-based limits** (controls E2B costs)
- **Monthly generation tracking** (simple, no session limits)
- **Break-even economics** from day 1 on paid tiers

### Key Principles

1. ✅ **Simplicity over complexity** - No session limits, no complex tracking
2. ✅ **Haiku as primary** - 80-90% of requests use Haiku for speed + cost
3. ✅ **Project limits control E2B** - Fewer projects = fewer sandboxes
4. ✅ **Sustainable margins** - 50-84% gross margin on paid tiers
5. ✅ **Clean, modular code** - Well-typed, readable, maintainable

---

## Current State Analysis

### Current Pricing (from `/src/components/landing/Pricing.tsx`)

**Existing Tiers:**

- Starter: $0 (5 projects)
- Pro: $29 (unlimited projects)
- Enterprise: $99

**Problems:**

1. ❌ No generation limits enforced
2. ❌ No project limits enforced
3. ❌ Always uses Sonnet 4 (expensive)
4. ❌ Unlimited projects = unlimited E2B costs
5. ❌ $29 for unlimited = unsustainable

### Current Implementation (from codebase)

**Rate Limiting** (`/src/lib/integrations/claude/config.ts`):

```typescript
RATE_LIMIT_CONFIG = {
  free: { requestsPerMinute: 5, requestsPerDay: 50, maxTokensPerRequest: 4096 },
  pro: {
    requestsPerMinute: 10,
    requestsPerDay: 200,
    maxTokensPerRequest: 8192,
  },
  enterprise: {
    requestsPerMinute: 20,
    requestsPerDay: 1000,
    maxTokensPerRequest: 16384,
  },
};
```

- ⚠️ In-memory tracking (not persistent)
- ⚠️ requestsPerDay doesn't track monthly

**AI Generation Tracking** (Database):

```prisma
model AIGeneration {
  tokens      Int?
  totalCost   Float?
  sessionId   String?
  projectId   String
  userId      String
}
```

- ✅ Already tracks tokens and costs
- ✅ Can be used for monthly aggregation

**Claude SDK Setup**:

- Uses `@anthropic-ai/claude-agent-sdk`
- Current model: `claude-sonnet-4-20250514`
- Max turns: 65
- E2B tools: Write, Read, Bash, List, GetPreviewURL

---

## New Pricing Structure

### Tier 1: STARTER (Free)

```typescript
{
  id: 'starter',
  name: 'Starter',
  price: 0,
  interval: 'month',
  features: {
    generationsPerMonth: 30,
    projectLimit: 1,
    e2bConcurrent: 1,
    e2bTimeout: 600, // 10 minutes in seconds
    models: ['haiku'],
    support: 'community',
    features: [
      '30 AI generations per month',
      '1 active project',
      'Fast AI model (Haiku)',
      'Community support',
      'E2B sandbox (10min timeout)'
    ]
  }
}
```

**Cost per user:** $0.56-0.84/month
**Purpose:** Acquisition (acceptable loss)

---

### Tier 2: BUILDER ($15/month)

```typescript
{
  id: 'builder',
  name: 'Builder',
  price: 15,
  interval: 'month',
  stripePriceId: 'price_xxx', // Add after Stripe setup
  features: {
    generationsPerMonth: 150,
    projectLimit: 3,
    e2bConcurrent: 2,
    e2bTimeout: 1800, // 30 minutes
    models: ['haiku', 'sonnet'],
    support: 'email',
    features: [
      '150 AI generations per month',
      '3 active projects',
      'Smart AI (Haiku + Sonnet)',
      'Email support (48hr)',
      'Private projects',
      'GitHub export',
      'E2B sandbox (30min timeout)'
    ]
  }
}
```

**Cost per user:** $2.40-7.20/month
**Margin:** 52-84%
**Target:** Main conversion tier

---

### Tier 3: PRO ($39/month)

```typescript
{
  id: 'pro',
  name: 'Pro',
  price: 39,
  interval: 'month',
  stripePriceId: 'price_yyy',
  features: {
    generationsPerMonth: 500,
    projectLimit: 10,
    e2bConcurrent: 5,
    e2bTimeout: 7200, // 2 hours
    models: ['haiku', 'sonnet'],
    support: 'priority',
    features: [
      '500 AI generations per month',
      '10 active projects',
      'Smart AI (Haiku + Sonnet)',
      'Priority support + chat',
      'Custom domains (future)',
      'API access (future)',
      'E2B sandbox (2hr timeout)'
    ]
  }
}
```

**Cost per user:** $7.20-24.00/month
**Margin:** 38-82%

---

### Tier 4: UNLIMITED ($99/month)

```typescript
{
  id: 'unlimited',
  name: 'Unlimited',
  price: 99,
  interval: 'month',
  stripePriceId: 'price_zzz',
  features: {
    generationsPerMonth: -1, // -1 = unlimited (fair use 2000)
    projectLimit: -1, // unlimited
    e2bConcurrent: 10,
    e2bTimeout: 21600, // 6 hours
    models: ['haiku', 'sonnet'],
    support: 'priority_plus',
    features: [
      'Unlimited AI generations',
      'Unlimited projects',
      'All AI models',
      'Priority support + onboarding call',
      'Team collaboration (future)',
      'White-label (future)',
      'E2B sandbox (6hr timeout)'
    ]
  }
}
```

**Cost per user:** $38.40-96.00/month
**Margin:** 27-61%
**Fair use:** Monitor at 2000 gens/month

---

## Database Changes

### 1. Add User Metadata Table (or extend existing User model)

```prisma
model UserUsage {
  id                    String   @id @default(cuid())
  userId                String   @unique
  plan                  UserPlan @default(FREE)

  // Current billing period
  currentPeriodStart    DateTime @default(now())
  currentPeriodEnd      DateTime

  // Usage tracking
  generationsThisMonth  Int      @default(0)
  lastGenerationAt      DateTime?

  // Metadata
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relation
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([currentPeriodEnd])
}
```

### 2. Update or Create PlanLimits Configuration

```typescript
// src/types/pricing.ts

export type UserPlan = 'FREE' | 'BUILDER' | 'PRO' | 'UNLIMITED';

export interface PlanLimits {
  generationsPerMonth: number; // -1 = unlimited
  projectLimit: number; // -1 = unlimited
  e2bConcurrent: number;
  e2bTimeoutSeconds: number;
  models: ('haiku' | 'sonnet')[];
  supportLevel: 'community' | 'email' | 'priority' | 'priority_plus';
}

export const PLAN_LIMITS: Record<UserPlan, PlanLimits> = {
  FREE: {
    generationsPerMonth: 30,
    projectLimit: 1,
    e2bConcurrent: 1,
    e2bTimeoutSeconds: 600,
    models: ['haiku'],
    supportLevel: 'community',
  },
  BUILDER: {
    generationsPerMonth: 150,
    projectLimit: 3,
    e2bConcurrent: 2,
    e2bTimeoutSeconds: 1800,
    models: ['haiku', 'sonnet'],
    supportLevel: 'email',
  },
  PRO: {
    generationsPerMonth: 500,
    projectLimit: 10,
    e2bConcurrent: 5,
    e2bTimeoutSeconds: 7200,
    models: ['haiku', 'sonnet'],
    supportLevel: 'priority',
  },
  UNLIMITED: {
    generationsPerMonth: -1,
    projectLimit: -1,
    e2bConcurrent: 10,
    e2bTimeoutSeconds: 21600,
    models: ['haiku', 'sonnet'],
    supportLevel: 'priority_plus',
  },
};
```

### 3. Migration Script

```typescript
// Create migration: npx prisma migrate dev --name add_user_usage_tracking

// After migration, seed existing users:
async function seedUserUsage() {
  const users = await prisma.user.findMany();

  for (const user of users) {
    await prisma.userUsage.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        plan: 'FREE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: addMonths(new Date(), 1),
        generationsThisMonth: 0,
      },
      update: {},
    });
  }
}
```

---

## Backend Implementation

### 1. Usage Tracking Service

**Create:** `/src/lib/services/usageTracking.ts`

```typescript
import { prisma } from '@/lib/db';
import { PLAN_LIMITS } from '@/types/pricing';
import type { UserPlan } from '@/types/pricing';

export class UsageTrackingService {
  /**
   * Check if user can make a generation
   * @throws Error if limit exceeded
   */
  static async checkGenerationLimit(userId: string): Promise<void> {
    const usage = await this.getUserUsage(userId);
    const limits = PLAN_LIMITS[usage.plan];

    // Check if billing period has reset
    if (new Date() > usage.currentPeriodEnd) {
      await this.resetBillingPeriod(userId);
      return; // Fresh period, allow generation
    }

    // Unlimited plan (with fair use warning)
    if (limits.generationsPerMonth === -1) {
      if (usage.generationsThisMonth >= 2000) {
        // Log warning but don't block
        console.warn(`User ${userId} exceeded fair use (2000 gens/month)`);
      }
      return;
    }

    // Check limit
    if (usage.generationsThisMonth >= limits.generationsPerMonth) {
      throw new Error(
        `Generation limit reached. You've used ${usage.generationsThisMonth}/${limits.generationsPerMonth} generations this month.`
      );
    }
  }

  /**
   * Increment generation count
   */
  static async incrementGenerationCount(userId: string): Promise<void> {
    await prisma.userUsage.update({
      where: { userId },
      data: {
        generationsThisMonth: { increment: 1 },
        lastGenerationAt: new Date(),
      },
    });
  }

  /**
   * Check if user can create a project
   * @throws Error if limit exceeded
   */
  static async checkProjectLimit(userId: string): Promise<void> {
    const usage = await this.getUserUsage(userId);
    const limits = PLAN_LIMITS[usage.plan];

    // Unlimited projects
    if (limits.projectLimit === -1) {
      return;
    }

    // Count active projects
    const projectCount = await prisma.project.count({
      where: { userId },
    });

    if (projectCount >= limits.projectLimit) {
      throw new Error(
        `Project limit reached. You have ${projectCount}/${limits.projectLimit} projects. Delete old projects or upgrade your plan.`
      );
    }
  }

  /**
   * Get user usage data
   */
  static async getUserUsage(userId: string) {
    let usage = await prisma.userUsage.findUnique({
      where: { userId },
    });

    // Create if doesn't exist (new user)
    if (!usage) {
      usage = await prisma.userUsage.create({
        data: {
          userId,
          plan: 'FREE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: this.getNextBillingDate(new Date()),
          generationsThisMonth: 0,
        },
      });
    }

    return usage;
  }

  /**
   * Reset billing period (monthly)
   */
  static async resetBillingPeriod(userId: string): Promise<void> {
    const now = new Date();
    await prisma.userUsage.update({
      where: { userId },
      data: {
        currentPeriodStart: now,
        currentPeriodEnd: this.getNextBillingDate(now),
        generationsThisMonth: 0,
      },
    });
  }

  /**
   * Get next billing date (same day next month)
   */
  static getNextBillingDate(from: Date): Date {
    const next = new Date(from);
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  /**
   * Update user plan (called by Stripe webhook)
   */
  static async updateUserPlan(userId: string, plan: UserPlan): Promise<void> {
    await prisma.userUsage.update({
      where: { userId },
      data: { plan },
    });
  }

  /**
   * Get usage stats for display
   */
  static async getUsageStats(userId: string) {
    const usage = await this.getUserUsage(userId);
    const limits = PLAN_LIMITS[usage.plan];

    const projectCount = await prisma.project.count({
      where: { userId },
    });

    return {
      plan: usage.plan,
      generationsUsed: usage.generationsThisMonth,
      generationsLimit: limits.generationsPerMonth,
      generationsRemaining:
        limits.generationsPerMonth === -1
          ? -1
          : Math.max(
              0,
              limits.generationsPerMonth - usage.generationsThisMonth
            ),
      projectsUsed: projectCount,
      projectsLimit: limits.projectLimit,
      periodEnds: usage.currentPeriodEnd,
      daysUntilReset: Math.ceil(
        (usage.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    };
  }
}
```

---

### 2. Model Selection Service

**Create:** `/src/lib/services/modelSelection.ts`

```typescript
import type { UserPlan } from '@/types/pricing';
import { PLAN_LIMITS } from '@/types/pricing';

export type ClaudeModel = 'haiku' | 'sonnet';

export class ModelSelectionService {
  /**
   * Select appropriate model based on prompt complexity and user plan
   */
  static selectModel(prompt: string, userPlan: UserPlan): ClaudeModel {
    const allowedModels = PLAN_LIMITS[userPlan].models;

    // Free tier: Haiku only
    if (!allowedModels.includes('sonnet')) {
      return 'haiku';
    }

    // Analyze prompt complexity
    const complexity = this.analyzePromptComplexity(prompt);

    // Simple prompts: Always Haiku
    if (complexity === 'simple') {
      return 'haiku';
    }

    // Medium prompts: Try Haiku first
    if (complexity === 'medium') {
      return 'haiku'; // Will fallback to Sonnet if needed
    }

    // Complex prompts: Use Sonnet directly
    return 'sonnet';
  }

  /**
   * Analyze prompt complexity
   */
  static analyzePromptComplexity(
    prompt: string
  ): 'simple' | 'medium' | 'complex' {
    const tokenEstimate = prompt.length / 4; // Rough estimation

    // Complex keywords
    const complexKeywords = [
      'dashboard',
      'authentication',
      'database',
      'api integration',
      'real-time',
      'websocket',
      'advanced',
      'complex',
      'system',
      'architecture',
    ];

    const hasComplexKeyword = complexKeywords.some((keyword) =>
      prompt.toLowerCase().includes(keyword)
    );

    // Determine complexity
    if (tokenEstimate < 200 && !hasComplexKeyword) {
      return 'simple'; // "Add a button", "Change color"
    }

    if (tokenEstimate < 500 && !hasComplexKeyword) {
      return 'medium'; // "Add form validation"
    }

    return 'complex'; // Long prompts or complex features
  }

  /**
   * Get Claude model ID for API
   */
  static getModelId(model: ClaudeModel): string {
    const models = {
      haiku: 'claude-haiku-4-5-20250514',
      sonnet: 'claude-sonnet-4-20250514',
    };

    return models[model];
  }

  /**
   * Should retry with better model on failure
   */
  static shouldRetryWithBetterModel(
    currentModel: ClaudeModel,
    userPlan: UserPlan,
    qualityScore?: number
  ): ClaudeModel | null {
    // If already using Sonnet, can't upgrade
    if (currentModel === 'sonnet') {
      return null;
    }

    // If plan doesn't allow Sonnet, can't upgrade
    if (!PLAN_LIMITS[userPlan].models.includes('sonnet')) {
      return null;
    }

    // If quality score is low, retry with Sonnet
    if (qualityScore !== undefined && qualityScore < 0.7) {
      return 'sonnet';
    }

    return null;
  }
}
```

---

### 3. Update Claude Integration

**Modify:** `/src/lib/integrations/claude/agent.ts`

```typescript
import { ModelSelectionService } from '@/lib/services/modelSelection';
import { UsageTrackingService } from '@/lib/services/usageTracking';

export async function generateWithClaude(
  prompt: string,
  userId: string,
  projectId: string,
  sessionId?: string
) {
  // 1. Check if user can generate
  await UsageTrackingService.checkGenerationLimit(userId);

  // 2. Get user plan
  const usage = await UsageTrackingService.getUserUsage(userId);

  // 3. Select model
  const selectedModel = ModelSelectionService.selectModel(prompt, usage.plan);
  const modelId = ModelSelectionService.getModelId(selectedModel);

  console.log(`Using model: ${selectedModel} (${modelId}) for user ${userId}`);

  // 4. Run agent (existing logic)
  const result = await runClaudeAgent({
    prompt,
    projectId,
    sessionId,
    model: modelId,
    // ... other config
  });

  // 5. Check if should retry with better model
  const betterModel = ModelSelectionService.shouldRetryWithBetterModel(
    selectedModel,
    usage.plan,
    result.qualityScore
  );

  if (betterModel && result.qualityScore < 0.7) {
    console.log(
      `Quality low (${result.qualityScore}), retrying with ${betterModel}`
    );
    const retryModelId = ModelSelectionService.getModelId(betterModel);

    const retryResult = await runClaudeAgent({
      prompt,
      projectId,
      sessionId,
      model: retryModelId,
    });

    // Use retry result if better
    if (retryResult.qualityScore > result.qualityScore) {
      result = retryResult;
    }
  }

  // 6. Track generation and cost
  await Promise.all([
    UsageTrackingService.incrementGenerationCount(userId),
    prisma.aIGeneration.create({
      data: {
        userId,
        projectId,
        sessionId,
        prompt,
        response: result.output,
        tokens: result.tokensUsed,
        totalCost: result.cost,
        model: selectedModel,
        duration: result.duration,
      },
    }),
  ]);

  return result;
}
```

---

### 4. Update Project Creation

**Modify:** `/src/app/api/projects/route.ts` (or wherever projects are created)

```typescript
import { UsageTrackingService } from '@/lib/services/usageTracking';

export async function POST(req: Request) {
  const { userId } = auth(); // Clerk auth

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Check project limit
  try {
    await UsageTrackingService.checkProjectLimit(userId);
  } catch (error) {
    return new Response(error.message, { status: 403 });
  }

  // Create project (existing logic)
  const project = await prisma.project.create({
    data: {
      userId,
      // ... other fields
    },
  });

  return Response.json(project);
}
```

---

## Frontend Implementation

### 1. Update Pricing Page

**Modify:** `/src/components/landing/Pricing.tsx`

```typescript
const pricingTiers = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    description: 'Perfect for trying out the platform',
    features: [
      '30 AI generations per month',
      '1 active project',
      'Fast AI model (Haiku)',
      'E2B sandbox (10min timeout)',
      'Community support',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    id: 'builder',
    name: 'Builder',
    price: 15,
    description: 'Best for indie developers and learners',
    features: [
      '150 AI generations per month',
      '3 active projects',
      'Smart AI (Haiku + Sonnet)',
      'E2B sandbox (30min timeout)',
      'Email support (48hr)',
      'Private projects',
      'GitHub export',
    ],
    cta: 'Start Building',
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 39,
    description: 'For professional developers',
    features: [
      '500 AI generations per month',
      '10 active projects',
      'Smart AI with priority routing',
      'E2B sandbox (2hr timeout)',
      'Priority support + chat',
      'Custom domains (coming soon)',
      'API access (coming soon)',
    ],
    cta: 'Go Pro',
    highlighted: false,
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: 99,
    description: 'For teams and power users',
    features: [
      'Unlimited AI generations',
      'Unlimited projects',
      'All AI models',
      'E2B sandbox (6hr timeout)',
      'Priority support + onboarding call',
      'Team collaboration (coming soon)',
      'White-label (coming soon)',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];
```

**Add comparison section:**

```tsx
// Add below pricing cards
<section className="mt-16">
  <h3 className="mb-8 text-center text-2xl font-bold">Compare Plans</h3>
  <table className="mx-auto w-full max-w-4xl">
    <thead>
      <tr>
        <th>Feature</th>
        <th>Starter</th>
        <th>Builder</th>
        <th>Pro</th>
        <th>Unlimited</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Generations/month</td>
        <td>30</td>
        <td>150</td>
        <td>500</td>
        <td>Unlimited*</td>
      </tr>
      <tr>
        <td>Active projects</td>
        <td>1</td>
        <td>3</td>
        <td>10</td>
        <td>Unlimited</td>
      </tr>
      {/* ... more rows */}
    </tbody>
  </table>
  <p className="mt-4 text-center text-sm text-gray-600">
    * Fair use policy: 2000 generations/month
  </p>
</section>
```

---

### 2. Create Usage Dashboard Component

**Create:** `/src/components/dashboard/UsageDashboard.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';

interface UsageStats {
  plan: string;
  generationsUsed: number;
  generationsLimit: number;
  generationsRemaining: number;
  projectsUsed: number;
  projectsLimit: number;
  periodEnds: Date;
  daysUntilReset: number;
}

export function UsageDashboard() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsageStats();
  }, []);

  async function fetchUsageStats() {
    try {
      const res = await fetch('/api/usage');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !stats) {
    return <div>Loading usage stats...</div>;
  }

  const generationPercent = stats.generationsLimit === -1
    ? (stats.generationsUsed / 2000) * 100 // Fair use threshold
    : (stats.generationsUsed / stats.generationsLimit) * 100;

  const projectPercent = stats.projectsLimit === -1
    ? 0
    : (stats.projectsUsed / stats.projectsLimit) * 100;

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      <div>
        <h3 className="text-lg font-semibold mb-2">Current Plan: {stats.plan}</h3>
        <p className="text-sm text-gray-600">
          Resets in {stats.daysUntilReset} days
        </p>
      </div>

      {/* Generations Usage */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">AI Generations</span>
          <span className="text-sm text-gray-600">
            {stats.generationsUsed} / {stats.generationsLimit === -1 ? '∞' : stats.generationsLimit}
          </span>
        </div>
        <Progress value={generationPercent} className="h-2" />
        {generationPercent > 80 && stats.generationsLimit !== -1 && (
          <p className="text-sm text-amber-600 mt-1">
            You're approaching your limit. Consider upgrading!
          </p>
        )}
      </div>

      {/* Projects Usage */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Active Projects</span>
          <span className="text-sm text-gray-600">
            {stats.projectsUsed} / {stats.projectsLimit === -1 ? '∞' : stats.projectsLimit}
          </span>
        </div>
        {stats.projectsLimit !== -1 && (
          <Progress value={projectPercent} className="h-2" />
        )}
      </div>

      {/* Upgrade CTA */}
      {stats.plan === 'FREE' && (
        <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Upgrade to Builder - $15/month
        </button>
      )}
    </div>
  );
}
```

---

### 3. Add Usage API Endpoint

**Create:** `/src/app/api/usage/route.ts`

```typescript
import { auth } from '@clerk/nextjs';
import { UsageTrackingService } from '@/lib/services/usageTracking';

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const stats = await UsageTrackingService.getUsageStats(userId);

  return Response.json(stats);
}
```

---

### 4. Add Usage Warning in Generation UI

**Modify:** Component that triggers AI generation (e.g., chat interface)

```typescript
// Before triggering generation
const usage = await fetch('/api/usage').then((r) => r.json());

if (usage.generationsRemaining === 0) {
  toast.error('Generation limit reached. Upgrade your plan to continue.');
  return;
}

if (usage.generationsRemaining <= 5 && usage.generationsRemaining > 0) {
  toast.warning(
    `Only ${usage.generationsRemaining} generations remaining this month.`
  );
}

// Proceed with generation
await generateCode(prompt);
```

---

## Model Selection Logic

### Implementation Strategy

**Haiku-First Flow:**

```
User submits prompt
    ↓
Analyze complexity
    ↓
    ├─ Simple/Medium → Try Haiku
    │       ↓
    │   Check quality score
    │       ↓
    │       ├─ Good (>0.7) → Return result
    │       └─ Poor (<0.7) → Retry with Sonnet
    │
    └─ Complex → Use Sonnet directly
```

**Quality Score Calculation:**

```typescript
// In agent result processing
function calculateQualityScore(result: AgentResult): number {
  let score = 1.0;

  // Deduct for errors
  if (result.errors && result.errors.length > 0) {
    score -= 0.3;
  }

  // Deduct for incomplete responses
  if (result.output.length < 100) {
    score -= 0.2;
  }

  // Deduct for execution failures
  if (result.executionFailed) {
    score -= 0.4;
  }

  return Math.max(0, score);
}
```

---

## E2B Sandbox Management

### 1. Add Sandbox Timeout Management

**Modify:** E2B initialization code

```typescript
import { PLAN_LIMITS } from '@/types/pricing';

async function initializeE2BSandbox(userId: string, projectId: string) {
  const usage = await UsageTrackingService.getUserUsage(userId);
  const limits = PLAN_LIMITS[usage.plan];

  // Check concurrent limit
  const activeSandboxes = await getActiveSandboxCount(userId);
  if (activeSandboxes >= limits.e2bConcurrent) {
    throw new Error(
      `Concurrent sandbox limit reached (${activeSandboxes}/${limits.e2bConcurrent}). Close other projects first.`
    );
  }

  // Create sandbox with timeout
  const sandbox = await Sandbox.create({
    metadata: {
      userId,
      projectId,
      createdAt: Date.now(),
      timeoutSeconds: limits.e2bTimeoutSeconds,
    },
  });

  // Set auto-destroy timer
  setTimeout(async () => {
    await sandbox.kill();
    console.log(`Sandbox ${sandbox.id} auto-destroyed after timeout`);
  }, limits.e2bTimeoutSeconds * 1000);

  return sandbox;
}
```

### 2. Add Sandbox Cleanup Cron

**Create:** `/src/app/api/cron/cleanup-sandboxes/route.ts`

```typescript
export async function GET(req: Request) {
  // Verify cron secret
  if (
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Get all active sandboxes
  const sandboxes = await Sandbox.list();

  const now = Date.now();
  let cleaned = 0;

  for (const sandbox of sandboxes) {
    const createdAt = sandbox.metadata.createdAt as number;
    const timeout = sandbox.metadata.timeoutSeconds as number;
    const age = (now - createdAt) / 1000; // seconds

    if (age > timeout) {
      await sandbox.kill();
      cleaned++;
      console.log(`Cleaned up stale sandbox: ${sandbox.id}`);
    }
  }

  return Response.json({ cleaned });
}
```

**Add to Vercel cron config** (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-sandboxes",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

## Monitoring & Analytics

### 1. Cost Tracking Dashboard (Admin)

**Create:** `/src/app/admin/analytics/page.tsx`

```typescript
// Admin-only page to monitor costs
export default async function AnalyticsPage() {
  const stats = await getCostAnalytics();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Cost Analytics</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Today's API Costs"
          value={`$${stats.todayCost.toFixed(2)}`}
        />
        <StatCard
          title="This Month"
          value={`$${stats.monthCost.toFixed(2)}`}
        />
        <StatCard
          title="Avg Cost/User"
          value={`$${stats.avgCostPerUser.toFixed(2)}`}
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers}
        />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Model Usage</h2>
        <PieChart data={[
          { name: 'Haiku', value: stats.haikuUsage, color: '#10b981' },
          { name: 'Sonnet', value: stats.sonnetUsage, color: '#3b82f6' }
        ]} />
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">High-Cost Users</h2>
        <UserCostTable users={stats.topUsers} />
      </div>
    </div>
  );
}

async function getCostAnalytics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const [todayCost, monthCost, modelStats, activeUsers, topUsers] = await Promise.all([
    // Today's cost
    prisma.aIGeneration.aggregate({
      where: { createdAt: { gte: today } },
      _sum: { totalCost: true }
    }),

    // This month's cost
    prisma.aIGeneration.aggregate({
      where: { createdAt: { gte: thisMonth } },
      _sum: { totalCost: true }
    }),

    // Model usage
    prisma.aIGeneration.groupBy({
      by: ['model'],
      where: { createdAt: { gte: thisMonth } },
      _count: true
    }),

    // Active users this month
    prisma.userUsage.count({
      where: { lastGenerationAt: { gte: thisMonth } }
    }),

    // Top cost users
    prisma.aIGeneration.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: thisMonth } },
      _sum: { totalCost: true },
      orderBy: { _sum: { totalCost: 'desc' } },
      take: 10
    })
  ]);

  return {
    todayCost: todayCost._sum.totalCost || 0,
    monthCost: monthCost._sum.totalCost || 0,
    avgCostPerUser: activeUsers > 0 ? (monthCost._sum.totalCost || 0) / activeUsers : 0,
    activeUsers,
    haikuUsage: modelStats.find(m => m.model === 'haiku')?._count || 0,
    sonnetUsage: modelStats.find(m => m.model === 'sonnet')?._count || 0,
    topUsers
  };
}
```

### 2. Set Up Alerts

**Create:** `/src/lib/monitoring/alerts.ts`

```typescript
// Use service like Resend or SendGrid for emails

export async function checkCostAlerts() {
  const stats = await getCostAnalytics();

  // Alert 1: Daily cost over $50
  if (stats.todayCost > 50) {
    await sendAlert({
      subject: '⚠️ High Daily Costs',
      message: `Today's API costs: $${stats.todayCost.toFixed(2)}`,
    });
  }

  // Alert 2: User cost over $20
  for (const user of stats.topUsers) {
    if (user._sum.totalCost > 20) {
      await sendAlert({
        subject: '⚠️ High-Cost User Detected',
        message: `User ${user.userId} cost $${user._sum.totalCost.toFixed(2)} this month`,
      });
    }
  }

  // Alert 3: Haiku usage below 70%
  const totalGens = stats.haikuUsage + stats.sonnetUsage;
  const haikuPercent = (stats.haikuUsage / totalGens) * 100;

  if (haikuPercent < 70) {
    await sendAlert({
      subject: '⚠️ Low Haiku Usage',
      message: `Only ${haikuPercent.toFixed(1)}% of requests using Haiku (target: 80%)`,
    });
  }
}
```

**Add cron job** (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/cost-alerts",
      "schedule": "0 9 * * *"
    }
  ]
}
```

---

## Testing Checklist

### Unit Tests

- [ ] UsageTrackingService.checkGenerationLimit()
- [ ] UsageTrackingService.checkProjectLimit()
- [ ] UsageTrackingService.resetBillingPeriod()
- [ ] ModelSelectionService.selectModel()
- [ ] ModelSelectionService.analyzePromptComplexity()

### Integration Tests

- [ ] Create project at limit (should fail)
- [ ] Generate at limit (should fail)
- [ ] Billing period reset (should allow new generations)
- [ ] Haiku → Sonnet fallback on quality failure
- [ ] E2B sandbox timeout enforcement

### E2E Tests

- [ ] Free user: Create 2nd project (should fail)
- [ ] Free user: 31st generation (should fail)
- [ ] Builder user: 151st generation (should fail or charge overage)
- [ ] Pro user: Create 11th project (should fail)
- [ ] Unlimited user: 2500 generations (should warn but allow)

### Performance Tests

- [ ] Usage check latency (<100ms)
- [ ] Dashboard load time (<500ms)
- [ ] Model selection overhead (<10ms)
- [ ] Concurrent users (100+)

---

## Launch Checklist

### Pre-Launch (Week Before)

- [ ] All database migrations run successfully
- [ ] Seed existing users with UserUsage records
- [ ] Stripe integration set up (price IDs)
- [ ] Usage dashboard deployed and tested
- [ ] Pricing page updated
- [ ] Email templates for limit warnings
- [ ] Documentation updated
- [ ] Admin analytics dashboard working

### Launch Day

- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Monitor error rates (target: <1%)
- [ ] Monitor API costs (should decrease 70-80%)
- [ ] Check Haiku usage ratio (target: 80%+)
- [ ] Verify billing period calculations
- [ ] Test user flows (signup → generate → upgrade)

### Post-Launch (Week 1)

- [ ] Daily cost monitoring
- [ ] User feedback collection
- [ ] Check conversion rates (free → paid)
- [ ] Monitor limit hit rates
- [ ] Adjust limits if needed
- [ ] A/B test pricing if needed

### Month 1

- [ ] Analyze usage patterns
- [ ] Calculate actual unit economics
- [ ] Compare projections vs reality
- [ ] Adjust pricing/limits based on data
- [ ] Plan feature roadmap based on feedback

---

## Success Metrics

### Week 1 Targets

- ✅ API costs reduced by 70-80% (Haiku adoption)
- ✅ <1% error rate on usage checks
- ✅ 5-10% free → paid conversion
- ✅ <5% of users hitting limits

### Month 1 Targets

- ✅ 50-70% gross margin on Builder tier
- ✅ 60-80% gross margin on Pro tier
- ✅ 80%+ Haiku usage ratio
- ✅ <10% monthly churn

### Month 3 Targets

- ✅ 100+ paying customers
- ✅ $1,500+ MRR
- ✅ Break-even on total costs
- ✅ <5% support ticket rate

---

## Support & Documentation

### User-Facing Docs

Create help articles:

1. "Understanding Your Usage Limits"
2. "How Billing Periods Work"
3. "What Happens When I Hit My Limit?"
4. "Choosing the Right Plan"
5. "Model Selection: Fast vs Smart vs Advanced"

### Developer Docs

Document for team:

1. Usage tracking architecture
2. Model selection logic
3. E2B sandbox lifecycle
4. Monitoring and alerting setup
5. How to adjust limits/pricing

---

## Rollback Plan

If issues arise:

1. **Critical errors:** Revert deployment immediately
2. **High costs:** Temporarily disable free tier, reduce limits
3. **User complaints:** Extend grace period, refund charges
4. **Database issues:** Roll back migration, restore from backup

**Rollback command:**

```bash
# Revert database migration
npx prisma migrate resolve --rolled-back <migration_name>

# Redeploy previous version
vercel rollback
```

---

## Future Enhancements (Post-MVP)

### Phase 2 (Month 2-3)

- [ ] Credit rollover system
- [ ] Overage pricing automation
- [ ] Usage analytics for users
- [ ] Email notifications at 80% usage
- [ ] Annual billing discounts

### Phase 3 (Month 4-6)

- [ ] Team collaboration features
- [ ] Custom domains
- [ ] API access
- [ ] Webhooks
- [ ] Advanced analytics

### Phase 4 (Month 7-12)

- [ ] White-label options
- [ ] Enterprise SSO
- [ ] On-premise deployment
- [ ] Custom model training
- [ ] Dedicated support SLA

---

## Appendix

### A. Environment Variables

Add to `.env`:

```bash
# Stripe (for billing)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Cron protection
CRON_SECRET=your_random_secret_here

# Alert emails
ALERT_EMAIL=your_email@domain.com
RESEND_API_KEY=re_xxx
```

### B. Prisma Schema Summary

```prisma
model UserUsage {
  id                    String   @id @default(cuid())
  userId                String   @unique
  plan                  UserPlan @default(FREE)
  currentPeriodStart    DateTime @default(now())
  currentPeriodEnd      DateTime
  generationsThisMonth  Int      @default(0)
  lastGenerationAt      DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([currentPeriodEnd])
}

enum UserPlan {
  FREE
  BUILDER
  PRO
  UNLIMITED
}
```

### C. API Endpoints Summary

| Endpoint                      | Method | Purpose                           |
| ----------------------------- | ------ | --------------------------------- |
| `/api/usage`                  | GET    | Get user usage stats              |
| `/api/projects`               | POST   | Create project (checks limit)     |
| `/api/generate`               | POST   | Generate code (checks limit)      |
| `/api/cron/cleanup-sandboxes` | GET    | Cleanup stale E2B sandboxes       |
| `/api/cron/cost-alerts`       | GET    | Send cost alert emails            |
| `/api/webhooks/stripe`        | POST   | Handle Stripe subscription events |

---

## Conclusion

This implementation guide provides a complete roadmap for implementing sustainable pricing with:

- ✅ **4-tier structure** (Starter/Builder/Pro/Unlimited)
- ✅ **Haiku-first architecture** (85% cost reduction)
- ✅ **Project-based limits** (controls E2B costs)
- ✅ **Simple monthly tracking** (no session limits)
- ✅ **Break-even economics** (50-84% margins)

Follow this guide step-by-step, test thoroughly, and monitor closely post-launch. Adjust based on real usage data.

**Remember:** Start conservative, iterate based on data, prioritize sustainability over growth in the first 3 months.

Good luck! 🚀
