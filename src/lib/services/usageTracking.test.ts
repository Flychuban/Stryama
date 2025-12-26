/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsageTrackingService } from './usageTracking';
import { prismaMock, resetDb } from '~/__tests__/helpers/db';
import { userUsageFactory } from '~/__tests__/helpers/factories';
import type { UserPlan } from '~/types/pricing';
import { PLAN_LIMITS } from '~/types/pricing';

// Mock Clerk authorization
vi.mock('~/lib/clerk/authorization', () => ({
  getUserPlanFromClerk: vi.fn(() => Promise.resolve('FREE' as UserPlan)),
}));

describe('UsageTrackingService', () => {
  const testUserId = 'user_test123';

  beforeEach(() => {
    resetDb();
    vi.clearAllMocks();
  });

  describe('checkGenerationLimit', () => {
    it('should allow generation when under limit', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 5, // Under limit of 15
          currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        })
      );

      // Act & Assert
      await expect(
        UsageTrackingService.checkGenerationLimit(testUserId)
      ).resolves.not.toThrow();
    });

    it('should throw error when FREE plan limit exceeded', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 15, // At limit of 15
          currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        })
      );

      // Act & Assert
      await expect(
        UsageTrackingService.checkGenerationLimit(testUserId)
      ).rejects.toThrow(/Generation limit reached/);
      await expect(
        UsageTrackingService.checkGenerationLimit(testUserId)
      ).rejects.toThrow(/15\/15/);
    });

    it('should throw error when BUILDER plan limit exceeded', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('BUILDER');

      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'BUILDER',
          generationsThisMonth: 100, // At limit of 100
          currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        })
      );

      // Act & Assert
      await expect(
        UsageTrackingService.checkGenerationLimit(testUserId)
      ).rejects.toThrow(/Generation limit reached/);
      await expect(
        UsageTrackingService.checkGenerationLimit(testUserId)
      ).rejects.toThrow(/100\/100/);
    });

    it('should throw error when PRO plan limit exceeded', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('PRO');

      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'PRO',
          generationsThisMonth: 350, // At limit of 350
          currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        })
      );

      // Act & Assert
      await expect(
        UsageTrackingService.checkGenerationLimit(testUserId)
      ).rejects.toThrow(/Generation limit reached/);
    });

    it('should reset period and allow generation when period has expired', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      const expiredDate = new Date(Date.now() - 1000); // 1 second ago
      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 15, // At limit, but period expired
          currentPeriodEnd: expiredDate,
        })
      );

      prismaMock.userUsage.update.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 0,
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })
      );

      // Act
      await UsageTrackingService.checkGenerationLimit(testUserId);

      // Assert
      expect(prismaMock.userUsage.update).toHaveBeenCalledWith({
        where: { clerkUserId: testUserId },
        data: expect.objectContaining({
          generationsThisMonth: 0,
        }),
      });
    });

    it('should handle boundary condition - exactly at limit', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 15, // Exactly at limit
          currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        })
      );

      // Act & Assert
      await expect(
        UsageTrackingService.checkGenerationLimit(testUserId)
      ).rejects.toThrow();
    });

    it('should handle boundary condition - one under limit', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 14, // One under limit
          currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        })
      );

      // Act & Assert
      await expect(
        UsageTrackingService.checkGenerationLimit(testUserId)
      ).resolves.not.toThrow();
    });
  });

  describe('incrementGenerationCount', () => {
    it('should increment generation count and update timestamp', async () => {
      // Arrange
      prismaMock.userUsage.update.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          generationsThisMonth: 6,
          lastGenerationAt: new Date(),
        })
      );

      // Act
      await UsageTrackingService.incrementGenerationCount(testUserId);

      // Assert
      expect(prismaMock.userUsage.update).toHaveBeenCalledWith({
        where: { clerkUserId: testUserId },
        data: {
          generationsThisMonth: { increment: 1 },
          lastGenerationAt: expect.any(Date),
        },
      });
    });

    it('should use database increment for atomic operation', async () => {
      // Arrange
      prismaMock.userUsage.update.mockResolvedValue(
        userUsageFactory.create({ clerkUserId: testUserId })
      );

      // Act
      await UsageTrackingService.incrementGenerationCount(testUserId);

      // Assert - Verify it uses { increment: 1 } not hardcoded value
      expect(prismaMock.userUsage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            generationsThisMonth: { increment: 1 },
          }),
        })
      );
    });
  });

  describe('checkProjectLimit', () => {
    it('should allow project creation when under limit for FREE plan', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      prismaMock.project.count.mockResolvedValue(0); // Under limit of 1

      // Act & Assert
      await expect(
        UsageTrackingService.checkProjectLimit(testUserId)
      ).resolves.not.toThrow();
    });

    it('should throw error when FREE plan project limit exceeded', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      prismaMock.project.count.mockResolvedValue(1); // At limit of 1

      // Act & Assert
      await expect(
        UsageTrackingService.checkProjectLimit(testUserId)
      ).rejects.toThrow(/Project limit reached/);
      await expect(
        UsageTrackingService.checkProjectLimit(testUserId)
      ).rejects.toThrow(/1\/1/);
    });

    it('should allow more projects for BUILDER plan', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('BUILDER');

      prismaMock.project.count.mockResolvedValue(4); // Under limit of 5

      // Act & Assert
      await expect(
        UsageTrackingService.checkProjectLimit(testUserId)
      ).resolves.not.toThrow();
    });

    it('should allow PRO plan users to have 20 projects', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('PRO');

      prismaMock.project.count.mockResolvedValue(19); // Under limit of 20

      // Act & Assert
      await expect(
        UsageTrackingService.checkProjectLimit(testUserId)
      ).resolves.not.toThrow();
    });
  });

  describe('getUserUsage', () => {
    it('should return existing usage record', async () => {
      // Arrange
      const existingUsage = userUsageFactory.create({
        clerkUserId: testUserId,
        plan: 'FREE',
        generationsThisMonth: 5,
      });
      prismaMock.userUsage.findUnique.mockResolvedValue(existingUsage);

      // Act
      const result = await UsageTrackingService.getUserUsage(testUserId);

      // Assert
      expect(result).toEqual(existingUsage);
      expect(prismaMock.userUsage.findUnique).toHaveBeenCalledWith({
        where: { clerkUserId: testUserId },
      });
    });

    it('should create new usage record for new user', async () => {
      // Arrange
      prismaMock.userUsage.findUnique.mockResolvedValue(null);
      const newUsage = userUsageFactory.create({
        clerkUserId: testUserId,
        plan: 'FREE',
        generationsThisMonth: 0,
      });
      prismaMock.userUsage.create.mockResolvedValue(newUsage);

      // Act
      const result = await UsageTrackingService.getUserUsage(testUserId);

      // Assert
      expect(prismaMock.userUsage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 0,
        }),
      });
      expect(result).toEqual(newUsage);
    });
  });

  describe('resetBillingPeriod', () => {
    it('should reset generation count and update period dates', async () => {
      // Arrange
      prismaMock.userUsage.update.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          generationsThisMonth: 0,
        })
      );

      // Act
      await UsageTrackingService.resetBillingPeriod(testUserId);

      // Assert
      expect(prismaMock.userUsage.update).toHaveBeenCalledWith({
        where: { clerkUserId: testUserId },
        data: expect.objectContaining({
          generationsThisMonth: 0,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        }),
      });
    });
  });

  describe('getNextBillingDate', () => {
    it('should return date one month in the future', () => {
      // Arrange
      const startDate = new Date('2025-01-15');

      // Act
      const result = UsageTrackingService.getNextBillingDate(startDate);

      // Assert
      expect(result.getMonth()).toBe(1); // February (0-indexed)
      expect(result.getDate()).toBe(15); // Same day
      expect(result.getFullYear()).toBe(2025);
    });

    it('should handle month rollover correctly', () => {
      // Arrange
      const startDate = new Date('2025-12-15');

      // Act
      const result = UsageTrackingService.getNextBillingDate(startDate);

      // Assert
      expect(result.getMonth()).toBe(0); // January of next year
      expect(result.getFullYear()).toBe(2026);
      expect(result.getDate()).toBe(15);
    });

    it('should handle end-of-month edge case', () => {
      // Arrange - January 31st
      const startDate = new Date('2025-01-31');

      // Act
      const result = UsageTrackingService.getNextBillingDate(startDate);

      // Assert
      // February doesn't have 31 days, JavaScript auto-adjusts
      expect(result.getMonth()).toBe(2); // March (because Feb 31 doesn't exist)
    });
  });

  describe('updateUserPlan', () => {
    it('should update existing user plan', async () => {
      // Arrange
      prismaMock.userUsage.upsert.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'BUILDER',
        })
      );

      // Act
      await UsageTrackingService.updateUserPlan(testUserId, 'BUILDER');

      // Assert
      expect(prismaMock.userUsage.upsert).toHaveBeenCalledWith({
        where: { clerkUserId: testUserId },
        create: expect.objectContaining({
          clerkUserId: testUserId,
          plan: 'BUILDER',
        }),
        update: { plan: 'BUILDER' },
      });
    });
  });

  describe('getUsageStats', () => {
    it('should return comprehensive usage statistics', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      const currentPeriodEnd = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 7,
          currentPeriodEnd,
        })
      );
      prismaMock.project.count.mockResolvedValue(0);

      // Act
      const result = await UsageTrackingService.getUsageStats(testUserId);

      // Assert
      expect(result).toMatchObject({
        plan: 'FREE',
        generationsUsed: 7,
        generationsLimit: 15,
        generationsRemaining: 8,
        projectsUsed: 0,
        projectsLimit: 1,
        daysUntilReset: 5,
      });
      expect(result.percentageUsed).toBeCloseTo(46.67, 1);
    });

    it('should show 0 remaining when at limit', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 15,
        })
      );
      prismaMock.project.count.mockResolvedValue(1);

      // Act
      const result = await UsageTrackingService.getUsageStats(testUserId);

      // Assert
      expect(result.generationsRemaining).toBe(0);
      expect(result.percentageUsed).toBe(100);
    });

    it('should never show negative remaining', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'FREE',
          generationsThisMonth: 20, // Over limit
        })
      );
      prismaMock.project.count.mockResolvedValue(0);

      // Act
      const result = await UsageTrackingService.getUsageStats(testUserId);

      // Assert
      expect(result.generationsRemaining).toBe(0);
      expect(result.percentageUsed).toBeGreaterThan(100);
    });
  });

  describe('getSandboxLimits', () => {
    it('should return correct sandbox limits for FREE plan', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('FREE');

      // Act
      const result = await UsageTrackingService.getSandboxLimits(testUserId);

      // Assert
      expect(result).toEqual({
        concurrent: PLAN_LIMITS.FREE.e2bConcurrent,
        timeoutSeconds: PLAN_LIMITS.FREE.e2bTimeoutSeconds,
      });
    });
  });

  describe('getSubscriptionDetails', () => {
    it('should return subscription details with period info', async () => {
      // Arrange
      const { getUserPlanFromClerk } = await import(
        '~/lib/clerk/authorization'
      );
      vi.mocked(getUserPlanFromClerk).mockResolvedValue('BUILDER');

      const periodStart = new Date('2025-01-01');
      const periodEnd = new Date('2025-02-01');
      prismaMock.userUsage.findUnique.mockResolvedValue(
        userUsageFactory.create({
          clerkUserId: testUserId,
          plan: 'BUILDER',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        })
      );

      // Act
      const result =
        await UsageTrackingService.getSubscriptionDetails(testUserId);

      // Assert
      expect(result).toMatchObject({
        plan: 'BUILDER',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      });
    });
  });
});
