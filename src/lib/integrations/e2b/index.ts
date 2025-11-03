export { e2bClient } from './client';
export { E2B_CONFIG, SANDBOX_TIMEOUTS, FEATURE_FLAGS } from './config';
export * from './types';
export * from './errors';
export { sandboxManager } from './services/sandbox-manager';

export { FileSync } from './services/file-sync';
export { FileValidator } from './utils/file-validator';
export { ConflictResolver } from './utils/conflict-resolver';
export type { ValidationResult } from './utils/file-validator';
export type { ConflictResolution } from './utils/conflict-resolver';

export {
  startPreviewServer,
  stopPreviewServer,
  restartPreviewServer,
  getPreviewLogs,
} from './services/preview-manager';
export {
  detectFramework,
  getFrameworkPort,
  getFrameworkCommand,
} from './utils/framework-detector';
