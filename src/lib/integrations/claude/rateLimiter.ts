import { RATE_LIMIT_CONFIG } from './config';

export type UserPlan = 'free' | 'pro' | 'enterprise';

export type RateLimitStatus = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly limit: number;
};

type RateLimitData = {
  count: number;
  resetAt: Date;
};

/**
 * In-memory storage for rate limiting
 * TODO: Replace with Redis for production use
 */
const requestCounts = new Map<string, RateLimitData>();
const dailyCounts = new Map<string, RateLimitData>();

export class RateLimiter {
  async checkRateLimit(
    userId: string,
    plan: UserPlan
  ): Promise<RateLimitStatus> {
    const limits = RATE_LIMIT_CONFIG[plan];
    const now = new Date();

    // Check per-minute limit
    const minuteKey = `${userId}:minute`;
    const minuteData = requestCounts.get(minuteKey);

    if (minuteData && minuteData.resetAt > now) {
      if (minuteData.count >= limits.requestsPerMinute) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: minuteData.resetAt,
          limit: limits.requestsPerMinute,
        };
      }
    }

    // Check daily limit
    const dayKey = `${userId}:day`;
    const dayData = dailyCounts.get(dayKey);

    if (dayData && dayData.resetAt > now) {
      if (dayData.count >= limits.requestsPerDay) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: dayData.resetAt,
          limit: limits.requestsPerDay,
        };
      }
    }

    const remaining = limits.requestsPerMinute - (minuteData?.count ?? 0);

    return {
      allowed: true,
      remaining,
      resetAt: this.getResetTime(60), // 1 minute
      limit: limits.requestsPerMinute,
    };
  }

  async incrementCount(userId: string): Promise<void> {
    const now = new Date();

    // Increment minute count
    const minuteKey = `${userId}:minute`;
    const minuteData = requestCounts.get(minuteKey);

    if (!minuteData || minuteData.resetAt <= now) {
      requestCounts.set(minuteKey, {
        count: 1,
        resetAt: this.getResetTime(60),
      });
    } else {
      minuteData.count++;
    }

    // Increment daily count
    const dayKey = `${userId}:day`;
    const dayData = dailyCounts.get(dayKey);

    if (!dayData || dayData.resetAt <= now) {
      dailyCounts.set(dayKey, {
        count: 1,
        resetAt: this.getResetTime(86400), // 24 hours
      });
    } else {
      dayData.count++;
    }
  }

  private getResetTime(seconds: number): Date {
    return new Date(Date.now() + seconds * 1000);
  }

  async getUsageStats(
    userId: string,
    plan: UserPlan
  ): Promise<{
    readonly minuteCount: number;
    readonly dayCount: number;
    readonly limits: (typeof RATE_LIMIT_CONFIG)[UserPlan];
  }> {
    const now = new Date();
    const limits = RATE_LIMIT_CONFIG[plan];

    const minuteKey = `${userId}:minute`;
    const minuteData = requestCounts.get(minuteKey);
    const minuteCount =
      minuteData && minuteData.resetAt > now ? minuteData.count : 0;

    const dayKey = `${userId}:day`;
    const dayData = dailyCounts.get(dayKey);
    const dayCount = dayData && dayData.resetAt > now ? dayData.count : 0;

    return {
      minuteCount,
      dayCount,
      limits,
    };
  }
}

export const rateLimiter = new RateLimiter();
