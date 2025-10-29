import { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from '~/lib/integrations/e2b/utils/debouncer';

export type QueuedUpdate = {
  readonly id: string;
  readonly files: readonly string[];
  readonly timestamp: number;
  readonly status: 'pending' | 'processing' | 'completed' | 'cancelled';
};

type UsePreviewQueueOptions = {
  readonly debounceMs?: number;
  readonly autoCleanupMs?: number;
  readonly onUpdate?: (fileIds: readonly string[]) => Promise<void>;
};

type UsePreviewQueueReturn = {
  readonly queue: readonly QueuedUpdate[];
  readonly queueUpdate: (fileIds: readonly string[]) => void;
  readonly cancelUpdate: (updateId: string) => void;
  readonly clearCompleted: () => void;
  readonly isProcessing: boolean;
  readonly pendingCount: number;
  readonly processingCount: number;
};

export function usePreviewQueue(
  options: UsePreviewQueueOptions = {}
): UsePreviewQueueReturn {
  const { debounceMs = 1000, autoCleanupMs = 5000, onUpdate } = options;

  const [queue, setQueue] = useState<readonly QueuedUpdate[]>([]);
  const updateIdCounter = useRef(0);
  const cleanupTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Process the actual update
  const processUpdate = useCallback(
    async (update: QueuedUpdate) => {
      if (!onUpdate) return;

      try {
        // Mark as processing
        setQueue((prev) =>
          prev.map((item) =>
            item.id === update.id
              ? { ...item, status: 'processing' as const }
              : item
          )
        );

        // Execute the update
        await onUpdate(update.files);

        // Mark as completed
        setQueue((prev) =>
          prev.map((item) =>
            item.id === update.id
              ? { ...item, status: 'completed' as const }
              : item
          )
        );

        // Schedule auto-cleanup
        const timer = setTimeout(() => {
          setQueue((prev) => prev.filter((item) => item.id !== update.id));
          cleanupTimers.current.delete(update.id);
        }, autoCleanupMs);

        cleanupTimers.current.set(update.id, timer);
      } catch (error) {
        console.error('Preview update failed:', error);
        // Mark as cancelled on error
        setQueue((prev) =>
          prev.map((item) =>
            item.id === update.id
              ? { ...item, status: 'cancelled' as const }
              : item
          )
        );
      }
    },
    [onUpdate, autoCleanupMs]
  );

  // Debounced update trigger
  const debouncedProcessUpdate = useRef(
    debounce((...args: unknown[]) => {
      const update = args[0] as QueuedUpdate;
      void processUpdate(update);
    }, debounceMs)
  );

  // Queue a new update
  const queueUpdate = useCallback(
    (fileIds: readonly string[]) => {
      const updateId = `update-${++updateIdCounter.current}`;
      const timestamp = Date.now();

      const newUpdate: QueuedUpdate = {
        id: updateId,
        files: fileIds,
        timestamp,
        status: 'pending',
      };

      setQueue((prev) => {
        // Cancel all pending updates (keep only processing/completed)
        const nonPendingUpdates = prev.map((item) =>
          item.status === 'pending'
            ? { ...item, status: 'cancelled' as const }
            : item
        );

        // Add new update
        return [...nonPendingUpdates, newUpdate];
      });

      // Trigger debounced processing
      debouncedProcessUpdate.current(newUpdate);
    },
    [debounceMs]
  );

  // Cancel a specific update
  const cancelUpdate = useCallback((updateId: string) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === updateId && item.status === 'pending'
          ? { ...item, status: 'cancelled' as const }
          : item
      )
    );

    // Cancel debounce if this was the pending update
    debouncedProcessUpdate.current.cancel();
  }, []);

  // Clear all completed updates
  const clearCompleted = useCallback(() => {
    setQueue((prev) =>
      prev.filter(
        (item) => item.status !== 'completed' && item.status !== 'cancelled'
      )
    );

    // Clear all cleanup timers
    cleanupTimers.current.forEach((timer) => clearTimeout(timer));
    cleanupTimers.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedProcessUpdate.current.cancel();
      cleanupTimers.current.forEach((timer) => clearTimeout(timer));
      cleanupTimers.current.clear();
    };
  }, []);

  // Calculate derived state
  const isProcessing = queue.some((item) => item.status === 'processing');
  const pendingCount = queue.filter((item) => item.status === 'pending').length;
  const processingCount = queue.filter(
    (item) => item.status === 'processing'
  ).length;

  return {
    queue,
    queueUpdate,
    cancelUpdate,
    clearCompleted,
    isProcessing,
    pendingCount,
    processingCount,
  };
}
