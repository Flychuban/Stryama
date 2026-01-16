import { createTRPCRouter } from '~/server/api/trpc';
import { lifecycleRouter } from './lifecycle.router';
import { statusRouter } from './status.router';
import { filesRouter } from './files.router';
import { previewRouter } from './preview.router';
import { logsRouter } from './logs.router';

/**
 * Sandbox Router
 *
 * Manages E2B sandbox instances for code execution and preview.
 * Split into focused sub-routers for maintainability:
 *
 * - lifecycle: create, destroy, extend, resume
 * - status: sandbox info and health checks
 * - files: file synchronization
 * - preview: preview server management
 * - logs: log streaming and history
 */
export const sandboxRouter = createTRPCRouter({
  // Lifecycle management
  getOrCreate: lifecycleRouter.getOrCreate,
  destroy: lifecycleRouter.destroy,
  extendTimeout: lifecycleRouter.extendTimeout,
  resume: lifecycleRouter.resume,

  // Status and info
  getStatus: statusRouter.getStatus,
  getInfo: statusRouter.getInfo,
  getProjectStatus: statusRouter.getProjectStatus,

  // File sync
  syncFiles: filesRouter.syncFiles,

  // Preview management
  startPreview: previewRouter.startPreview,
  getPreviewUrl: previewRouter.getPreviewUrl,
  regeneratePreview: previewRouter.regeneratePreview,
  reconnectPreview: previewRouter.reconnectPreview,
  getPreviewLogs: previewRouter.getPreviewLogs,
  restartPreview: previewRouter.restartPreview,

  // Log streaming
  subscribeLogs: logsRouter.subscribeLogs,
  getLogHistory: logsRouter.getLogHistory,
  clearLogs: logsRouter.clearLogs,
  getLogStats: logsRouter.getLogStats,
});
