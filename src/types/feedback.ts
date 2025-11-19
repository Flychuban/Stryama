import {
  type Feedback,
  type FeedbackType,
  type FeedbackStatus,
} from '@prisma/client';

/**
 * Feedback metadata interface
 * Stores contextual information captured when feedback is submitted
 */
export interface FeedbackMetadata {
  url?: string;
  projectId?: string;
  userAgent?: string;
  userEmail?: string;
  userPlan?: string;
  submittedAt?: string;
  [key: string]: unknown;
}

/**
 * Re-export Prisma types for convenience
 */
export type { Feedback, FeedbackType, FeedbackStatus };

/**
 * Feedback with typed metadata
 */
export type FeedbackWithMetadata = Omit<Feedback, 'metadata'> & {
  metadata: FeedbackMetadata | null;
};

/**
 * Feedback type labels for UI display
 */
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  BUG_REPORT: 'Bug Report',
  FEATURE_REQUEST: 'Feature Request',
  GENERAL_FEEDBACK: 'General Feedback',
  SUPPORT_REQUEST: 'Support Request',
};

/**
 * Feedback status labels for UI display
 */
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
};

/**
 * Feedback type colors for badges
 */
export const FEEDBACK_TYPE_COLORS: Record<FeedbackType, string> = {
  BUG_REPORT: 'destructive',
  FEATURE_REQUEST: 'default',
  GENERAL_FEEDBACK: 'secondary',
  SUPPORT_REQUEST: 'outline',
};

/**
 * Feedback status colors for badges
 */
export const FEEDBACK_STATUS_COLORS: Record<
  FeedbackStatus,
  { bg: string; text: string }
> = {
  OPEN: { bg: 'bg-red-100', text: 'text-red-800' },
  IN_PROGRESS: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  RESOLVED: { bg: 'bg-green-100', text: 'text-green-800' },
};
