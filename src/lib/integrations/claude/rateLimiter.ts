import { RATE_LIMIT_CONFIG } from './config';
import type { UserPlan } from '~/types/pricing';

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
 * PRODUCTION LIMITATION: In-memory rate limiting
 *
 * Current implementation uses Map storage which means:
 * - Rate limits reset on every deployment/server restart
 * - Won't work correctly with multiple server instances
 * - Not suitable for serverless/edge deployments with multiple containers
 *
 * For production at scale, replace with:
 * - Redis (via Upstash/Vercel KV for serverless compatibility)
 * - Or use Clerk's built-in rate limiting features
 *
 * Current setup is acceptable for MVP with single instance deployment.
 * For the initial launch with limited users, this is sufficient.
 */
const requestCounts = new Map<string, RateLimitData>();
const dailyCounts = new Map<string, RateLimitData>();

// Log warning in production about in-memory rate limiting
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  console.warn(
    '[RateLimiter] Using in-memory rate limiting - not suitable for multi-instance deployments'
  );
}

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
