/**
 * useEditorPreview - Manages preview server state and operations
 *
 * Encapsulates preview URL management, regeneration, and restart logic
 */

import { useState, useRef, useCallback } from 'react';
import { api } from '@/trpc/react';
import { logger } from '@/lib/utils/logger';

interface UseEditorPreviewOptions {
  projectId: string | null;
  onRegenerateSuccess?: () => void;
}

interface PreviewState {
  url: string | null;
  error: string | null;
  isGenerating: boolean;
  isRegenerating: boolean;
  isWaitingForVite: boolean;
  iframeKey: number;
}

export function useEditorPreview({
  projectId,
  onRegenerateSuccess,
}: UseEditorPreviewOptions) {
  const [state, setState] = useState<PreviewState>({
    url: null,
    error: null,
    isGenerating: false,
    isRegenerating: false,
    isWaitingForVite: false,
    iframeKey: 0,
  });

  const hasAttemptedRegeneration = useRef(false);

  // tRPC mutations
  const restartPreviewMutation = api.sandbox.restartPreview.useMutation();
  const regeneratePreviewMutation = api.sandbox.regeneratePreview.useMutation();
  const reconnectPreviewMutation = api.sandbox.reconnectPreview.useMutation({
    onError: (error) => {
      logger.error('[EditorPreview] Reconnect preview failed:', error);
    },
  });

  // Set preview URL
  const setPreviewUrl = useCallback((url: string | null) => {
    setState((prev) => ({ ...prev, url, error: url ? null : prev.error }));
  }, []);

  // Set preview error
  const setPreviewError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  // Set waiting for Vite state
  const setIsWaitingForVite = useCallback((waiting: boolean) => {
    setState((prev) => ({ ...prev, isWaitingForVite: waiting }));
  }, []);

  // Increment iframe key to force reload
  const reloadIframe = useCallback(() => {
    setState((prev) => ({ ...prev, iframeKey: prev.iframeKey + 1 }));
  }, []);

  // Handle preview errors
  const handlePreviewError = useCallback(
    (
      error: unknown,
      fallbackMessage: string,
      actionHint = 'Try again or refresh the page.'
    ) => {
      console.error(fallbackMessage, error);
      const errorMessage =
        error instanceof Error ? error.message : fallbackMessage;
      setState((prev) => ({ ...prev, error: `${errorMessage} ${actionHint}` }));
    },
    []
  );

  // Restart preview server
  const handleRestartPreview = useCallback(async () => {
    if (!projectId) return;

    try {
      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      const previewResult = await restartPreviewMutation.mutateAsync({
        projectId,
      });

      setState((prev) => ({
        ...prev,
        url: previewResult.url,
        error: null,
        isGenerating: false,
      }));

      return { success: true, url: previewResult.url };
    } catch (error) {
      handlePreviewError(
        error,
        'Failed to restart preview server',
        'Wait a moment and try again.'
      );
      setState((prev) => ({ ...prev, isGenerating: false }));
      return { success: false, error };
    }
  }, [projectId, restartPreviewMutation, handlePreviewError]);

  // Regenerate preview from database files
  const handleRegeneratePreview = useCallback(async () => {
    if (!projectId) return;

    try {
      setState((prev) => ({ ...prev, isRegenerating: true, error: null }));

      const regenerateResult = await regeneratePreviewMutation.mutateAsync({
        projectId,
      });

      setState((prev) => ({
        ...prev,
        url: regenerateResult.url,
        error: null,
        isRegenerating: false,
      }));

      hasAttemptedRegeneration.current = false;
      onRegenerateSuccess?.();

      return { success: true, url: regenerateResult.url };
    } catch (error) {
      handlePreviewError(
        error,
        'Failed to regenerate preview',
        'Please try again in a moment.'
      );
      setState((prev) => ({ ...prev, isRegenerating: false }));
      return { success: false, error };
    }
  }, [
    projectId,
    regeneratePreviewMutation,
    handlePreviewError,
    onRegenerateSuccess,
  ]);

  // Reconnect to existing sandbox
  const handleReconnectPreview = useCallback(async () => {
    if (!projectId) return { success: false, error: 'No project ID' };

    try {
      setState((prev) => ({ ...prev, isRegenerating: true, error: null }));

      const reconnectResult = await reconnectPreviewMutation.mutateAsync({
        projectId,
      });

      setState((prev) => ({
        ...prev,
        url: reconnectResult.url,
        error: null,
        isRegenerating: false,
      }));

      hasAttemptedRegeneration.current = true;

      logger.debug('[EditorPreview] Warm reconnect successful:', {
        reconnected: reconnectResult.reconnected,
        url: reconnectResult.url,
      });

      return {
        success: true,
        url: reconnectResult.url,
        reconnected: reconnectResult.reconnected,
      };
    } catch (error) {
      logger.warn('[EditorPreview] Reconnect failed:', error);
      setState((prev) => ({ ...prev, isRegenerating: false }));
      return { success: false, error };
    }
  }, [projectId, reconnectPreviewMutation]);

  // Reset regeneration attempt flag
  const resetRegenerationFlag = useCallback(() => {
    hasAttemptedRegeneration.current = false;
  }, []);

  // Check if regeneration has been attempted
  const hasAttemptedRegen = useCallback(() => {
    return hasAttemptedRegeneration.current;
  }, []);

  // Mark regeneration as attempted
  const markRegenerationAttempted = useCallback(() => {
    hasAttemptedRegeneration.current = true;
  }, []);

  return {
    // State
    previewUrl: state.url,
    previewError: state.error,
    isGeneratingPreview: state.isGenerating,
    isRegeneratingPreview: state.isRegenerating,
    isWaitingForVite: state.isWaitingForVite,
    iframeKey: state.iframeKey,

    // Setters
    setPreviewUrl,
    setPreviewError,
    setIsWaitingForVite,
    reloadIframe,

    // Actions
    handleRestartPreview,
    handleRegeneratePreview,
    handleReconnectPreview,
    handlePreviewError,

    // Regeneration tracking
    hasAttemptedRegen,
    markRegenerationAttempted,
    resetRegenerationFlag,
  };
}
