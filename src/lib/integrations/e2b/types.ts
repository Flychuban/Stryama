import type { Sandbox as E2BSandbox } from '@e2b/code-interpreter';
import type { FrameworkType } from '@/lib/integrations/claude/types';

export type SandboxInfo = {
  sandboxId: string;
  templateId: string;
  name: string;
  metadata: Record<string, string>;
  startedAt: string;
  endAt: string;
};

export type SandboxCreateOptions = {
  projectId: string;
  userId: string;
  timeoutMs?: number;
  templateId?: string;
};

export type SandboxInstance = {
  id: string; // Database ID
  e2bId: string; // E2B sandbox ID
  status: string;
  expiresAt: Date | null;
  instance: E2BSandbox; // Actual E2B sandbox instance
};

export enum SandboxLifecycleEvent {
  CREATED = 'CREATED',
  TIMEOUT_EXTENDED = 'TIMEOUT_EXTENDED',
  DESTROYED = 'DESTROYED',
  ERROR = 'ERROR',
}

export type ServiceResult<T> = {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
};

export type SyncResult = {
  readonly totalFiles: number;
  readonly syncedFiles: number;
  readonly failedFiles: readonly FailedFile[];
  readonly duration: number; // milliseconds
  readonly timestamp: Date;
};

export type FailedFile = {
  readonly path: string;
  readonly reason: string;
};

export type SyncMetadata = {
  lastSyncAt: string;
  syncedFiles: readonly string[];
  totalSyncs: number;
  lastSyncResult: 'success' | 'partial' | 'failed';
};

export type PreviewUrl = string;

export type PreviewStatus = 'starting' | 'ready' | 'failed';

export type PreviewConfig = {
  readonly framework: FrameworkType;
  readonly port: number;
  readonly command: string;
};

export type PreviewResult = {
  readonly url: PreviewUrl;
  readonly framework: FrameworkType;
  readonly port: number;
  readonly startTime: Date;
};
