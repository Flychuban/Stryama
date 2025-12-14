'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import { AppHeader } from '@/components/shared/AppHeader';
import { UsageBanner } from '@/components/editor/UsageBanner';
import AILoadingAnimation from '@/components/editor/AILoadingAnimation';
import { useAIGenerationStream } from '@/hooks/useAIGenerationStream';
import { useAnalytics } from '@/hooks/useAnalytics';
import { api } from '@/trpc/react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useEditorLayout } from '@/hooks/useEditorLayout';
import { ChatPanel, type Message } from '@/components/editor/ChatPanel';
import {
  ControlBar,
  type ViewMode,
  type DeviceMode,
} from '@/components/editor/ControlBar';
import { PreviewCodePanel } from '@/components/editor/PreviewCodePanel';
import { MobileEditorTabs } from '@/components/editor/MobileEditorTabs';
import { downloadProjectAsZip } from '@/lib/utils/download-project';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { logger } from '@/lib/utils/logger';

function EditorContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get('id') ?? null;
  const autoStart = searchParams?.get('autoStart') === 'true';
  const githubConnected = searchParams?.get('github_connected');
  const netlifyConnected = searchParams?.get('netlify_connected');

  // Get Clerk auth state to prevent race conditions
  const { isLoaded: isAuthLoaded } = useUser();

  // Analytics hook for tracking events
  const {
    trackAIGenerationStarted,
    trackProjectDownloaded,
    trackProjectOpened,
    trackPreviewRegenerated,
    trackPreviewRestarted,
  } = useAnalytics();

  // Track session generation count for analytics
  const sessionGenerationCount = useRef(0);

  // Track if we've already tracked the project being opened
  const hasTrackedProjectOpen = useRef(false);

  // Fetch project data if ID is provided - GUARD with auth state to prevent 401 race conditions
  const {
    data: project,
    isLoading: isLoadingProject,
    refetch: refetchProject,
  } = api.project.getById.useQuery(
    { id: projectId! },
    { enabled: !!projectId && isAuthLoaded }
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isRegeneratingPreview, setIsRegeneratingPreview] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isWaitingForVite, setIsWaitingForVite] = useState(false);
  const [isExpectingPreviewUpdate, setIsExpectingPreviewUpdate] =
    useState(false);
  const [githubConnectionSuccess, setGithubConnectionSuccess] = useState(false);
  const [netlifyConnectionSuccess, setNetlifyConnectionSuccess] =
    useState(false);

  // Persist chat panel width in localStorage
  const [chatPanelSize, setChatPanelSize] = useLocalStorage<number>(
    'stryama_chat_panel_width',
    35
  );

  // Track if we've already attempted auto-regeneration to prevent infinite loops
  const hasAttemptedRegeneration = useRef(false);

  // Track if we've already triggered auto-start to prevent duplicate execution
  const hasTriggeredAutoStart = useRef(false);

  // Track which generations we've already handled to prevent duplicate processing
  // CRITICAL: Use server timestamps (numbers) for deduplication, not Date.now()
  // Server timestamps are unique per event and work correctly with session resumption
  const handledCompletionsRef = useRef(new Set<number>());
  const handledErrorsRef = useRef(new Set<string>());
  const handledDatabasePersistRef = useRef(new Set<number>());

  // Track last preview update timestamp to detect server restarts
  const lastPreviewUpdateRef = useRef(0);

  // Ref to iframe for reloading on subsequent prompts
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  // tRPC mutations for E2B sandbox operations
  const restartPreviewMutation = api.sandbox.restartPreview.useMutation();
  const regeneratePreviewMutation = api.sandbox.regeneratePreview.useMutation();
  const reconnectPreviewMutation = api.sandbox.reconnectPreview.useMutation({
    onError: (error) => {
      logger.error('[Editor] Reconnect preview failed:', error);
      // Error handled by try/catch in useEffect
    },
  });

  // Refetch project files after AI generation
  const utils = api.useUtils();

  // AI generation streaming hook - simplified, no callbacks
  const {
    state: streamState,
    startStreaming,
    isStreaming,
  } = useAIGenerationStream({
    projectId: projectId ?? undefined,
    useSandbox: true,
  });

  // Track project opened event when project loads successfully
  useEffect(() => {
    if (
      !project ||
      !projectId ||
      hasTrackedProjectOpen.current ||
      isLoadingProject
    ) {
      return;
    }

    // Calculate project metrics
    const projectAgeDays = Math.floor(
      (Date.now() - new Date(project.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const lastModifiedDays = Math.floor(
      (Date.now() - new Date(project.updatedAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Track the event
    trackProjectOpened({
      project_id: projectId,
      project_age_days: projectAgeDays,
      generation_count: project.files?.length ?? 0, // Approximate by file count
      last_modified_days_ago: lastModifiedDays,
    });

    hasTrackedProjectOpen.current = true;
  }, [project, projectId, isLoadingProject, trackProjectOpened]);

  // Detect GitHub connection success from OAuth return
  useEffect(() => {
    if (githubConnected === 'true') {
      logger.debug('[Editor] GitHub connection success detected');
      setGithubConnectionSuccess(true);

      // Clean URL to prevent re-triggering on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('github_connected');
      window.history.replaceState({}, '', url.toString());
    }
  }, [githubConnected]);

  // Reset flag after it's consumed
  const handleGithubConnectionConsumed = () => {
    setGithubConnectionSuccess(false);
  };

  // Detect Netlify connection success from OAuth return
  useEffect(() => {
    if (netlifyConnected === 'true') {
      logger.debug('[Editor] Netlify connection success detected');
      setNetlifyConnectionSuccess(true);

      // Clean URL to prevent re-triggering on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('netlify_connected');
      window.history.replaceState({}, '', url.toString());
    }
  }, [netlifyConnected]);

  // Reset flag after it's consumed
  const handleNetlifyConnectionConsumed = () => {
    setNetlifyConnectionSuccess(false);
  };

  // Handle streaming completion - watch state directly
  useEffect(() => {
    if (!streamState.isComplete || !streamState.result) return;

    const timestamp = streamState.completionTimestamp;

    // CRITICAL: Use server timestamp to prevent duplicate handling
    // This works correctly with session resumption (sessionId is reused but timestamp is unique)
    if (handledCompletionsRef.current.has(timestamp)) {
      return;
    }

    // Mark this completion as handled
    handledCompletionsRef.current.add(timestamp);

    const result = streamState.result; // Store in const for type safety

    const handleCompletion = async () => {
      logger.debug('[Editor] 🎯 Handling completion at:', timestamp);

      // Add AI message to chat
      const aiMessage: Message = {
        role: 'assistant',
        content: result.content ?? "I've generated the code for you!",
        files: result.files?.map((f) => f.path),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // NOTE: Refetch and invalidation now happens in separate effect
      // that waits for isDatabasePersisted flag to prevent race condition
      logger.debug(
        '[Editor] ⏳ Waiting for database operations to complete...'
      );
    };

    void handleCompletion();
    // Using server timestamp (completionTimestamp) prevents duplicate executions
  }, [
    streamState.isComplete,
    streamState.completionTimestamp,
    streamState.result,
  ]);

  // Wait for database operations to complete before refetching
  // This prevents race condition where client refetches before files are saved to DB
  useEffect(() => {
    if (!streamState.isDatabasePersisted || !streamState.result) return;
    if (!projectId || !streamState.result.sandboxId) return;

    const timestamp = streamState.databasePersistedTimestamp;

    // CRITICAL: Use server timestamp to prevent duplicate handling
    // This works correctly with session resumption and avoids unstable dependencies
    if (handledDatabasePersistRef.current.has(timestamp)) {
      return;
    }

    // Mark this persist event as handled
    handledDatabasePersistRef.current.add(timestamp);
    logger.debug('[Editor] 💾 Database persisted at:', timestamp);

    const handleDatabasePersisted = async () => {
      try {
        // CRITICAL: Now that database operations are complete, refetch project data
        logger.debug(
          '[Editor] 🔄 Refetching project with fresh data from DB...'
        );
        await refetchProject();

        // Invalidate AI history to refresh chat (project was already refetched above)
        // NOTE: We DON'T invalidate project.getById here to avoid race condition
        // where invalidation triggers project loading effect before messages state updates
        await utils.ai.getHistory.invalidate({ projectId });
        logger.debug(
          '[Editor] ✅ Project refetched and chat history invalidated'
        );

        // CRITICAL FIX: Do NOT fetch or set preview URL here!
        // Setting previewUrl triggers immediate iframe reload BEFORE Vite HMR is ready
        // This causes "Closed Port Error" on subsequent prompts
        // Instead, ONLY set preview URL when we receive preview_url_updated event from server
        // The server validates Vite is ready before emitting that event
        logger.debug(
          '[Editor] ⏳ Waiting for server preview_url_updated event before loading preview...'
        );
      } catch (error) {
        console.error('[Editor] Failed to update after DB persist', error);
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Unable to start preview server';
        setPreviewError(
          `${errorMessage}. Try clicking "Regenerate" to restart the preview.`
        );
        setPreviewUrl(null);
      } finally {
        setIsGeneratingPreview(false);
      }
    };

    void handleDatabasePersisted();
    // Intentionally omit startPreviewMutation from deps - mutation objects are unstable
    // Using server timestamp (databasePersistedTimestamp) prevents duplicate executions
  }, [
    streamState.isDatabasePersisted,
    streamState.databasePersistedTimestamp,
    streamState.result,
    projectId,
    utils,
    refetchProject,
    previewUrl,
  ]);

  // Watch for server's preview_url_updated event and reload iframe
  // This event is emitted when the server starts/restarts the preview server
  // CRITICAL: The server already verifies preview health before emitting this event,
  // so we trust the server's health check and load the preview immediately
  useEffect(() => {
    const timestamp = streamState.previewUpdateTimestamp;

    // Skip if no preview update event yet
    if (timestamp === 0) return;

    // Skip if we've already handled this event
    if (lastPreviewUpdateRef.current === timestamp) return;

    // Mark this event as handled
    lastPreviewUpdateRef.current = timestamp;

    // We received the expected preview update - clear waiting state
    setIsExpectingPreviewUpdate(false);
    setIsWaitingForVite(false);

    logger.debug('[Editor] 🔔 Server emitted preview_url_updated event');
    logger.debug('[Editor] Preview URL:', streamState.previewUrl);
    logger.debug(
      '[Editor] Skip reload:',
      streamState.skipPreviewReload ?? false
    );

    if (!streamState.previewUrl) return;

    // SIMPLIFIED: Trust the server's health check - it already verified preview is ready
    // No redundant client-side polling needed (server validates before emitting event)
    logger.debug(
      '[Editor] ✅ Setting preview URL (server verified healthy):',
      streamState.previewUrl
    );

    // Clear any previous errors
    setPreviewError(null);

    // Set the preview URL
    if (streamState.previewUrl !== previewUrl) {
      setPreviewUrl(streamState.previewUrl);
    }

    // Check if we should skip iframe reload (subsequent prompts with Vite HMR)
    if (streamState.skipPreviewReload) {
      logger.debug(
        '[Editor] ⚡ Skipping iframe reload - Vite HMR will handle updates automatically'
      );
      return;
    }

    // Reload iframe to show the preview (cache-busted via iframeKey)
    logger.debug('[Editor] ✨ Reloading iframe with fresh preview...');
    setIframeKey((prev) => prev + 1);
  }, [
    streamState.previewUpdateTimestamp,
    streamState.previewUrl,
    streamState.skipPreviewReload,
    previewUrl,
  ]);

  // FALLBACK: Poll database for preview URL if stream event was missed
  // This handles cases where tRPC subscription disconnects before receiving preview_url_updated
  // SIMPLIFIED: Uses isExpectingPreviewUpdate flag and trusts the database (no redundant health checks)
  useEffect(() => {
    // Only activate fallback after AI generation completes AND we're still expecting preview
    if (!streamState.isComplete || !streamState.result) return;
    if (!isExpectingPreviewUpdate) return; // Already received preview, no fallback needed
    if (!projectId) return;

    // Short delay - backend adds 500ms buffer before completion, give a bit more time
    const fallbackDelay = 3000; // 3 seconds after completion
    let isCancelled = false;

    console.log(
      '[Editor] ⏰ Setting up fallback DB polling in 3s (stream event may have been missed)...'
    );

    const fallbackTimer = setTimeout(() => {
      // Double-check we still need the fallback
      if (isCancelled || !isExpectingPreviewUpdate) return;

      console.log(
        '[Editor] 🔄 Starting fallback DB polling for preview URL...'
      );

      // Wrap async polling in IIFE to satisfy TypeScript
      void (async () => {
        // Simple polling: 5 attempts × 2s = 10 seconds max
        for (let attempt = 1; attempt <= 5; attempt++) {
          if (isCancelled) return;

          try {
            logger.debug(`[Editor] 📊 Fallback poll attempt ${attempt}/5...`);

            const previewData = await utils.sandbox.getPreviewUrl.fetch({
              projectId,
            });

            if (isCancelled) return;

            if (previewData.url) {
              // SIMPLIFIED: Trust the database - server already verified health before saving
              logger.debug(
                '[Editor] ✅ Found preview URL via fallback:',
                previewData.url
              );
              setPreviewUrl(previewData.url);
              setPreviewError(null);
              setIsExpectingPreviewUpdate(false);
              setIsWaitingForVite(false);
              setIframeKey((prev) => prev + 1);
              return;
            }

            // Wait before next attempt
            if (attempt < 5 && !isCancelled) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          } catch (error) {
            if (isCancelled) return;
            console.error('[Editor] Fallback polling error:', error);
          }
        }

        if (isCancelled) return;

        // All attempts failed
        console.warn('[Editor] ⚠️ Fallback polling exhausted');
        setIsWaitingForVite(false);
        setIsExpectingPreviewUpdate(false);
        setPreviewError(
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
  ]);

  // Mark that we're expecting a preview update when streaming starts
  // This works for BOTH first prompt (no previewUrl) and subsequent prompts
  useEffect(() => {
    // Only act when streaming starts
    if (!streamState.isStreaming) return;

    // CRITICAL FIX: Set expectation flag for ALL prompts (first and subsequent)
    // This ensures the fallback polling and timeout logic works correctly
    logger.debug(
      '[Editor] 🔄 Streaming started - expecting preview update event'
    );
    setIsExpectingPreviewUpdate(true);

    // Only show loading overlay if there's already a preview loaded (2nd+ generation)
    // First generation has no preview to cover with an overlay
    if (previewUrl) {
      logger.debug(
        '[Editor] 🔄 Showing loading overlay to cover existing preview during update'
      );
      setIsWaitingForVite(true);
    }

    // Note: setState functions are intentionally omitted as React guarantees their stability
  }, [streamState.isStreaming, previewUrl]);

  // Auto-reset overlay state after maximum wait time to prevent stuck UI
  // This is a safety net if preview update events are missed or delayed
  useEffect(() => {
    if (!isWaitingForVite) return;

    const maxWaitTime = 45000; // 45 seconds maximum

    logger.debug('[Editor] ⏰ Setting overlay auto-reset timer for 45s...');

    const timeoutId = setTimeout(() => {
      console.warn(
        '[Editor] ⏱️ Overlay auto-reset triggered after 45s timeout'
      );
      setIsWaitingForVite(false);

      // CRITICAL FIX: Show error if we're still expecting a preview update
      // This works correctly for both 1st generation (no previewUrl) and 2nd+ generation (previewUrl exists from previous gen)
      if (isExpectingPreviewUpdate) {
        console.error(
          '[Editor] ⚠️ Preview update timeout - expected preview but did not receive it'
        );
        setPreviewError(
          'Preview server startup is taking longer than expected. Try clicking "Restart Preview" or refresh the page.'
        );
        setIsExpectingPreviewUpdate(false);
      }
    }, maxWaitTime);

    return () => {
      clearTimeout(timeoutId);
    };

    // Note: setState functions (setIsWaitingForVite, setPreviewError, setIsExpectingPreviewUpdate)
    // are intentionally omitted as React guarantees their stability
  }, [isWaitingForVite, isExpectingPreviewUpdate]);

  // Reset overlay when streaming completes or AI generation finishes
  useEffect(() => {
    // Reset when streaming stops (completion or error)
    if (streamState.isStreaming) return;

    // If streaming is done and overlay is still showing, reset it
    if (isWaitingForVite && (streamState.isComplete || streamState.hasError)) {
      logger.debug(
        '[Editor] ✅ Streaming finished, checking if overlay should reset'
      );

      // Give a small delay to allow preview_url_updated event to arrive
      const resetDelay = setTimeout(() => {
        // CRITICAL FIX: Don't reset overlay if we're still expecting a preview update
        // This prevents flickering: overlay disappears at T+2s, reappears at T+10s when fallback starts
        // Instead, keep overlay visible if expecting update - let fallback polling or timeout handle it
        if (isExpectingPreviewUpdate) {
          logger.debug(
            '[Editor] ⏳ Still expecting preview update, keeping overlay visible for fallback polling'
          );
          return;
        }

        logger.debug(
          '[Editor] ✅ Preview received or not expected, resetting overlay'
        );
        setIsWaitingForVite(false);
      }, 2000);

      return () => {
        clearTimeout(resetDelay);
      };
    }

    // Note: setIsWaitingForVite is intentionally omitted as React guarantees its stability
  }, [
    streamState.isStreaming,
    streamState.isComplete,
    streamState.hasError,
    isWaitingForVite,
    isExpectingPreviewUpdate,
  ]);

  // Handle streaming errors - watch state directly
  useEffect(() => {
    if (!streamState.hasError || !streamState.error) return;

    const errorKey = `${streamState.error.code}-${streamState.error.message}`;

    // Prevent duplicate error messages
    if (handledErrorsRef.current.has(errorKey)) {
      return;
    }

    // Mark this error as handled
    handledErrorsRef.current.add(errorKey);

    // CRITICAL: Reset overlay state when streaming errors occur
    // Otherwise overlay stays visible forever if error happens during 2nd+ generation
    setIsWaitingForVite(false);

    // CRITICAL FIX: Differentiate preview errors from generation errors
    // Preview errors should not be added to chat as they're not AI generation failures
    // Error codes: PREVIEW_START_FAILED, PREVIEW_RESTART_FAILED, PREVIEW_START_EXCEPTION, PREVIEW_RESTART_EXCEPTION
    const isPreviewError = streamState.error.code.startsWith('PREVIEW_');

    if (isPreviewError) {
      // Preview-specific error - show in preview panel, not in chat
      logger.debug(
        '[Editor] 📺 Preview error detected, setting preview error state (not adding to chat)'
      );
      setPreviewError(streamState.error.message);
    } else {
      // Actual generation error - add to chat as AI message
      logger.debug('[Editor] 🤖 Generation error detected, adding to chat');
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${streamState.error.message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    // Note: setState functions (setIsWaitingForVite, setPreviewError, setMessages)
    // are intentionally omitted as React guarantees their stability
  }, [streamState.hasError, streamState.error]);

  // Reusable error handler for preview operations
  const handlePreviewError = (
    error: unknown,
    fallbackMessage: string,
    actionHint = 'Try again or refresh the page.'
  ) => {
    console.error(fallbackMessage, error);
    const errorMessage =
      error instanceof Error ? error.message : fallbackMessage;
    setPreviewError(`${errorMessage} ${actionHint}`);
  };

  // Update document title with project name
  useEffect(() => {
    if (project) {
      document.title = `${project.name} - Stryama Editor`;
    }
  }, [project]);

  // Load conversation history and preview URL when project loads (INITIAL LOAD ONLY)
  useEffect(() => {
    if (!projectId) return;

    // Wait for project data to load before attempting anything
    if (isLoadingProject) return;

    // If project doesn't exist, don't proceed
    if (!project) return;

    // CRITICAL FIX: Don't reload messages if already loaded or if streaming is active
    // This prevents the race condition where project invalidation overwrites messages
    if (messages.length > 0 || isStreaming) {
      return;
    }

    // Reset regeneration flag when projectId changes (new project loaded)
    hasAttemptedRegeneration.current = false;

    const loadProjectState = async () => {
      try {
        // Fetch conversation history using utils
        const history = await utils.ai.getHistory.fetch({
          projectId,
          limit: 100,
        });

        // Convert AIGenerations to Message format (reverse to show oldest first)
        const conversationMessages: Message[] = history
          .reverse()
          .flatMap((gen) => [
            { role: 'user' as const, content: gen.prompt },
            { role: 'assistant' as const, content: gen.response ?? '' },
          ]);

        // Only set messages if we still don't have any (avoid race conditions)
        if (messages.length === 0 && !isStreaming) {
          setMessages(conversationMessages);
        }

        // ALWAYS try to fetch preview URL first (even if sandbox expired)
        // This ensures old projects show their preview URL
        const previewData = await utils.sandbox.getPreviewUrl.fetch({
          projectId,
        });

        if (previewData.url) {
          logger.debug(
            '[Editor] Found preview URL for project:',
            previewData.url
          );
          setPreviewUrl(previewData.url);
          setPreviewError(null);
        }

        // Check if project has an active sandbox and if it's expired
        const sandboxStatus = await utils.sandbox.getProjectStatus.fetch({
          projectId,
        });

        // Determine if we should try reconnecting to warm sandbox or regenerate fresh
        let shouldReconnect = false;
        let shouldRegenerate = false;

        if (sandboxStatus.isExpired || !sandboxStatus.hasActiveSandbox) {
          // No active sandbox or expired - need full regeneration
          logger.debug('[Editor] Sandbox expired or not active, regenerating');
          shouldRegenerate = true;
        } else if (!previewData.url) {
          // Has active sandbox but no preview URL - try reconnect first
          logger.debug('[Editor] No preview URL, will try reconnecting');
          shouldReconnect = true;
        } else {
          // Has active sandbox and preview URL - try warm reconnect
          logger.debug(
            '[Editor] Active sandbox with URL, will try reconnecting'
          );
          shouldReconnect = true;
        }

        // Only attempt if project has files AND we haven't attempted yet
        if (project.files?.length && !hasAttemptedRegeneration.current) {
          setIsRegeneratingPreview(true);

          try {
            if (shouldReconnect) {
              // Try warm reconnect first (reuses existing sandbox)
              logger.debug('[Editor] Attempting warm sandbox reconnect...');

              try {
                const reconnectResult =
                  await reconnectPreviewMutation.mutateAsync({
                    projectId,
                  });

                setPreviewUrl(reconnectResult.url);
                setPreviewError(null);
                hasAttemptedRegeneration.current = true;

                logger.debug('[Editor] ✅ Warm reconnect successful:', {
                  reconnected: reconnectResult.reconnected,
                  url: reconnectResult.url,
                });
              } catch (reconnectError) {
                // Reconnect failed - fall back to full regeneration
                logger.warn(
                  '[Editor] ⚠️ Reconnect failed, falling back to regeneration:',
                  reconnectError
                );
                shouldRegenerate = true;
              }
            }

            if (shouldRegenerate) {
              // Full regeneration (destroys old sandbox, creates fresh one)
              logger.debug('[Editor] Performing full sandbox regeneration...');

              const regenerateResult =
                await regeneratePreviewMutation.mutateAsync({
                  projectId,
                });

              setPreviewUrl(regenerateResult.url);
              // Note: Don't set isWaitingForVite here - causes 45s timeout overlay
              // isIframeLoading in PreviewCodePanel handles the loading state
              setPreviewError(null);
              hasAttemptedRegeneration.current = true;
            }
          } catch (error) {
            console.error('[Editor] Failed to load preview:', error);
            handlePreviewError(
              error,
              'Failed to load preview',
              'Click "Regenerate" to try again.'
            );
            // Flag NOT set - allows user to retry manually or on refresh
          } finally {
            setIsRegeneratingPreview(false);
          }
        }

        // Auto-start AI generation if coming from landing page
        if (autoStart && !hasTriggeredAutoStart.current) {
          const initialPrompt = sessionStorage.getItem('initialPrompt');

          if (initialPrompt?.trim()) {
            hasTriggeredAutoStart.current = true;

            // Add user message to chat
            const userMessage: Message = {
              role: 'user',
              content: initialPrompt,
            };
            setMessages((prev) => [...prev, userMessage]);

            // Clear the stored prompt
            sessionStorage.removeItem('initialPrompt');

            // Start AI generation
            startStreaming(initialPrompt);
          }
        }
      } catch (error) {
        console.error('[Editor] Failed to load project state:', error);
      }
    };

    void loadProjectState();
    // IMPORTANT: Removed 'project' from deps to prevent cascading reloads
    // Only run when projectId changes or loading state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isLoadingProject]);

  const handleSend = async () => {
    if (!input.trim() || !projectId) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    const userPrompt = input.trim();
    setInput('');
    setPreviewError(null);

    // Track AI generation started event
    sessionGenerationCount.current += 1;
    trackAIGenerationStarted({
      prompt_length: userPrompt.length,
      is_first_generation: messages.length === 0,
      has_project_context: (project?.files?.length ?? 0) > 0,
      project_id: projectId,
      project_age_minutes: project?.createdAt
        ? Math.floor(
            (Date.now() - new Date(project.createdAt).getTime()) / 60000
          )
        : undefined,
      session_generation_count: sessionGenerationCount.current,
    });

    // Start streaming generation
    startStreaming(userPrompt);
  };

  const handleRestartPreview = async () => {
    if (!projectId) return;

    try {
      setIsGeneratingPreview(true);
      setPreviewError(null);

      const previewResult = await restartPreviewMutation.mutateAsync({
        projectId,
      });

      setPreviewUrl(previewResult.url);
      // Note: Don't set isWaitingForVite here - causes 45s timeout overlay
      // isIframeLoading in PreviewCodePanel handles the loading state
      setPreviewError(null);

      // Track preview restarted event
      trackPreviewRestarted({
        sandbox_uptime_minutes: 0, // TODO: Calculate actual uptime if needed
        project_id: projectId,
      });
    } catch (error) {
      handlePreviewError(
        error,
        'Failed to restart preview server',
        'Wait a moment and try again.'
      );
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handleRegeneratePreview = async () => {
    if (!projectId) return;

    try {
      setIsRegeneratingPreview(true);
      setPreviewError(null);

      const regenerateResult = await regeneratePreviewMutation.mutateAsync({
        projectId,
      });

      setPreviewUrl(regenerateResult.url);
      // Note: Don't set isWaitingForVite here - causes 45s timeout overlay
      // isIframeLoading in PreviewCodePanel handles the loading state
      setPreviewError(null);
      // Reset the flag so user can regenerate again if needed
      hasAttemptedRegeneration.current = false;

      // Track preview regenerated event
      trackPreviewRegenerated({
        reason: 'user_initiated',
        previous_error: previewError ?? undefined,
        project_id: projectId,
      });
    } catch (error) {
      handlePreviewError(
        error,
        'Failed to regenerate preview',
        'Please try again in a moment.'
      );
    } finally {
      setIsRegeneratingPreview(false);
    }
  };

  const handleDownload = async () => {
    if (projectFiles.length === 0) {
      toast.error('No files to download');
      return;
    }

    try {
      await downloadProjectAsZip(projectFiles, project?.name ?? 'project');
      toast.success('Code downloaded successfully');

      // Track project downloaded event - KEY SUCCESS METRIC
      if (project && projectId) {
        const totalSize = projectFiles.reduce(
          (sum, file) => sum + (file.content?.length ?? 0),
          0
        );
        const projectAge = project.createdAt
          ? Math.floor(
              (Date.now() - new Date(project.createdAt).getTime()) / 60000
            )
          : 0;

        trackProjectDownloaded({
          project_id: projectId,
          file_count: projectFiles.length,
          total_size_kb: Math.round(totalSize / 1024),
          project_age_minutes: projectAge,
          generation_count: messages.filter((m) => m.role === 'assistant')
            .length,
          time_from_last_generation_seconds: 0, // TODO: Track this if needed
        });
      }
    } catch (error) {
      console.error('[Editor] Failed to download project:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to download code';
      toast.error(
        `${errorMessage}. Please check your browser settings and try again.`
      );
    }
  };

  // Get files from project or use empty state
  const projectFiles = project?.files ?? [];

  // Use layout hook to determine mobile/desktop
  const { isMobile } = useEditorLayout();

  // Show loading state while Clerk auth is initializing to prevent race conditions
  if (!isAuthLoaded) {
    return <AILoadingAnimation />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background pt-16">
      <AppHeader />
      <UsageBanner />

      {/* Desktop: Resizable panels, Mobile: Tab-based navigation */}
      {isMobile ? (
        <MobileEditorTabs
          messages={messages}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          isStreaming={isStreaming}
          streamState={streamState}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          deviceMode={deviceMode}
          onDeviceModeChange={setDeviceMode}
          previewUrl={previewUrl}
          previewError={previewError}
          isGeneratingPreview={isGeneratingPreview}
          isRegeneratingPreview={isRegeneratingPreview}
          projectFiles={projectFiles}
          selectedFileIndex={selectedFileIndex}
          onFileSelect={setSelectedFileIndex}
          onRestartPreview={handleRestartPreview}
          onRegeneratePreview={handleRegeneratePreview}
          onDownload={handleDownload}
          iframeRef={previewIframeRef}
          iframeKey={iframeKey}
          projectId={projectId ?? undefined}
          projectName={project?.name ?? 'Untitled Project'}
          githubConnectionSuccess={githubConnectionSuccess}
          onGithubConnectionConsumed={handleGithubConnectionConsumed}
          netlifyConnectionSuccess={netlifyConnectionSuccess}
          onNetlifyConnectionConsumed={handleNetlifyConnectionConsumed}
        />
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
            {/* Left Panel - Chat Interface */}
            <Panel
              defaultSize={chatPanelSize}
              minSize={20}
              maxSize={60}
              onResize={(size) => setChatPanelSize(size)}
              className="relative flex flex-col"
            >
              <ChatPanel
                messages={messages}
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
                isStreaming={isStreaming}
                streamState={streamState}
              />
            </Panel>

            {/* Resize Handle */}
            <PanelResizeHandle className="group relative w-1.5 cursor-col-resize transition-all hover:w-2">
              <div className="h-full w-px bg-gradient-to-b from-transparent via-border to-transparent transition-colors group-hover:via-primary/50" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="h-12 w-4 rounded-full bg-primary/0 transition-colors group-hover:bg-primary/10" />
              </div>
            </PanelResizeHandle>

            {/* Right Panel - Preview/Code */}
            <Panel
              defaultSize={65}
              minSize={40}
              className="relative flex flex-col bg-muted/20"
            >
              <ControlBar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                deviceMode={deviceMode}
                onDeviceModeChange={setDeviceMode}
                onRestartPreview={handleRestartPreview}
                onRegeneratePreview={handleRegeneratePreview}
                onDownload={handleDownload}
                isGeneratingPreview={isGeneratingPreview}
                isRegeneratingPreview={isRegeneratingPreview}
                previewError={previewError}
                previewUrl={previewUrl}
                hasFiles={projectFiles.length > 0}
                projectId={projectId ?? undefined}
                projectName={project?.name ?? 'Untitled Project'}
                githubConnectionSuccess={githubConnectionSuccess}
                onGithubConnectionConsumed={handleGithubConnectionConsumed}
                netlifyConnectionSuccess={netlifyConnectionSuccess}
                onNetlifyConnectionConsumed={handleNetlifyConnectionConsumed}
              />
              <div className="flex-1 overflow-auto p-8">
                <PreviewCodePanel
                  viewMode={viewMode}
                  deviceMode={deviceMode}
                  previewUrl={previewUrl}
                  previewError={previewError}
                  isGeneratingPreview={isGeneratingPreview}
                  isRegeneratingPreview={isRegeneratingPreview}
                  isWaitingForVite={isWaitingForVite}
                  projectFiles={projectFiles}
                  selectedFileIndex={selectedFileIndex}
                  onFileSelect={setSelectedFileIndex}
                  onRestartPreview={handleRestartPreview}
                  onRegeneratePreview={handleRegeneratePreview}
                  iframeRef={previewIframeRef}
                  iframeKey={iframeKey}
                  streamState={streamState}
                />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      )}

      {/* Floating Feedback Button - Hidden on mobile to avoid overlap with Preview button */}
      <div className="fixed bottom-6 right-6 z-50 hidden lg:block">
        <FeedbackButton
          variant="default"
          size="default"
          className="shadow-lg transition-shadow hover:shadow-xl"
          projectId={projectId ?? undefined}
        />
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<AILoadingAnimation />}>
      <EditorContent />
    </Suspense>
  );
}
