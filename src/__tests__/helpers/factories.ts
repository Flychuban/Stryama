import { faker } from '@faker-js/faker';
import type { UserPlan, SandboxStatus, FeedbackType } from '@prisma/client';

/**
 * Test data factories for creating mock database records
 * These follow the Factory pattern to create consistent test data
 */

/**
 * Factory for UserUsage records
 */
export const userUsageFactory = {
  create: (
    overrides: Partial<{
      id: string;
      clerkUserId: string;
      plan: UserPlan;
      generationsThisMonth: number;
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      lastGenerationAt: Date | null;
    }> = {}
  ) => ({
    id: overrides.id ?? faker.string.uuid(),
    clerkUserId: overrides.clerkUserId ?? faker.string.uuid(),
    plan: overrides.plan ?? ('FREE' as UserPlan),
    generationsThisMonth: overrides.generationsThisMonth ?? 0,
    currentPeriodStart: overrides.currentPeriodStart ?? new Date(),
    currentPeriodEnd:
      overrides.currentPeriodEnd ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastGenerationAt: overrides.lastGenerationAt ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

/**
 * Factory for Project records
 */
export const projectFactory = {
  create: (
    overrides: Partial<{
      id: string;
      name: string;
      clerkUserId: string;
      createdAt: Date;
      updatedAt: Date;
    }> = {}
  ) => ({
    id: overrides.id ?? faker.string.uuid(),
    name: overrides.name ?? faker.lorem.words(3),
    clerkUserId: overrides.clerkUserId ?? faker.string.uuid(),
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  }),
};

/**
 * Factory for File records
 */
export const fileFactory = {
  create: (
    overrides: Partial<{
      id: string;
      path: string;
      content: string;
      language: string | null;
      projectId: string;
    }> = {}
  ) => ({
    id: overrides.id ?? faker.string.uuid(),
    path: overrides.path ?? `src/${faker.system.fileName()}`,
    content: overrides.content ?? faker.lorem.paragraphs(3),
    language: overrides.language ?? 'typescript',
    projectId: overrides.projectId ?? faker.string.uuid(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

/**
 * Factory for AIGeneration records
 */
export const aiGenerationFactory = {
  create: (
    overrides: Partial<{
      id: string;
      prompt: string;
      response: string;
      tokens: number | null;
      duration: number | null;
      model: string | null;
      clerkUserId: string;
      projectId: string | null;
      sessionId: string | null;
      totalCost: number | null;
    }> = {}
  ) => ({
    id: overrides.id ?? faker.string.uuid(),
    prompt: overrides.prompt ?? faker.lorem.sentence(),
    response: overrides.response ?? '',
    tokens: overrides.tokens ?? null,
    duration: overrides.duration ?? null,
    model: overrides.model ?? null,
    clerkUserId: overrides.clerkUserId ?? faker.string.uuid(),
    projectId: overrides.projectId ?? null,
    sessionId: overrides.sessionId ?? null,
    sessionData: null,
    totalCost: overrides.totalCost ?? null,
    createdAt: new Date(),
  }),
};

/**
 * Factory for Sandbox records
 */
export const sandboxFactory = {
  create: (
    overrides: Partial<{
      id: string;
      e2bId: string;
      status: SandboxStatus;
      clerkUserId: string;
      projectId: string | null;
    }> = {}
  ) => ({
    id: overrides.id ?? faker.string.uuid(),
    e2bId: overrides.e2bId ?? `sandbox_${faker.string.alphanumeric(10)}`,
    status: overrides.status ?? ('ACTIVE' as SandboxStatus),
    clerkUserId: overrides.clerkUserId ?? faker.string.uuid(),
    projectId: overrides.projectId ?? null,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

/**
 * Factory for Feedback records
 */
export const feedbackFactory = {
  create: (
    overrides: Partial<{
      id: string;
      type: FeedbackType;
      message: string;
      clerkUserId: string;
    }> = {}
  ) => ({
    id: overrides.id ?? faker.string.uuid(),
    type: overrides.type ?? ('GENERAL_FEEDBACK' as FeedbackType),
    message: overrides.message ?? faker.lorem.paragraph(),
    clerkUserId: overrides.clerkUserId ?? faker.string.uuid(),
    status: 'OPEN',
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

/**
 * Helper to create multiple records
 */
export function createMany<T>(
  factory: { create: (overrides?: Record<string, unknown>) => T },
  count: number,
  overrides?: Record<string, unknown>
): T[] {
  return Array.from({ length: count }, () => factory.create(overrides));
}
