/**
 * Server-Side Analytics Tracking
 *
 * Helper functions for tracking analytics events from the server side (tRPC routers, API routes, etc.)
 * Uses PostHog Node.js client for server-side event tracking.
 */

import PostHogClient from './posthog';
import type {
  UserProperties,
  ProjectCreatedProps,
  AIGenerationStartedProps,
  AIGenerationCompletedProps,
  AIGenerationFailedProps,
  UsageLimitHitProps,
  RateLimitHitProps,
  GitHubConnectedProps,
} from './events';
import {
  ProjectEvents,
  AIGenerationEvents,
  UsageLimitEvents,
  GitHubEvents,
} from './events';

/**
 * Identify a user on the server side
 */
export function identifyUserServer(
  userId: string,
  properties?: UserProperties
) {
  const client = PostHogClient();
  client.identify({
    distinctId: userId,
    properties,
  });
}

/**
 * Track a generic event on the server side
 */
export function trackEventServer(
  userId: string,
  eventName: string,
  properties?: Record<string, unknown>
) {
  const client = PostHogClient();
  client.capture({
    distinctId: userId,
    event: eventName,
    properties,
  });
}

// ============================================================================
// P0 Events - Server-Side Tracking
// ============================================================================

/**
 * Track project created event (server-side)
 */
export function trackProjectCreatedServer(
  userId: string,
  properties: ProjectCreatedProps
) {
  const client = PostHogClient();
  client.capture({
    distinctId: userId,
    event: ProjectEvents.PROJECT_CREATED,
    properties,
  });
}

/**
 * Track AI generation started event (server-side)
 */
export function trackAIGenerationStartedServer(
  userId: string,
  properties: AIGenerationStartedProps
) {
  const client = PostHogClient();
  client.capture({
    distinctId: userId,
    event: AIGenerationEvents.AI_GENERATION_STARTED,
    properties,
  });
}

/**
 * Track AI generation completed event (server-side)
 */
export function trackAIGenerationCompletedServer(
  userId: string,
  properties: AIGenerationCompletedProps
) {
  const client = PostHogClient();
  client.capture({
    distinctId: userId,
    event: AIGenerationEvents.AI_GENERATION_COMPLETED,
    properties,
  });
}

/**
 * Track AI generation failed event (server-side)
 */
export function trackAIGenerationFailedServer(
  userId: string,
  properties: AIGenerationFailedProps
) {
  const client = PostHogClient();
  client.capture({
    distinctId: userId,
    event: AIGenerationEvents.AI_GENERATION_FAILED,
    properties,
  });
}

/**
 * Track usage limit hit event (server-side)
 */
export function trackUsageLimitHitServer(
  userId: string,
  properties: UsageLimitHitProps
) {
  const client = PostHogClient();
  client.capture({
    distinctId: userId,
    event: UsageLimitEvents.USAGE_LIMIT_HIT,
    properties,
  });
}

/**
 * Track rate limit hit event (server-side)
 */
export function trackRateLimitHitServer(
  userId: string,
  properties: RateLimitHitProps
) {
  const client = PostHogClient();
  client.capture({
    distinctId: userId,
    event: UsageLimitEvents.RATE_LIMIT_HIT,
    properties,
  });
}

/**
 * Track GitHub connected event (server-side)
 */
export function trackGitHubConnectedServer(
  userId: string,
  properties: GitHubConnectedProps
) {
  const client = PostHogClient();
  client.capture({
    distinctId: userId,
    event: GitHubEvents.GITHUB_CONNECTED,
    properties,
  });
}
