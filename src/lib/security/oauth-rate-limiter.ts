/**
 * OAuth Rate Limiter
 *
 * Protects OAuth endpoints from abuse and brute-force attacks
 * Uses in-memory storage (acceptable for MVP with single instance)
 *
 * PRODUCTION NOTE: For multi-instance deployments, replace with Redis
 * This follows the same pattern as src/lib/integrations/claude/rateLimiter.ts
 */

export type OAuthRateLimitResult = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly retryAfter?: number; // Seconds until retry allowed
};

type RateLimitData = {
  count: number;
  resetAt: Date;
};

/**
 * OAuth rate limits (per user ID)
 * Conservative limits to prevent abuse while allowing legitimate use
 */
const RATE_LIMITS = {
  // Connect endpoint: 5 requests per 15 minutes
  connect: {
    requestsPerWindow: 5,
    windowSeconds: 900, // 15 minutes
  },
  // Callback endpoint: 10 requests per 15 minutes (slightly higher for retries)
  callback: {
    requestsPerWindow: 10,
    windowSeconds: 900, // 15 minutes
  },
} as const;

/**
 * In-memory storage for rate limit data
 * Maps: "userId:endpoint" => RateLimitData
 *
 * Using globalThis to persist across Next.js hot reloads in development
 */
const getRateLimitStore = () => {
  const globalKey = Symbol.for('stryama.oauth.rateLimitStore');

  if (!(globalThis as Record<symbol, unknown>)[globalKey]) {
    (globalThis as Record<symbol, unknown>)[globalKey] = new Map<
      string,
      RateLimitData
    >();
  }

  return (globalThis as Record<symbol, unknown>)[globalKey] as Map<
    string,
    RateLimitData
  >;
};

const rateLimitStore = getRateLimitStore();

// Clean up expired entries every 15 minutes
setInterval(() => {
  const now = new Date();
  for (const [key, data] of rateLimitStore.entries()) {
    if (data.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 900000); // 15 minutes

// Log warning in production about in-memory rate limiting
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  console.warn(
    '[OAuth Rate Limiter] Using in-memory rate limiting - not suitable for multi-instance deployments'
  );
}

/**
 * Check if a request should be rate limited
 *
 * @param userId - The user ID making the request
 * @param endpoint - The endpoint being accessed ('connect' or 'callback')
 * @returns Rate limit result with allowed status and retry info
 */
export function checkOAuthRateLimit(
  userId: string,
  endpoint: 'connect' | 'callback'
): OAuthRateLimitResult {
  const limits = RATE_LIMITS[endpoint];
  const now = new Date();
  const key = `${userId}:${endpoint}`;

  const data = rateLimitStore.get(key);

  if (data && data.resetAt > now) {
    // Window is still active
    if (data.count >= limits.requestsPerWindow) {
      // Rate limit exceeded
      const retryAfter = Math.ceil(
        (data.resetAt.getTime() - now.getTime()) / 1000
      );

      return {
        allowed: false,
        remaining: 0,
        resetAt: data.resetAt,
        retryAfter,
      };
    }

    // Within limits, increment count
    data.count++;

    return {
      allowed: true,
      remaining: limits.requestsPerWindow - data.count,
      resetAt: data.resetAt,
    };
  }

  // No existing window or window expired, create new one
  const resetAt = new Date(Date.now() + limits.windowSeconds * 1000);

  rateLimitStore.set(key, {
    count: 1,
    resetAt,
  });

  return {
    allowed: true,
    remaining: limits.requestsPerWindow - 1,
    resetAt,
  };
}

/**
 * Get current rate limit status without incrementing
 *
 * @param userId - The user ID to check
 * @param endpoint - The endpoint to check
 * @returns Current rate limit status
 */
export function getOAuthRateLimitStatus(
  userId: string,
  endpoint: 'connect' | 'callback'
): OAuthRateLimitResult {
  const limits = RATE_LIMITS[endpoint];
  const now = new Date();
  const key = `${userId}:${endpoint}`;

  const data = rateLimitStore.get(key);

  if (data && data.resetAt > now) {
    const remaining = Math.max(0, limits.requestsPerWindow - data.count);
    const retryAfter =
      remaining === 0
        ? Math.ceil((data.resetAt.getTime() - now.getTime()) / 1000)
        : undefined;

    return {
      allowed: remaining > 0,
      remaining,
      resetAt: data.resetAt,
      retryAfter,
    };
  }

  // No active window
  const resetAt = new Date(Date.now() + limits.windowSeconds * 1000);
  return {
    allowed: true,
    remaining: limits.requestsPerWindow,
    resetAt,
  };
}
