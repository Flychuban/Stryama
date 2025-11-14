'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { AppHeader } from '@/components/shared/AppHeader';
import AILoadingAnimation from '@/components/editor/AILoadingAnimation';
import { useAIGenerationStream } from '@/hooks/useAIGenerationStream';
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

const checkPreviewHealth = async (url: string): Promise<boolean> => {
  try {
    await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
};

function EditorContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get('id') ?? null;
  const autoStart = searchParams?.get('autoStart') === 'true';

  // Get Clerk auth state to prevent race conditions
  const { isLoaded: isAuthLoaded } = useUser();

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

  // Persist chat panel width in localStorage
  const [chatPanelSize, setChatPanelSize] = useLocalStorage<number>(
    'stryama_chat_panel_width',
    35
  );

  // Track if we've already attempted auto-regeneration to prevent infinite loops
  const hasAttemptedRegeneration = useRef(false);

  // Track if we've already triggered auto-start to prevent duplicate execution
  const hasTriggeredAutoStart = useRef(false);

  // Track which sessions we've already handled to prevent duplicate processing
  const handledCompletionsRef = useRef(new Set<string>());
  const handledErrorsRef = useRef(new Set<string>());

  // Ref to iframe for reloading on subsequent prompts
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  // tRPC mutations for E2B sandbox operations
  const startPreviewMutation = api.sandbox.startPreview.useMutation();
  const restartPreviewMutation = api.sandbox.restartPreview.useMutation();
  const regeneratePreviewMutation = api.sandbox.regeneratePreview.useMutation();

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

  // Handle streaming completion - watch state directly
  useEffect(() => {
    if (!streamState.isComplete || !streamState.result) return;

    const sessionId = streamState.result.sessionId;

    // Prevent duplicate handling of the same completion
    if (handledCompletionsRef.current.has(sessionId)) {
      return;
    }

    // Mark this session as handled
    handledCompletionsRef.current.add(sessionId);

    const result = streamState.result; // Store in const for type safety

    const handleCompletion = async () => {
      // Add AI message to chat
      const aiMessage: Message = {
        role: 'assistant',
        content: result.content ?? "I've generated the code for you!",
        files: result.files?.map((f) => f.path),
      };
      setMessages((prev) => [...prev, aiMessage]);

      // Refetch project files and start/refresh preview
      if (projectId && result.sandboxId) {
        try {
          // IMPORTANT: Refetch project to get updated files and trigger re-render
          // This is safe now because the project loading effect won't reload messages
          // when messages.length > 0
          await refetchProject();

          // Fetch preview URL from DB
          console.log('[Editor] Fetching preview URL...');
          const previewData = await utils.sandbox.getPreviewUrl.fetch({
            projectId,
          });

          if (previewData.url) {
            // Preview exists - Vite HMR will handle the file updates automatically
            console.log(
              '[Editor] Preview running, waiting for Vite HMR to rebuild...'
            );
            setPreviewUrl(previewData.url);
            setPreviewError(null);

            // Wait 3 seconds for Vite HMR to detect changes and rebuild
            // (HMR is already working - we just need to give it time to rebuild)
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Reload iframe to show the updated content
            console.log('[Editor] Reloading iframe with updated content...');
            setIframeKey((prev) => prev + 1);
          } else {
            // No preview exists yet - start one
            console.log('[Editor] No preview found, starting new preview...');
            setIsGeneratingPreview(true);
            const previewResult = await startPreviewMutation.mutateAsync({
              projectId,
              sandboxId: result.sandboxId,
            });
            setPreviewUrl(previewResult.url);
            setPreviewError(null);
          }
        } catch (error) {
          console.error('[Editor] Failed to start preview server', error);
          setPreviewError(
            error instanceof Error
              ? error.message
              : 'Failed to start preview server'
          );
          setPreviewUrl(null);
        } finally {
          setIsGeneratingPreview(false);
        }
      }
    };

    void handleCompletion();
    // Intentionally omit startPreviewMutation from deps - mutation objects are unstable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamState.isComplete, streamState.result?.sessionId, projectId, utils]);

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

    const errorMessage: Message = {
      role: 'assistant',
      content: `Sorry, I encountered an error: ${streamState.error.message}`,
    };
    setMessages((prev) => [...prev, errorMessage]);
  }, [streamState.hasError, streamState.error]);

  // Reusable error handler for preview operations
  const handlePreviewError = (error: unknown, fallbackMessage: string) => {
    console.error(fallbackMessage, error);
    setPreviewError(error instanceof Error ? error.message : fallbackMessage);
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

        // Check if project has an active sandbox and if it's expired
        const sandboxStatus = await utils.sandbox.getProjectStatus.fetch({
          projectId,
        });

        // Determine if we need to regenerate the preview
        let shouldRegenerate = false;

        if (sandboxStatus.isExpired || !sandboxStatus.hasActiveSandbox) {
          // No active sandbox or expired - need to regenerate
          shouldRegenerate = true;
        } else {
          // Sandbox is active, check if preview URL is healthy
          const previewData = await utils.sandbox.getPreviewUrl.fetch({
            projectId,
          });

          if (previewData.url) {
            const isHealthy = await checkPreviewHealth(previewData.url);

            if (isHealthy) {
              // Preview server is running, use the cached URL
              setPreviewUrl(previewData.url);
              shouldRegenerate = false;
            } else {
              // Preview server is dead, need to regenerate
              shouldRegenerate = true;
            }
          } else {
            // No preview URL found, need to regenerate
            shouldRegenerate = true;
          }
        }

        // Perform regeneration if needed
        if (shouldRegenerate) {
          // Only regenerate if project has files AND we haven't attempted yet
          if (project.files?.length && !hasAttemptedRegeneration.current) {
            setIsRegeneratingPreview(true);

            try {
              const regenerateResult =
                await regeneratePreviewMutation.mutateAsync({
                  projectId,
                });

              setPreviewUrl(regenerateResult.url);
              setPreviewError(null);

              // Only set flag on successful regeneration
              hasAttemptedRegeneration.current = true;
            } catch (error) {
              console.error('[Editor] Failed to regenerate preview:', error);
              handlePreviewError(error, 'Failed to regenerate preview');
              // Flag NOT set - allows user to retry manually or on refresh
            } finally {
              setIsRegeneratingPreview(false);
            }
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
      setPreviewError(null);
    } catch (error) {
      handlePreviewError(error, 'Failed to restart preview server');
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
      setPreviewError(null);
      // Reset the flag so user can regenerate again if needed
      hasAttemptedRegeneration.current = false;
    } catch (error) {
      handlePreviewError(error, 'Failed to regenerate preview');
    } finally {
      setIsRegeneratingPreview(false);
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
          iframeRef={previewIframeRef}
          iframeKey={iframeKey}
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
                isGeneratingPreview={isGeneratingPreview}
                isRegeneratingPreview={isRegeneratingPreview}
                previewError={previewError}
                previewUrl={previewUrl}
                hasFiles={projectFiles.length > 0}
              />
              <div className="flex-1 overflow-auto p-8">
                <PreviewCodePanel
                  viewMode={viewMode}
                  deviceMode={deviceMode}
                  previewUrl={previewUrl}
                  previewError={previewError}
                  isGeneratingPreview={isGeneratingPreview}
                  isRegeneratingPreview={isRegeneratingPreview}
                  projectFiles={projectFiles}
                  selectedFileIndex={selectedFileIndex}
                  onFileSelect={setSelectedFileIndex}
                  onRestartPreview={handleRestartPreview}
                  onRegeneratePreview={handleRegeneratePreview}
                  iframeRef={previewIframeRef}
                  iframeKey={iframeKey}
                />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      )}
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
