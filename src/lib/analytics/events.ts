/**
 * PostHog Analytics Event Types and Constants
 *
 * This file defines all analytics events tracked in the application.
 * Events are organized by priority (P0, P1, P2) based on business value.
 */

// ============================================================================
// P0 Events - Critical Launch Metrics
// ============================================================================

/**
 * Authentication & Onboarding Events
 */
export const AuthEvents = {
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
} as const;

export interface UserSignedUpProps {
  signup_method: 'email' | 'oauth' | 'unknown';
  user_id: string;
}

export interface UserSignedInProps {
  login_method: 'email' | 'oauth' | 'unknown';
  user_id: string;
}

export interface UserSignedOutProps {
  session_duration_minutes: number;
}

/**
 * AI Generation Events
 */
export const AIGenerationEvents = {
  AI_GENERATION_STARTED: 'ai_generation_started',
  AI_GENERATION_COMPLETED: 'ai_generation_completed',
  AI_GENERATION_FAILED: 'ai_generation_failed',
} as const;

export interface AIGenerationStartedProps {
  prompt_length: number;
  is_first_generation: boolean;
  has_project_context: boolean;
  project_id: string;
  project_age_minutes?: number;
  session_generation_count: number;
}

export interface AIGenerationCompletedProps {
  duration_ms: number;
  tokens_used: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model_used: string;
  files_generated: number;
  total_file_size_bytes: number;
  sandbox_id?: string;
  session_id: string;
  generation_number: number;
  project_id: string;
}

export interface AIGenerationFailedProps {
  error_code: string;
  error_message: string;
  error_type: 'initialization' | 'streaming' | 'preview' | 'unknown';
  duration_ms: number;
  tokens_used?: number;
  prompt_length: number;
  retry_count?: number;
  project_id?: string;
}

/**
 * Project Management Events
 */
export const ProjectEvents = {
  PROJECT_CREATED: 'project_created',
  PROJECT_OPENED: 'project_opened',
  PROJECT_DOWNLOADED: 'project_downloaded',
} as const;

export interface ProjectCreatedProps {
  creation_source: 'dashboard' | 'landing_page_autostart' | 'editor';
  has_initial_prompt: boolean;
  prompt_length?: number;
  project_id: string;
}

export interface ProjectOpenedProps {
  project_id: string;
  project_age_days: number;
  generation_count: number;
  last_modified_days_ago: number;
}

export interface ProjectDownloadedProps {
  project_id: string;
  file_count: number;
  total_size_kb: number;
  project_age_minutes: number;
  generation_count: number;
  time_from_last_generation_seconds: number;
}

// ============================================================================
// P1 Events - Important Product Insights
// ============================================================================

/**
 * Editor Interaction Events
 */
export const EditorEvents = {
  EDITOR_OPENED: 'editor_opened',
  EXAMPLE_PROMPT_CLICKED: 'example_prompt_clicked',
  VIEW_MODE_CHANGED: 'view_mode_changed',
  DEVICE_MODE_CHANGED: 'device_mode_changed',
  CODE_FILE_VIEWED: 'code_file_viewed',
} as const;

export interface EditorOpenedProps {
  has_project_id: boolean;
  is_autostart: boolean;
  referrer_path?: string;
}

export interface ExamplePromptClickedProps {
  prompt_text: string;
  prompt_category: string;
  is_first_interaction: boolean;
}

export interface ViewModeChangedProps {
  from_mode: 'preview' | 'code';
  to_mode: 'preview' | 'code';
  has_active_generation: boolean;
}

export interface DeviceModeChangedProps {
  from_mode: 'desktop' | 'mobile' | 'tablet';
  to_mode: 'desktop' | 'mobile' | 'tablet';
}

export interface CodeFileViewedProps {
  file_path: string;
  file_extension: string;
  file_size_bytes: number;
  is_first_view: boolean;
}

/**
 * Preview & Sandbox Events
 */
export const PreviewEvents = {
  PREVIEW_LOADED_SUCCESSFULLY: 'preview_loaded_successfully',
  PREVIEW_REGENERATED: 'preview_regenerated',
  PREVIEW_RESTARTED: 'preview_restarted',
  PREVIEW_FAILED: 'preview_failed',
} as const;

export interface PreviewLoadedSuccessfullyProps {
  load_time_ms: number;
  sandbox_id: string;
  is_first_preview: boolean;
}

export interface PreviewRegeneratedProps {
  reason: 'user_initiated' | 'auto_recovery';
  previous_error?: string;
  project_id: string;
}

export interface PreviewRestartedProps {
  sandbox_uptime_minutes: number;
  project_id: string;
}

export interface PreviewFailedProps {
  error_message: string;
  error_type: 'startup' | 'health_check' | 'timeout';
  retry_count: number;
  sandbox_id?: string;
  project_id?: string;
}

/**
 * Usage & Limit Events
 */
export const UsageLimitEvents = {
  USAGE_LIMIT_APPROACHED: 'usage_limit_approached',
  USAGE_LIMIT_HIT: 'usage_limit_hit',
  RATE_LIMIT_HIT: 'rate_limit_hit',
} as const;

export interface UsageLimitApproachedProps {
  plan_type: 'FREE' | 'BUILDER' | 'PRO';
  current_usage: number;
  limit: number;
  percentage_used: number;
}

export interface UsageLimitHitProps {
  plan_type: 'FREE' | 'BUILDER' | 'PRO';
  limit: number;
  attempted_action: string;
}

export interface RateLimitHitProps {
  plan_type: 'FREE' | 'BUILDER' | 'PRO';
  requests_in_window: number;
  limit: number;
  retry_after_seconds: number;
}

// ============================================================================
// P2 Events - Nice-to-Have Analytics
// ============================================================================

/**
 * Feedback Events
 */
export const FeedbackEvents = {
  FEEDBACK_BUTTON_CLICKED: 'feedback_button_clicked',
  FEEDBACK_SUBMITTED: 'feedback_submitted',
} as const;

export interface FeedbackButtonClickedProps {
  page: string;
  has_active_project: boolean;
}

export interface FeedbackSubmittedProps {
  rating?: number;
  has_comment: boolean;
  comment_length: number;
  page: string;
  project_id?: string;
}

// ============================================================================
// User Properties
// ============================================================================

export interface UserProperties {
  email?: string;
  plan_type?: 'FREE' | 'BUILDER' | 'PRO';
  created_at?: string;
  is_beta_tester?: boolean;
  total_projects?: number;
  total_generations?: number;
}

// ============================================================================
// Combined Event Types
// ============================================================================

export const P0Events = {
  ...AuthEvents,
  ...AIGenerationEvents,
  ...ProjectEvents,
} as const;

export const P1Events = {
  ...EditorEvents,
  ...PreviewEvents,
  ...UsageLimitEvents,
} as const;

export const P2Events = {
  ...FeedbackEvents,
} as const;

export const AllEvents = {
  ...P0Events,
  ...P1Events,
  ...P2Events,
} as const;

// Type for all event names
export type EventName = (typeof AllEvents)[keyof typeof AllEvents];

// Type for P0 event names only
export type P0EventName = (typeof P0Events)[keyof typeof P0Events];
