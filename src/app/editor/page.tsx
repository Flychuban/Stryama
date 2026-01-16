'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import { AppHeader } from '@/components/shared/AppHeader';
import { UsageBanner } from '@/components/editor/UsageBanner';
import AILoadingAnimation from '@/components/editor/AILoadingAnimation';
import { useAIGenerationStream } from '@/hooks/useAIGenerationStream';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useEditorPreview } from '@/hooks/useEditorPreview';
import { useStreamHandler } from '@/hooks/useStreamHandler';
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

  const { isLoaded: isAuthLoaded } = useUser();

  const {
    trackAIGenerationStarted,
    trackProjectDownloaded,
    trackProjectOpened,
    trackPreviewRegenerated,
    trackPreviewRestarted,
  } = useAnalytics();

  const sessionGenerationCount = useRef(0);
  const hasTrackedProjectOpen = useRef(false);
  const hasTriggeredAutoStart = useRef(false);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const {
    data: project,
    isLoading: isLoadingProject,
    refetch: refetchProject,
  } = api.project.getById.useQuery(
    { id: projectId! },
    { enabled: !!projectId && isAuthLoaded }
  );

  const utils = api.useUtils();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [isExpectingPreviewUpdate, setIsExpectingPreviewUpdate] =
    useState(false);
  const [githubConnectionSuccess, setGithubConnectionSuccess] = useState(false);
  const [netlifyConnectionSuccess, setNetlifyConnectionSuccess] =
    useState(false);

  const [chatPanelSize, setChatPanelSize] = useLocalStorage<number>(
    'stryama_chat_panel_width',
    35
  );

  // Preview management hook
  const preview = useEditorPreview({
    projectId,
    onRegenerateSuccess: () => {
      if (projectId) {
        trackPreviewRegenerated({
          reason: 'user_initiated',
          previous_error: preview.previewError ?? undefined,
          project_id: projectId,
        });
      }
    },
  });

  // AI generation streaming hook
  const {
    state: streamState,
    startStreaming,
    isStreaming,
  } = useAIGenerationStream({
    projectId: projectId ?? undefined,
    useSandbox: true,
  });

  // Message add callback
  const onMessageAdd = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // Stream handler for completion, errors, and preview updates
  useStreamHandler({
    projectId,
    streamState,
    previewUrl: preview.previewUrl,
    isExpectingPreviewUpdate,
    onMessageAdd,
    onPreviewUrlChange: preview.setPreviewUrl,
    onPreviewErrorChange: preview.setPreviewError,
    onExpectingPreviewChange: setIsExpectingPreviewUpdate,
    onWaitingForViteChange: preview.setIsWaitingForVite,
    onIframeReload: preview.reloadIframe,
    refetchProject,
  });

  // Track project opened event
  useEffect(() => {
    if (
      !project ||
      !projectId ||
      hasTrackedProjectOpen.current ||
      isLoadingProject
    )
      return;

    const projectAgeDays = Math.floor(
      (Date.now() - new Date(project.createdAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const lastModifiedDays = Math.floor(
      (Date.now() - new Date(project.updatedAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    trackProjectOpened({
      project_id: projectId,
      project_age_days: projectAgeDays,
      generation_count: project.files?.length ?? 0,
      last_modified_days_ago: lastModifiedDays,
    });

    hasTrackedProjectOpen.current = true;
  }, [project, projectId, isLoadingProject, trackProjectOpened]);

  // Detect GitHub connection success
  useEffect(() => {
    if (githubConnected === 'true') {
      logger.debug('[Editor] GitHub connection success detected');
      setGithubConnectionSuccess(true);

      const url = new URL(window.location.href);
      url.searchParams.delete('github_connected');
      window.history.replaceState({}, '', url.toString());
    }
  }, [githubConnected]);

  const handleGithubConnectionConsumed = () =>
    setGithubConnectionSuccess(false);

  // Detect Netlify connection success
  useEffect(() => {
    if (netlifyConnected === 'true') {
      logger.debug('[Editor] Netlify connection success detected');
      setNetlifyConnectionSuccess(true);

      const url = new URL(window.location.href);
      url.searchParams.delete('netlify_connected');
      window.history.replaceState({}, '', url.toString());
    }
  }, [netlifyConnected]);

  const handleNetlifyConnectionConsumed = () =>
    setNetlifyConnectionSuccess(false);

  // Mark that we're expecting a preview update when streaming starts
  useEffect(() => {
    if (!streamState.isStreaming) return;

    logger.debug('[Editor] Streaming started - expecting preview update event');
    setIsExpectingPreviewUpdate(true);

    if (preview.previewUrl) {
      logger.debug('[Editor] Showing loading overlay during update');
      preview.setIsWaitingForVite(true);
    }
  }, [
    streamState.isStreaming,
    preview.previewUrl,
    preview.setIsWaitingForVite,
  ]);

  // Auto-reset overlay state after maximum wait time
  useEffect(() => {
    if (!preview.isWaitingForVite) return;

    const maxWaitTime = 45000;

    logger.debug('[Editor] Setting overlay auto-reset timer for 45s...');

    const timeoutId = setTimeout(() => {
      console.warn('[Editor] Overlay auto-reset triggered after 45s timeout');
      preview.setIsWaitingForVite(false);

      if (isExpectingPreviewUpdate) {
        console.error('[Editor] Preview update timeout');
        preview.setPreviewError(
          'Preview server startup is taking longer than expected. Try clicking "Restart Preview" or refresh the page.'
        );
        setIsExpectingPreviewUpdate(false);
      }
    }, maxWaitTime);

    return () => clearTimeout(timeoutId);
  }, [
    preview.isWaitingForVite,
    isExpectingPreviewUpdate,
    preview.setIsWaitingForVite,
    preview.setPreviewError,
  ]);

  // Reset overlay when streaming completes
  useEffect(() => {
    if (streamState.isStreaming) return;

    if (
      preview.isWaitingForVite &&
      (streamState.isComplete || streamState.hasError)
    ) {
      logger.debug('[Editor] Streaming finished, checking overlay reset');

      const resetDelay = setTimeout(() => {
        if (isExpectingPreviewUpdate) {
          logger.debug(
            '[Editor] Still expecting preview update, keeping overlay'
          );
          return;
        }

        logger.debug('[Editor] Resetting overlay');
        preview.setIsWaitingForVite(false);
      }, 2000);

      return () => clearTimeout(resetDelay);
    }
  }, [
    streamState.isStreaming,
    streamState.isComplete,
    streamState.hasError,
    preview.isWaitingForVite,
    isExpectingPreviewUpdate,
    preview.setIsWaitingForVite,
  ]);

  // Update document title
  useEffect(() => {
    if (project) {
      document.title = `${project.name} - Stryama Editor`;
    }
  }, [project]);

  // Load conversation history and preview URL on initial load
  useEffect(() => {
    if (!projectId || isLoadingProject || !project) return;
    if (messages.length > 0 || isStreaming) return;

    preview.resetRegenerationFlag();

    const loadProjectState = async () => {
      try {
        const history = await utils.ai.getHistory.fetch({
          projectId,
          limit: 100,
        });

        const conversationMessages: Message[] = history
          .reverse()
          .flatMap((gen) => [
            { role: 'user' as const, content: gen.prompt },
            { role: 'assistant' as const, content: gen.response ?? '' },
          ]);

        if (messages.length === 0 && !isStreaming) {
          setMessages(conversationMessages);
        }

        const previewData = await utils.sandbox.getPreviewUrl.fetch({
          projectId,
        });

        if (previewData.url) {
          logger.debug('[Editor] Found preview URL:', previewData.url);
          preview.setPreviewUrl(previewData.url);
          preview.setPreviewError(null);
        }

        const sandboxStatus = await utils.sandbox.getProjectStatus.fetch({
          projectId,
        });

        let shouldReconnect = false;
        let shouldRegenerate = false;

        if (sandboxStatus.isExpired || !sandboxStatus.hasActiveSandbox) {
          logger.debug('[Editor] Sandbox expired, regenerating');
          shouldRegenerate = true;
        } else if (!previewData.url) {
          logger.debug('[Editor] No preview URL, will try reconnecting');
          shouldReconnect = true;
        } else {
          logger.debug(
            '[Editor] Active sandbox with URL, will try reconnecting'
          );
          shouldReconnect = true;
        }

        if (project.files?.length && !preview.hasAttemptedRegen()) {
          try {
            if (shouldReconnect) {
              logger.debug('[Editor] Attempting warm sandbox reconnect...');
              const reconnectResult = await preview.handleReconnectPreview();

              if (!reconnectResult.success) {
                logger.warn(
                  '[Editor] Reconnect failed, falling back to regeneration'
                );
                shouldRegenerate = true;
              }
            }

            if (shouldRegenerate) {
              logger.debug('[Editor] Performing full sandbox regeneration...');
              await preview.handleRegeneratePreview();
            }
          } catch (error) {
            console.error('[Editor] Failed to load preview:', error);
            preview.handlePreviewError(
              error,
              'Failed to load preview',
              'Click "Regenerate" to try again.'
            );
          }
        }

        if (autoStart && !hasTriggeredAutoStart.current) {
          const initialPrompt = sessionStorage.getItem('initialPrompt');

          if (initialPrompt?.trim()) {
            hasTriggeredAutoStart.current = true;
            setMessages((prev) => [
              ...prev,
              { role: 'user', content: initialPrompt },
            ]);
            sessionStorage.removeItem('initialPrompt');
            startStreaming(initialPrompt);
          }
        }
      } catch (error) {
        console.error('[Editor] Failed to load project state:', error);
      }
    };

    void loadProjectState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isLoadingProject]);

  const handleSend = async () => {
    if (!input.trim() || !projectId) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    const userPrompt = input.trim();
    setInput('');
    preview.setPreviewError(null);

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

    startStreaming(userPrompt);
  };

  const handleRestartPreview = async () => {
    const result = await preview.handleRestartPreview();
    if (result?.success && projectId) {
      trackPreviewRestarted({
        sandbox_uptime_minutes: 0,
        project_id: projectId,
      });
    }
  };

  const handleDownload = async () => {
    const projectFiles = project?.files ?? [];
    if (projectFiles.length === 0) {
      toast.error('No files to download');
      return;
    }

    try {
      await downloadProjectAsZip(projectFiles, project?.name ?? 'project');
      toast.success('Code downloaded successfully');

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
          time_from_last_generation_seconds: 0,
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

  const projectFiles = project?.files ?? [];
  const { isMobile } = useEditorLayout();

  if (!isAuthLoaded) {
    return <AILoadingAnimation />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background pt-16">
      <AppHeader />
      <UsageBanner />

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
          previewUrl={preview.previewUrl}
          previewError={preview.previewError}
          isGeneratingPreview={preview.isGeneratingPreview}
          isRegeneratingPreview={preview.isRegeneratingPreview}
          projectFiles={projectFiles}
          selectedFileIndex={selectedFileIndex}
          onFileSelect={setSelectedFileIndex}
          onRestartPreview={handleRestartPreview}
          onRegeneratePreview={preview.handleRegeneratePreview}
          onDownload={handleDownload}
          iframeRef={previewIframeRef}
          iframeKey={preview.iframeKey}
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

            <PanelResizeHandle className="group relative w-1.5 cursor-col-resize transition-all hover:w-2">
              <div className="h-full w-px bg-gradient-to-b from-transparent via-border to-transparent transition-colors group-hover:via-primary/50" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="h-12 w-4 rounded-full bg-primary/0 transition-colors group-hover:bg-primary/10" />
              </div>
            </PanelResizeHandle>

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
                onRegeneratePreview={preview.handleRegeneratePreview}
                onDownload={handleDownload}
                isGeneratingPreview={preview.isGeneratingPreview}
                isRegeneratingPreview={preview.isRegeneratingPreview}
                previewError={preview.previewError}
                previewUrl={preview.previewUrl}
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
                  previewUrl={preview.previewUrl}
                  previewError={preview.previewError}
                  isGeneratingPreview={preview.isGeneratingPreview}
                  isRegeneratingPreview={preview.isRegeneratingPreview}
                  isWaitingForVite={preview.isWaitingForVite}
                  projectFiles={projectFiles}
                  selectedFileIndex={selectedFileIndex}
                  onFileSelect={setSelectedFileIndex}
                  onRestartPreview={handleRestartPreview}
                  onRegeneratePreview={preview.handleRegeneratePreview}
                  iframeRef={previewIframeRef}
                  iframeKey={preview.iframeKey}
                  streamState={streamState}
                />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      )}

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
