import { PostHog } from 'posthog-node';

// NOTE: This is a Node.js client for sending events from the server side to PostHog.
// Singleton instance to avoid creating multiple clients
let posthogClient: PostHog | null = null;

export default function PostHogClient() {
  // Return existing instance if available
  if (posthogClient) {
    return posthogClient;
  }

  // Check if PostHog is configured
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    console.warn('[PostHog Server] API key not configured');
    // Return a mock client that doesn't do anything
    return {
      capture: () => {
        // No-op: PostHog not configured
      },
      identify: () => {
        // No-op: PostHog not configured
      },
      shutdown: async () => {
        // No-op: PostHog not configured
      },
    } as unknown as PostHog;
  }

  // Create new instance with optimized settings
  posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com',
    flushAt: 20, // Batch 20 events before sending (was 1 - too aggressive)
    flushInterval: 10000, // Or flush every 10 seconds (was 0 - too aggressive)
  });

  return posthogClient;
}

// Graceful shutdown function for serverless environments
export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown();
  }
}
