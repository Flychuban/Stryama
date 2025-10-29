import type { Sandbox as E2BSandbox } from '@e2b/code-interpreter';

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
