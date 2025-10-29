import { Sandbox } from '@e2b/code-interpreter';
import { E2B_CONFIG } from './config';
import { SandboxConnectionError } from './errors';

class E2BClient {
  private static instance: E2BClient;

  private constructor() {
    this.validateApiKey();
  }

  static getInstance(): E2BClient {
    if (!E2BClient.instance) {
      E2BClient.instance = new E2BClient();
    }
    return E2BClient.instance;
  }

  private validateApiKey(): void {
    if (!E2B_CONFIG.apiKey?.startsWith('e2b_')) {
      throw new SandboxConnectionError(
        'Invalid E2B API key. Must start with "e2b_"'
      );
    }
  }

  async createSandbox(options?: {
    timeoutMs?: number;
    metadata?: Record<string, string>;
  }): Promise<Sandbox> {
    try {
      const sandbox = await Sandbox.create({
        timeoutMs: options?.timeoutMs ?? E2B_CONFIG.defaultTimeoutMs,
        metadata: options?.metadata,
      });
      return sandbox;
    } catch (error) {
      throw new SandboxConnectionError('Failed to create E2B sandbox', error);
    }
  }

  async getSandboxInfo(sandbox: Sandbox) {
    return await sandbox.getInfo();
  }

  async setTimeout(sandbox: Sandbox, timeoutMs: number): Promise<void> {
    await sandbox.setTimeout(timeoutMs);
  }

  async killSandbox(sandbox: Sandbox): Promise<void> {
    await sandbox.kill();
  }
}

export const e2bClient = E2BClient.getInstance();
