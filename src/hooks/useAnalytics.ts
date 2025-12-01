/**
 * useAnalytics Hook
 *
 * Type-safe wrapper around PostHog for consistent event tracking.
 * Provides methods to track all P0, P1, and P2 events with full TypeScript support.
 */

import { usePostHog } from 'posthog-js/react';
import { useCallback } from 'react';
import type {
  // P0 Events
  UserSignedUpProps,
  UserSignedInProps,
  UserSignedOutProps,
  AIGenerationStartedProps,
  AIGenerationCompletedProps,
  AIGenerationFailedProps,
  ProjectCreatedProps,
  ProjectOpenedProps,
  ProjectDownloadedProps,
  // P1 Events
  EditorOpenedProps,
  ExamplePromptClickedProps,
  ViewModeChangedProps,
  DeviceModeChangedProps,
  CodeFileViewedProps,
  PreviewLoadedSuccessfullyProps,
  PreviewRegeneratedProps,
  PreviewRestartedProps,
  PreviewFailedProps,
  UsageLimitApproachedProps,
  UsageLimitHitProps,
  RateLimitHitProps,
  // P2 Events
  FeedbackButtonClickedProps,
  FeedbackSubmittedProps,
  // User Properties
  UserProperties,
} from '@/lib/analytics/events';
import {
  AuthEvents,
  AIGenerationEvents,
  ProjectEvents,
  EditorEvents,
  PreviewEvents,
  UsageLimitEvents,
  FeedbackEvents,
} from '@/lib/analytics/events';

export function useAnalytics() {
  const posthog = usePostHog();

  // ============================================================================
  // P0 Events - Critical Launch Metrics
  // ============================================================================

  /**
   * Track user signup event
   */
  const trackUserSignedUp = useCallback(
    (properties: UserSignedUpProps) => {
      posthog?.capture(AuthEvents.USER_SIGNED_UP, properties);
    },
    [posthog]
  );

  /**
   * Track user sign in event
   */
  const trackUserSignedIn = useCallback(
    (properties: UserSignedInProps) => {
      posthog?.capture(AuthEvents.USER_SIGNED_IN, properties);
    },
    [posthog]
  );

  /**
   * Track user sign out event
   */
  const trackUserSignedOut = useCallback(
    (properties: UserSignedOutProps) => {
      posthog?.capture(AuthEvents.USER_SIGNED_OUT, properties);
    },
    [posthog]
  );

  /**
   * Track AI generation started
   */
  const trackAIGenerationStarted = useCallback(
    (properties: AIGenerationStartedProps) => {
      posthog?.capture(AIGenerationEvents.AI_GENERATION_STARTED, properties);
    },
    [posthog]
  );

  /**
   * Track AI generation completed successfully
   */
  const trackAIGenerationCompleted = useCallback(
    (properties: AIGenerationCompletedProps) => {
      posthog?.capture(AIGenerationEvents.AI_GENERATION_COMPLETED, properties);
    },
    [posthog]
  );

  /**
   * Track AI generation failed
   */
  const trackAIGenerationFailed = useCallback(
    (properties: AIGenerationFailedProps) => {
      posthog?.capture(AIGenerationEvents.AI_GENERATION_FAILED, properties);
    },
    [posthog]
  );

  /**
   * Track project created
   */
  const trackProjectCreated = useCallback(
    (properties: ProjectCreatedProps) => {
      posthog?.capture(ProjectEvents.PROJECT_CREATED, properties);
    },
    [posthog]
  );

  /**
   * Track project opened
   */
  const trackProjectOpened = useCallback(
    (properties: ProjectOpenedProps) => {
      posthog?.capture(ProjectEvents.PROJECT_OPENED, properties);
    },
    [posthog]
  );

  /**
   * Track project downloaded
   */
  const trackProjectDownloaded = useCallback(
    (properties: ProjectDownloadedProps) => {
      posthog?.capture(ProjectEvents.PROJECT_DOWNLOADED, properties);
    },
    [posthog]
  );

  // ============================================================================
  // P1 Events - Important Product Insights
  // ============================================================================

  /**
   * Track editor opened
   */
  const trackEditorOpened = useCallback(
    (properties: EditorOpenedProps) => {
      posthog?.capture(EditorEvents.EDITOR_OPENED, properties);
    },
    [posthog]
  );

  /**
   * Track example prompt clicked
   */
  const trackExamplePromptClicked = useCallback(
    (properties: ExamplePromptClickedProps) => {
      posthog?.capture(EditorEvents.EXAMPLE_PROMPT_CLICKED, properties);
    },
    [posthog]
  );

  /**
   * Track view mode changed
   */
  const trackViewModeChanged = useCallback(
    (properties: ViewModeChangedProps) => {
      posthog?.capture(EditorEvents.VIEW_MODE_CHANGED, properties);
    },
    [posthog]
  );

  /**
   * Track device mode changed
   */
  const trackDeviceModeChanged = useCallback(
    (properties: DeviceModeChangedProps) => {
      posthog?.capture(EditorEvents.DEVICE_MODE_CHANGED, properties);
    },
    [posthog]
  );

  /**
   * Track code file viewed
   */
  const trackCodeFileViewed = useCallback(
    (properties: CodeFileViewedProps) => {
      posthog?.capture(EditorEvents.CODE_FILE_VIEWED, properties);
    },
    [posthog]
  );

  /**
   * Track preview loaded successfully
   */
  const trackPreviewLoadedSuccessfully = useCallback(
    (properties: PreviewLoadedSuccessfullyProps) => {
      posthog?.capture(PreviewEvents.PREVIEW_LOADED_SUCCESSFULLY, properties);
    },
    [posthog]
  );

  /**
   * Track preview regenerated
   */
  const trackPreviewRegenerated = useCallback(
    (properties: PreviewRegeneratedProps) => {
      posthog?.capture(PreviewEvents.PREVIEW_REGENERATED, properties);
    },
    [posthog]
  );

  /**
   * Track preview restarted
   */
  const trackPreviewRestarted = useCallback(
    (properties: PreviewRestartedProps) => {
      posthog?.capture(PreviewEvents.PREVIEW_RESTARTED, properties);
    },
    [posthog]
  );

  /**
   * Track preview failed
   */
  const trackPreviewFailed = useCallback(
    (properties: PreviewFailedProps) => {
      posthog?.capture(PreviewEvents.PREVIEW_FAILED, properties);
    },
    [posthog]
  );

  /**
   * Track usage limit approached (80%)
   */
  const trackUsageLimitApproached = useCallback(
    (properties: UsageLimitApproachedProps) => {
      posthog?.capture(UsageLimitEvents.USAGE_LIMIT_APPROACHED, properties);
    },
    [posthog]
  );

  /**
   * Track usage limit hit
   */
  const trackUsageLimitHit = useCallback(
    (properties: UsageLimitHitProps) => {
      posthog?.capture(UsageLimitEvents.USAGE_LIMIT_HIT, properties);
    },
    [posthog]
  );

  /**
   * Track rate limit hit
   */
  const trackRateLimitHit = useCallback(
    (properties: RateLimitHitProps) => {
      posthog?.capture(UsageLimitEvents.RATE_LIMIT_HIT, properties);
    },
    [posthog]
  );

  // ============================================================================
  // P2 Events - Nice-to-Have Analytics
  // ============================================================================

  /**
   * Track feedback button clicked
   */
  const trackFeedbackButtonClicked = useCallback(
    (properties: FeedbackButtonClickedProps) => {
      posthog?.capture(FeedbackEvents.FEEDBACK_BUTTON_CLICKED, properties);
    },
    [posthog]
  );

  /**
   * Track feedback submitted
   */
  const trackFeedbackSubmitted = useCallback(
    (properties: FeedbackSubmittedProps) => {
      posthog?.capture(FeedbackEvents.FEEDBACK_SUBMITTED, properties);
    },
    [posthog]
  );

  // ============================================================================
  // User Identification
  // ============================================================================

  /**
   * Identify a user with PostHog
   */
  const identifyUser = useCallback(
    (userId: string, properties?: UserProperties) => {
      posthog?.identify(userId, properties);
    },
    [posthog]
  );

  /**
   * Reset user identification (on logout)
   */
  const resetUser = useCallback(() => {
    posthog?.reset();
  }, [posthog]);

  /**
   * Update user properties without changing identity
   */
  const setUserProperties = useCallback(
    (properties: UserProperties) => {
      posthog?.setPersonProperties(properties);
    },
    [posthog]
  );

  // ============================================================================
  // Generic Event Tracking
  // ============================================================================

  /**
   * Track a custom event (for events not predefined above)
   */
  const trackEvent = useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      posthog?.capture(eventName, properties);
    },
    [posthog]
  );

  return {
    // P0 - Authentication Events
    trackUserSignedUp,
    trackUserSignedIn,
    trackUserSignedOut,

    // P0 - AI Generation Events
    trackAIGenerationStarted,
    trackAIGenerationCompleted,
    trackAIGenerationFailed,

    // P0 - Project Events
    trackProjectCreated,
    trackProjectOpened,
    trackProjectDownloaded,

    // P1 - Editor Events
    trackEditorOpened,
    trackExamplePromptClicked,
    trackViewModeChanged,
    trackDeviceModeChanged,
    trackCodeFileViewed,

    // P1 - Preview Events
    trackPreviewLoadedSuccessfully,
    trackPreviewRegenerated,
    trackPreviewRestarted,
    trackPreviewFailed,

    // P1 - Usage Limit Events
    trackUsageLimitApproached,
    trackUsageLimitHit,
    trackRateLimitHit,

    // P2 - Feedback Events
    trackFeedbackButtonClicked,
    trackFeedbackSubmitted,

    // User Management
    identifyUser,
    resetUser,
    setUserProperties,

    // Generic
    trackEvent,
  };
}
