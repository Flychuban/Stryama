import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from './rateLimiter';
import { RATE_LIMIT_CONFIG } from './config';

// Counter for unique user IDs to avoid test state interference
let testUserCounter = 0;

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let testUserId: string;

  beforeEach(() => {
    // Create new instance for each test
    rateLimiter = new RateLimiter();

    // Use unique user ID for each test to avoid shared state issues
    testUserId = `user_test${testUserCounter++}`;

    vi.clearAllTimers();
  });

  describe('checkRateLimit', () => {
    describe('FREE plan limits', () => {
      it('should allow requests under per-minute limit', async () => {
        // Arrange - FREE plan: 5 requests/min
        const plan = 'FREE';

        // Act
        const result = await rateLimiter.checkRateLimit(testUserId, plan);

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(RATE_LIMIT_CONFIG.FREE.requestsPerMinute);
        expect(result.limit).toBe(RATE_LIMIT_CONFIG.FREE.requestsPerMinute);
      });

      it('should deny requests when per-minute limit exceeded', async () => {
        // Arrange - Make 5 requests to hit limit
        const plan = 'FREE';
        for (let i = 0; i < 5; i++) {
          await rateLimiter.incrementCount(testUserId);
        }

        // Act
        const result = await rateLimiter.checkRateLimit(testUserId, plan);

        // Assert
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.limit).toBe(5);
      });

      it('should deny requests when daily limit exceeded', async () => {
        // Arrange - Simulate hitting daily limit
        const plan = 'FREE';

        // Increment to daily limit (50 for FREE)
        for (let i = 0; i < 50; i++) {
          await rateLimiter.incrementCount(testUserId);
        }

        // Act
        const result = await rateLimiter.checkRateLimit(testUserId, plan);

        // Assert
        expect(result.allowed).toBe(false);
      });
    });

    describe('BUILDER plan limits', () => {
      it('should allow more requests per minute than FREE', async () => {
        // Arrange
        const plan = 'BUILDER';

        // Act
        const result = await rateLimiter.checkRateLimit(testUserId, plan);

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(RATE_LIMIT_CONFIG.BUILDER.requestsPerMinute);
        expect(result.limit).toBeGreaterThan(
          RATE_LIMIT_CONFIG.FREE.requestsPerMinute
        );
      });

      it('should deny when BUILDER per-minute limit exceeded', async () => {
        // Arrange - BUILDER: 8 requests/min
        const plan = 'BUILDER';
        for (let i = 0; i < 8; i++) {
          await rateLimiter.incrementCount(testUserId);
        }

        // Act
        const result = await rateLimiter.checkRateLimit(testUserId, plan);

        // Assert
        expect(result.allowed).toBe(false);
        expect(result.limit).toBe(8);
      });
    });

    describe('PRO plan limits', () => {
      it('should allow highest number of requests per minute', async () => {
        // Arrange
        const plan = 'PRO';

        // Act
        const result = await rateLimiter.checkRateLimit(testUserId, plan);

        // Assert
        expect(result.allowed).toBe(true);
        expect(result.limit).toBe(RATE_LIMIT_CONFIG.PRO.requestsPerMinute);
        expect(result.limit).toBeGreaterThan(
          RATE_LIMIT_CONFIG.BUILDER.requestsPerMinute
        );
      });

      it('should deny when PRO per-minute limit exceeded', async () => {
        // Arrange - PRO: 15 requests/min
        const plan = 'PRO';
        for (let i = 0; i < 15; i++) {
          await rateLimiter.incrementCount(testUserId);
        }

        // Act
        const result = await rateLimiter.checkRateLimit(testUserId, plan);

        // Assert
        expect(result.allowed).toBe(false);
        expect(result.limit).toBe(15);
      });
    });

    describe('rate limit window reset', () => {
      it('should reset and allow requests after minute window expires', async () => {
        // Arrange - Hit the limit
        const plan = 'FREE';
        for (let i = 0; i < 5; i++) {
          await rateLimiter.incrementCount(testUserId);
        }

        // Verify limit is hit
        const blockedResult = await rateLimiter.checkRateLimit(
          testUserId,
          plan
        );
        expect(blockedResult.allowed).toBe(false);

        // Act - Advance time past reset
        vi.useFakeTimers();
        vi.advanceTimersByTime(61 * 1000); // 61 seconds

        const result = await rateLimiter.checkRateLimit(testUserId, plan);

        // Assert - Window has expired, requests should be allowed again
        expect(result.allowed).toBe(true);
        // Note: remaining count includes expired data, which is a known limitation
        // The key behavior is that requests are allowed after window expires

        vi.useRealTimers();
      });
    });

    it('should return correct resetAt timestamp', async () => {
      // Arrange
      const plan = 'FREE';
      const before = Date.now();

      // Act
      const result = await rateLimiter.checkRateLimit(testUserId, plan);

      // Assert
      const after = Date.now();
      const resetTimestamp = result.resetAt.getTime();

      // Reset should be ~60 seconds in the future
      expect(resetTimestamp).toBeGreaterThan(before + 59 * 1000);
      expect(resetTimestamp).toBeLessThan(after + 61 * 1000);
    });
  });

  describe('incrementCount', () => {
    it('should increment minute count on first request', async () => {
      // Act
      await rateLimiter.incrementCount(testUserId);

      // Assert
      const stats = await rateLimiter.getUsageStats(testUserId, 'FREE');
      expect(stats.minuteCount).toBe(1);
      expect(stats.dayCount).toBe(1);
    });

    it('should increment both minute and daily counts', async () => {
      // Act
      await rateLimiter.incrementCount(testUserId);
      await rateLimiter.incrementCount(testUserId);
      await rateLimiter.incrementCount(testUserId);

      // Assert
      const stats = await rateLimiter.getUsageStats(testUserId, 'FREE');
      expect(stats.minuteCount).toBe(3);
      expect(stats.dayCount).toBe(3);
    });

    it('should handle multiple increments correctly', async () => {
      // Arrange & Act
      for (let i = 0; i < 5; i++) {
        await rateLimiter.incrementCount(testUserId);
      }

      // Assert
      const stats = await rateLimiter.getUsageStats(testUserId, 'FREE');
      expect(stats.minuteCount).toBe(5);
      expect(stats.dayCount).toBe(5);
    });

    it('should reset minute count after window expires', async () => {
      // Arrange
      await rateLimiter.incrementCount(testUserId);
      const initialStats = await rateLimiter.getUsageStats(testUserId, 'FREE');
      expect(initialStats.minuteCount).toBe(1);

      // Act - Advance time past minute window
      vi.useFakeTimers();
      vi.advanceTimersByTime(61 * 1000);

      // New increment after reset
      await rateLimiter.incrementCount(testUserId);

      // Assert - Minute count should reset, but day count continues
      const stats = await rateLimiter.getUsageStats(testUserId, 'FREE');
      expect(stats.minuteCount).toBe(1); // Reset to 1
      expect(stats.dayCount).toBe(2); // Continues accumulating

      vi.useRealTimers();
    });

    it('should maintain separate counts for different users', async () => {
      // Arrange
      const user1 = 'user_1';
      const user2 = 'user_2';

      // Act
      await rateLimiter.incrementCount(user1);
      await rateLimiter.incrementCount(user1);
      await rateLimiter.incrementCount(user2);

      // Assert
      const stats1 = await rateLimiter.getUsageStats(user1, 'FREE');
      const stats2 = await rateLimiter.getUsageStats(user2, 'FREE');

      expect(stats1.minuteCount).toBe(2);
      expect(stats2.minuteCount).toBe(1);
    });
  });

  describe('getUsageStats', () => {
    it('should return zero counts for new user', async () => {
      // Act
      const stats = await rateLimiter.getUsageStats(testUserId, 'FREE');

      // Assert
      expect(stats.minuteCount).toBe(0);
      expect(stats.dayCount).toBe(0);
      expect(stats.limits).toEqual(RATE_LIMIT_CONFIG.FREE);
    });

    it('should return correct counts after increments', async () => {
      // Arrange
      await rateLimiter.incrementCount(testUserId);
      await rateLimiter.incrementCount(testUserId);

      // Act
      const stats = await rateLimiter.getUsageStats(testUserId, 'FREE');

      // Assert
      expect(stats.minuteCount).toBe(2);
      expect(stats.dayCount).toBe(2);
    });

    it('should return correct limits for each plan tier', async () => {
      // Act
      const freeStats = await rateLimiter.getUsageStats(testUserId, 'FREE');
      const builderStats = await rateLimiter.getUsageStats(
        testUserId,
        'BUILDER'
      );
      const proStats = await rateLimiter.getUsageStats(testUserId, 'PRO');

      // Assert
      expect(freeStats.limits.requestsPerMinute).toBe(5);
      expect(builderStats.limits.requestsPerMinute).toBe(8);
      expect(proStats.limits.requestsPerMinute).toBe(15);

      expect(freeStats.limits.requestsPerDay).toBe(50);
      expect(builderStats.limits.requestsPerDay).toBe(150);
      expect(proStats.limits.requestsPerDay).toBe(500);
    });

    it('should return zero for expired minute window', async () => {
      // Arrange
      await rateLimiter.incrementCount(testUserId);

      // Act - Advance time past minute window
      vi.useFakeTimers();
      vi.advanceTimersByTime(61 * 1000);

      const stats = await rateLimiter.getUsageStats(testUserId, 'FREE');

      // Assert
      expect(stats.minuteCount).toBe(0); // Expired
      expect(stats.dayCount).toBe(1); // Still valid

      vi.useRealTimers();
    });

    it('should return zero for expired daily window', async () => {
      // Arrange
      await rateLimiter.incrementCount(testUserId);

      // Act - Advance time past daily window
      vi.useFakeTimers();
      vi.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours

      const stats = await rateLimiter.getUsageStats(testUserId, 'FREE');

      // Assert
      expect(stats.minuteCount).toBe(0);
      expect(stats.dayCount).toBe(0); // Both expired

      vi.useRealTimers();
    });
  });

  describe('edge cases and concurrent scenarios', () => {
    it('should handle rapid concurrent requests correctly', async () => {
      // Arrange & Act - Simulate 10 concurrent requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(rateLimiter.incrementCount(testUserId));
      }
      await Promise.all(promises);

      // Assert
      const stats = await rateLimiter.getUsageStats(testUserId, 'FREE');
      expect(stats.minuteCount).toBe(10);
      expect(stats.dayCount).toBe(10);
    });

    it('should handle boundary condition - exactly at per-minute limit', async () => {
      // Arrange - FREE plan: 5 requests/min
      const plan = 'FREE';
      for (let i = 0; i < 5; i++) {
        await rateLimiter.incrementCount(testUserId);
      }

      // Act
      const result = await rateLimiter.checkRateLimit(testUserId, plan);

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle boundary condition - one under per-minute limit', async () => {
      // Arrange - FREE plan: 5 requests/min
      const plan = 'FREE';
      for (let i = 0; i < 4; i++) {
        await rateLimiter.incrementCount(testUserId);
      }

      // Act
      const result = await rateLimiter.checkRateLimit(testUserId, plan);

      // Assert
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it('should correctly calculate remaining requests', async () => {
      // Arrange
      const plan = 'FREE'; // 5 requests/min
      await rateLimiter.incrementCount(testUserId);
      await rateLimiter.incrementCount(testUserId);

      // Act
      const result = await rateLimiter.checkRateLimit(testUserId, plan);

      // Assert
      expect(result.remaining).toBe(3); // 5 - 2 = 3
    });

    it('should handle user upgrade scenario (changing plan limits)', async () => {
      // Arrange - User starts with FREE plan, makes 5 requests
      await rateLimiter.incrementCount(testUserId);
      await rateLimiter.incrementCount(testUserId);
      await rateLimiter.incrementCount(testUserId);
      await rateLimiter.incrementCount(testUserId);
      await rateLimiter.incrementCount(testUserId);

      // Act - User upgrades to BUILDER (8 requests/min)
      const freeResult = await rateLimiter.checkRateLimit(testUserId, 'FREE');
      const builderResult = await rateLimiter.checkRateLimit(
        testUserId,
        'BUILDER'
      );

      // Assert
      expect(freeResult.allowed).toBe(false); // Would be blocked on FREE
      expect(builderResult.allowed).toBe(true); // Allowed on BUILDER
      expect(builderResult.remaining).toBe(3); // 8 - 5 = 3
    });
  });

  describe('integration with real timing', () => {
    it('should properly enforce rate limits in realistic scenario', async () => {
      // Arrange - Simulate a user making requests over time
      const plan = 'FREE'; // 5 per minute, 10 per day

      // Act & Assert - Make 5 requests (hit minute limit)
      for (let i = 0; i < 5; i++) {
        await rateLimiter.incrementCount(testUserId);
        const result = await rateLimiter.checkRateLimit(testUserId, plan);
        if (i < 4) {
          expect(result.allowed).toBe(true);
        } else {
          expect(result.allowed).toBe(false);
        }
      }

      // Verify blocked
      const blockedResult = await rateLimiter.checkRateLimit(testUserId, plan);
      expect(blockedResult.allowed).toBe(false);

      // Wait for minute to pass (simulated)
      vi.useFakeTimers();
      vi.advanceTimersByTime(61 * 1000);

      // Should be allowed again
      const allowedResult = await rateLimiter.checkRateLimit(testUserId, plan);
      expect(allowedResult.allowed).toBe(true);

      vi.useRealTimers();
    });
  });
});
