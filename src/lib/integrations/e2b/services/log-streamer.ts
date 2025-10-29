import { EventEmitter } from 'events';
import type { Sandbox } from '@e2b/code-interpreter';

export type LogLevel = 'stdout' | 'stderr' | 'info' | 'warn' | 'error';

export type LogEntry = {
  readonly id: string;
  readonly sandboxId: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number; // Unix timestamp in milliseconds
  readonly source?: 'preview' | 'build' | 'install' | 'command';
};

type LogBuffer = {
  readonly entries: LogEntry[];
  readonly maxSize: number;
  readonly createdAt: number;
};

type StreamSubscriber = {
  readonly emitter: EventEmitter;
  readonly createdAt: number;
};

/**
 * Log Streamer Service
 * Manages log streaming for all active sandboxes
 */
class LogStreamerService {
  // In-memory log buffers per sandbox (sandboxId -> LogBuffer)
  private readonly logBuffers = new Map<string, LogBuffer>();

  // Active subscribers per sandbox (sandboxId -> Set<StreamSubscriber>)
  private readonly subscribers = new Map<string, Set<StreamSubscriber>>();

  // Configuration
  private readonly maxBufferSize = 1000; // Keep last 1000 log lines
  private readonly bufferCleanupInterval = 5 * 60 * 1000; // Cleanup every 5 minutes
  private readonly bufferMaxAge = 30 * 60 * 1000; // Delete buffers older than 30 minutes

  private logIdCounter = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Start streaming logs from a sandbox command
   * Captures stdout/stderr and broadcasts to subscribers
   *
   * @param sandboxId - Sandbox ID
   * @param command - Command to execute
   * @param sandbox - E2B Sandbox instance
   * @param source - Source of the logs (preview, build, etc.)
   * @returns Promise that resolves when command completes
   */
  async streamCommand(
    sandboxId: string,
    command: string,
    sandbox: Sandbox,
    source: LogEntry['source'] = 'command'
  ): Promise<void> {
    this.ensureBuffer(sandboxId);

    try {
      await sandbox.commands.run(command, {
        onStdout: (data: { line: string; timestamp: number }) => {
          this.addLog(sandboxId, {
            level: 'stdout',
            message: data.line,
            timestamp: data.timestamp / 1000, // Convert microseconds to milliseconds
            source,
          });
        },
        onStderr: (data: {
          line: string;
          timestamp: number;
          error: boolean;
        }) => {
          this.addLog(sandboxId, {
            level: data.error ? 'error' : 'stderr',
            message: data.line,
            timestamp: data.timestamp / 1000,
            source,
          });
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addLog(sandboxId, {
        level: 'error',
        message: `Command failed: ${errorMessage}`,
        timestamp: Date.now(),
        source,
      });
      throw error;
    }
  }

  /**
   * Add a manual log entry (for system messages, etc.)
   *
   * @param sandboxId - Sandbox ID
   * @param entry - Partial log entry (id, sandboxId, timestamp will be added)
   */
  addLog(sandboxId: string, entry: Omit<LogEntry, 'id' | 'sandboxId'>): void {
    this.ensureBuffer(sandboxId);

    const logEntry: LogEntry = {
      id: `log-${++this.logIdCounter}`,
      sandboxId,
      level: entry.level,
      message: entry.message,
      timestamp: entry.timestamp ?? Date.now(),
      source: entry.source,
    };

    // Add to buffer
    const buffer = this.logBuffers.get(sandboxId);
    if (!buffer) return;

    buffer.entries.push(logEntry);

    // Trim buffer if exceeds max size
    if (buffer.entries.length > buffer.maxSize) {
      buffer.entries.splice(0, buffer.entries.length - buffer.maxSize);
    }

    // Broadcast to all subscribers
    this.broadcast(sandboxId, logEntry);
  }

  /**
   * Subscribe to real-time log updates for a sandbox
   * Returns an async iterator that yields log entries as they arrive
   *
   * @param sandboxId - Sandbox ID
   * @param includeHistory - If true, yields buffered logs first
   * @returns Async iterator of log entries
   */
  async *subscribe(
    sandboxId: string,
    includeHistory = true
  ): AsyncGenerator<LogEntry, void, undefined> {
    this.ensureBuffer(sandboxId);

    const emitter = new EventEmitter();
    const subscriber: StreamSubscriber = {
      emitter,
      createdAt: Date.now(),
    };

    // Add to subscribers
    if (!this.subscribers.has(sandboxId)) {
      this.subscribers.set(sandboxId, new Set());
    }
    this.subscribers.get(sandboxId)!.add(subscriber);

    try {
      // Yield historical logs first if requested
      if (includeHistory) {
        const buffer = this.logBuffers.get(sandboxId);
        if (buffer) {
          for (const entry of buffer.entries) {
            yield entry;
          }
        }
      }

      // Yield new logs as they arrive
      while (true) {
        const entry = await new Promise<LogEntry | null>((resolve) => {
          emitter.once('log', resolve);
          emitter.once('end', () => resolve(null));
        });

        if (entry === null) break;
        yield entry;
      }
    } finally {
      // Cleanup: remove subscriber
      const subs = this.subscribers.get(sandboxId);
      if (subs) {
        subs.delete(subscriber);
        if (subs.size === 0) {
          this.subscribers.delete(sandboxId);
        }
      }
      emitter.removeAllListeners();
    }
  }

  /**
   * Get historical logs for a sandbox
   *
   * @param sandboxId - Sandbox ID
   * @param limit - Maximum number of logs to return (default: 100)
   * @returns Array of log entries (newest first)
   */
  getHistory(sandboxId: string, limit = 100): readonly LogEntry[] {
    const buffer = this.logBuffers.get(sandboxId);
    if (!buffer) return [];

    const entries = buffer.entries.slice();
    return entries.slice(-limit).reverse();
  }

  /**
   * Clear all logs for a sandbox
   *
   * @param sandboxId - Sandbox ID
   */
  clearLogs(sandboxId: string): void {
    const buffer = this.logBuffers.get(sandboxId);
    if (buffer) {
      buffer.entries.length = 0;
    }

    // Notify subscribers that logs were cleared
    this.broadcast(sandboxId, {
      id: `system-${++this.logIdCounter}`,
      sandboxId,
      level: 'info',
      message: '[System] Logs cleared',
      timestamp: Date.now(),
      source: 'command',
    });
  }

  /**
   * Stop streaming and cleanup resources for a sandbox
   *
   * @param sandboxId - Sandbox ID
   */
  stopStreaming(sandboxId: string): void {
    // End all subscriptions
    const subs = this.subscribers.get(sandboxId);
    if (subs) {
      for (const subscriber of subs) {
        subscriber.emitter.emit('end');
      }
      this.subscribers.delete(sandboxId);
    }

    // Remove log buffer
    this.logBuffers.delete(sandboxId);
  }

  /**
   * Get statistics about active streams
   */
  getStats(): {
    activeBuffers: number;
    activeSubscribers: number;
    totalLogs: number;
  } {
    let totalLogs = 0;
    for (const buffer of this.logBuffers.values()) {
      totalLogs += buffer.entries.length;
    }

    let activeSubscribers = 0;
    for (const subs of this.subscribers.values()) {
      activeSubscribers += subs.size;
    }

    return {
      activeBuffers: this.logBuffers.size,
      activeSubscribers,
      totalLogs,
    };
  }

  /**
   * Cleanup - call this when shutting down
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Stop all streams
    for (const sandboxId of this.logBuffers.keys()) {
      this.stopStreaming(sandboxId);
    }
  }

  // Private methods

  private ensureBuffer(sandboxId: string): void {
    if (!this.logBuffers.has(sandboxId)) {
      this.logBuffers.set(sandboxId, {
        entries: [],
        maxSize: this.maxBufferSize,
        createdAt: Date.now(),
      });
    }
  }

  private broadcast(sandboxId: string, entry: LogEntry): void {
    const subs = this.subscribers.get(sandboxId);
    if (!subs) return;

    for (const subscriber of subs) {
      subscriber.emitter.emit('log', entry);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldBuffers();
    }, this.bufferCleanupInterval);
  }

  private cleanupOldBuffers(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [sandboxId, buffer] of this.logBuffers.entries()) {
      // Delete buffers with no active subscribers that are too old
      const hasSubscribers = this.subscribers.has(sandboxId);
      const age = now - buffer.createdAt;

      if (!hasSubscribers && age > this.bufferMaxAge) {
        toDelete.push(sandboxId);
      }
    }

    for (const sandboxId of toDelete) {
      this.stopStreaming(sandboxId);
    }

    if (toDelete.length > 0) {
      console.log(
        `[LogStreamer] Cleaned up ${toDelete.length} old log buffers`
      );
    }
  }
}

// Singleton instance
export const logStreamer = new LogStreamerService();

// Export type for external use
export type { LogStreamerService };
