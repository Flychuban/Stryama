/**
 * useStreamHandler - Handles AI stream completion and error effects
 *
 * Manages the side effects of AI streaming: completion handling, database persistence,
 * preview URL updates, and error handling.
 */

import { useEffect, useRef } from 'react';
import { api } from '@/trpc/react';
import { logger } from '@/lib/utils/logger';
import type { StreamState } from '@/hooks/useAIGenerationStream';
import type { Message } from '@/components/editor/ChatPanel';

interface UseStreamHandlerOptions {
  projectId: string | null;
  streamState: StreamState;
  previewUrl: string | null;
  isExpectingPreviewUpdate: boolean;

  // Callbacks
  onMessageAdd: (message: Message) => void;
  onPreviewUrlChange: (url: string | null) => void;
  onPreviewErrorChange: (error: string | null) => void;
  onExpectingPreviewChange: (expecting: boolean) => void;
  onWaitingForViteChange: (waiting: boolean) => void;
  onIframeReload: () => void;
  refetchProject: () => Promise<unknown>;
}

export function useStreamHandler({
  projectId,
  streamState,
  previewUrl,
  isExpectingPreviewUpdate,
  onMessageAdd,
  onPreviewUrlChange,
  onPreviewErrorChange,
  onExpectingPreviewChange,
  onWaitingForViteChange,
  onIframeReload,
  refetchProject,
}: UseStreamHandlerOptions) {
  const utils = api.useUtils();

  // Track which events we've already handled
  const handledCompletionsRef = useRef(new Set<number>());
  const handledErrorsRef = useRef(new Set<string>());
  const handledDatabasePersistRef = useRef(new Set<number>());
  const lastPreviewUpdateRef = useRef(0);

  // Handle streaming completion
  useEffect(() => {
    if (!streamState.isComplete || !streamState.result) return;

    const timestamp = streamState.completionTimestamp;

    if (handledCompletionsRef.current.has(timestamp)) return;
    handledCompletionsRef.current.add(timestamp);

    const result = streamState.result;

    const handleCompletion = async () => {
      logger.debug('[StreamHandler] Handling completion at:', timestamp);

      const aiMessage: Message = {
        role: 'assistant',
        content: result.content ?? "I've generated the code for you!",
        files: result.files?.map((f) => f.path),
      };
      onMessageAdd(aiMessage);

      logger.debug('[StreamHandler] Waiting for database operations...');
    };

    void handleCompletion();
  }, [
    streamState.isComplete,
    streamState.completionTimestamp,
    streamState.result,
    onMessageAdd,
  ]);

  // Wait for database operations to complete before refetching
  useEffect(() => {
    if (!streamState.isDatabasePersisted || !streamState.result) return;
    if (!projectId || !streamState.result.sandboxId) return;

    const timestamp = streamState.databasePersistedTimestamp;

    if (handledDatabasePersistRef.current.has(timestamp)) return;
    handledDatabasePersistRef.current.add(timestamp);

    logger.debug('[StreamHandler] Database persisted at:', timestamp);

    const handleDatabasePersisted = async () => {
      try {
        logger.debug('[StreamHandler] Refetching project with fresh data...');
        await refetchProject();

        await utils.ai.getHistory.invalidate({ projectId });
        logger.debug(
          '[StreamHandler] Project refetched and chat history invalidated'
        );

        logger.debug(
          '[StreamHandler] Waiting for server preview_url_updated event...'
        );
      } catch (error) {
        console.error(
          '[StreamHandler] Failed to update after DB persist',
          error
        );
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unable to start preview server';
        onPreviewErrorChange(
          `${errorMessage}. Try clicking "Regenerate" to restart the preview.`
        );
        onPreviewUrlChange(null);
      }
    };

    void handleDatabasePersisted();
  }, [
    streamState.isDatabasePersisted,
    streamState.databasePersistedTimestamp,
    streamState.result,
    projectId,
    utils,
    refetchProject,
    onPreviewUrlChange,
    onPreviewErrorChange,
  ]);

  // Watch for server's preview_url_updated event
  useEffect(() => {
    const timestamp = streamState.previewUpdateTimestamp;

    if (timestamp === 0) return;
    if (lastPreviewUpdateRef.current === timestamp) return;

    lastPreviewUpdateRef.current = timestamp;

    onExpectingPreviewChange(false);
    onWaitingForViteChange(false);

    logger.debug('[StreamHandler] Server emitted preview_url_updated event');
    logger.debug('[StreamHandler] Preview URL:', streamState.previewUrl);

    if (!streamState.previewUrl) return;

    logger.debug(
      '[StreamHandler] Setting preview URL (server verified healthy):',
      streamState.previewUrl
    );

    onPreviewErrorChange(null);

    if (streamState.previewUrl !== previewUrl) {
      onPreviewUrlChange(streamState.previewUrl);
    }

    if (streamState.skipPreviewReload) {
      logger.debug(
        '[StreamHandler] Skipping iframe reload - Vite HMR will handle updates'
      );
      return;
    }

    logger.debug('[StreamHandler] Reloading iframe with fresh preview...');
    onIframeReload();
  }, [
    streamState.previewUpdateTimestamp,
    streamState.previewUrl,
    streamState.skipPreviewReload,
    previewUrl,
    onPreviewUrlChange,
    onPreviewErrorChange,
    onExpectingPreviewChange,
    onWaitingForViteChange,
    onIframeReload,
  ]);

  // Fallback polling for preview URL
  useEffect(() => {
    if (!streamState.isComplete || !streamState.result) return;
    if (!isExpectingPreviewUpdate) return;
    if (!projectId) return;

    const fallbackDelay = 3000;
    let isCancelled = false;

    console.log('[StreamHandler] Setting up fallback DB polling in 3s...');

    const fallbackTimer = setTimeout(() => {
      if (isCancelled || !isExpectingPreviewUpdate) return;

      console.log(
        '[StreamHandler] Starting fallback DB polling for preview URL...'
      );

      void (async () => {
        for (let attempt = 1; attempt <= 5; attempt++) {
          if (isCancelled) return;

          try {
            logger.debug(
              `[StreamHandler] Fallback poll attempt ${attempt}/5...`
            );

            const previewData = await utils.sandbox.getPreviewUrl.fetch({
              projectId,
            });

            if (isCancelled) return;

            if (previewData.url) {
              logger.debug(
                '[StreamHandler] Found preview URL via fallback:',
                previewData.url
              );
              onPreviewUrlChange(previewData.url);
              onPreviewErrorChange(null);
              onExpectingPreviewChange(false);
              onWaitingForViteChange(false);
              onIframeReload();
              return;
            }

            if (attempt < 5 && !isCancelled) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          } catch (error) {
            if (isCancelled) return;
            console.error('[StreamHandler] Fallback polling error:', error);
          }
        }

        if (isCancelled) return;

        console.warn('[StreamHandler] Fallback polling exhausted');
        onWaitingForViteChange(false);
        onExpectingPreviewChange(false);
        onPreviewErrorChange(
          'Preview server startup timed out. Click "Restart Preview" to try again.'
        );
      })();
    }, fallbackDelay);

    return () => {
      isCancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, [
    streamState.isComplete,
    streamState.result,
    isExpectingPreviewUpdate,
    projectId,
    utils,
    onPreviewUrlChange,
    onPreviewErrorChange,
    onExpectingPreviewChange,
    onWaitingForViteChange,
    onIframeReload,
  ]);

  // Handle streaming errors
  useEffect(() => {
    if (!streamState.hasError || !streamState.error) return;

    const errorKey = `${streamState.error.code}-${streamState.error.message}`;

    if (handledErrorsRef.current.has(errorKey)) return;
    handledErrorsRef.current.add(errorKey);

    onWaitingForViteChange(false);

    const isPreviewError = streamState.error.code.startsWith('PREVIEW_');

    if (isPreviewError) {
      logger.debug(
        '[StreamHandler] Preview error detected, setting preview error state'
      );
      onPreviewErrorChange(streamState.error.message);
    } else {
      logger.debug('[StreamHandler] Generation error detected, adding to chat');
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${streamState.error.message}`,
      };
      onMessageAdd(errorMessage);
    }
  }, [
    streamState.hasError,
    streamState.error,
    onMessageAdd,
    onPreviewErrorChange,
    onWaitingForViteChange,
  ]);
}
