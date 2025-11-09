import { db } from '~/server/db';
import { PLAN_LIMITS, type UserPlan } from '~/types/pricing';

/**
 * Service for tracking and enforcing user usage limits
 * Handles generation limits, project limits, and billing period management
 */
export class UsageTrackingService {
  /**
   * Check if user can make a generation
   * @throws Error if limit exceeded
   */
  static async checkGenerationLimit(userId: string): Promise<void> {
    const usage = await this.getUserUsage(userId);
    const limits = PLAN_LIMITS[usage.plan as UserPlan];

    // Check if billing period has reset
    if (new Date() > usage.currentPeriodEnd) {
      await this.resetBillingPeriod(userId);
      return; // Fresh period, allow generation
    }

    // Check generation limit
    if (usage.generationsThisMonth >= limits.generationsPerMonth) {
      throw new Error(
        `Generation limit reached. You've used ${usage.generationsThisMonth}/${limits.generationsPerMonth} generations this month. Upgrade your plan for more generations.`
      );
    }
  }

  /**
   * Increment generation count after successful generation
   */
  static async incrementGenerationCount(userId: string): Promise<void> {
    await db.userUsage.update({
      where: { clerkUserId: userId },
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
    const limits = PLAN_LIMITS[usage.plan as UserPlan];

    // Count active projects
    const projectCount = await db.project.count({
      where: { clerkUserId: userId },
    });

    if (projectCount >= limits.projectLimit) {
      throw new Error(
        `Project limit reached. You have ${projectCount}/${limits.projectLimit} projects. Delete old projects or upgrade your plan.`
      );
    }
  }

  /**
   * Get user usage data, creating if doesn't exist
   */
  static async getUserUsage(userId: string) {
    const usage = await db.userUsage.findUnique({
      where: { clerkUserId: userId },
    });

    // Create if doesn't exist (new user)
    if (!usage) {
      return await db.userUsage.create({
        data: {
          clerkUserId: userId,
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
    await db.userUsage.update({
      where: { clerkUserId: userId },
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
   * Update user plan (called by billing webhook or admin)
   */
  static async updateUserPlan(userId: string, plan: UserPlan): Promise<void> {
    await db.userUsage.upsert({
      where: { clerkUserId: userId },
      create: {
        clerkUserId: userId,
        plan,
        currentPeriodStart: new Date(),
        currentPeriodEnd: this.getNextBillingDate(new Date()),
        generationsThisMonth: 0,
      },
      update: {
        plan,
      },
    });
  }

  /**
   * Get usage stats for display in UI
   */
  static async getUsageStats(userId: string) {
    const usage = await this.getUserUsage(userId);
    const limits = PLAN_LIMITS[usage.plan as UserPlan];

    const projectCount = await db.project.count({
      where: { clerkUserId: userId },
    });

    const daysUntilReset = Math.ceil(
      (usage.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return {
      plan: usage.plan,
      generationsUsed: usage.generationsThisMonth,
      generationsLimit: limits.generationsPerMonth,
      generationsRemaining: Math.max(
        0,
        limits.generationsPerMonth - usage.generationsThisMonth
      ),
      projectsUsed: projectCount,
      projectsLimit: limits.projectLimit,
      periodEnds: usage.currentPeriodEnd,
      daysUntilReset,
      percentageUsed:
        (usage.generationsThisMonth / limits.generationsPerMonth) * 100,
    };
  }

  /**
   * Get E2B sandbox limits for user's plan
   */
  static async getSandboxLimits(userId: string) {
    const usage = await this.getUserUsage(userId);
    const limits = PLAN_LIMITS[usage.plan as UserPlan];

    return {
      concurrent: limits.e2bConcurrent,
      timeoutSeconds: limits.e2bTimeoutSeconds,
    };
  }
}
