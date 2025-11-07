'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Send,
  Monitor,
  Smartphone,
  Code2,
  Eye,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AppHeader } from '@/components/shared/AppHeader';
import ChatMessage from '@/components/editor/ChatMessage';
import AILoadingAnimation from '@/components/editor/AILoadingAnimation';
import CodeView from '@/components/editor/CodeView';
import { StreamingIndicator } from '@/components/editor/StreamingIndicator';
import { useAIGenerationStream } from '@/hooks/useAIGenerationStream';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/trpc/react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string[];
  files?: string[];
};

type ViewMode = 'preview' | 'code';
type DeviceMode = 'desktop' | 'mobile';

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

  // Fetch project data if ID is provided
  const {
    data: project,
    isLoading: isLoadingProject,
    refetch: refetchProject,
  } = api.project.getById.useQuery(
    { id: projectId! },
    { enabled: !!projectId }
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

  // Track if we've already attempted auto-regeneration to prevent infinite loops
  const hasAttemptedRegeneration = useRef(false);

  // Track if we've already triggered auto-start to prevent duplicate execution
  const hasTriggeredAutoStart = useRef(false);

  // Track which sessions we've already handled to prevent duplicate processing
  const handledCompletionsRef = useRef(new Set<string>());
  const handledErrorsRef = useRef(new Set<string>());

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

      // Refetch project files and start preview
      if (projectId && result.sandboxId) {
        try {
          // IMPORTANT: Refetch project to get updated files and trigger re-render
          // This is safe now because the project loading effect won't reload messages
          // when messages.length > 0
          await refetchProject();

          setIsGeneratingPreview(true);
          const previewResult = await startPreviewMutation.mutateAsync({
            projectId,
            sandboxId: result.sandboxId,
          });
          setPreviewUrl(previewResult.url);
          setPreviewError(null);
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
  const currentFile = projectFiles[selectedFileIndex] ?? null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background pt-16">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Chat Interface (35%) */}
        <div className="relative flex w-full flex-col lg:w-[35%]">
          {/* Subtle gradient overlay */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent" />

          {/* Chat Messages */}
          <ScrollArea className="relative flex-1 p-6">
            <div className="space-y-6">
              {messages.length === 0 ? (
                <div className="flex h-[calc(100vh-220px)] items-center justify-center px-8 text-center">
                  <div className="max-w-sm space-y-6">
                    <div className="relative">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent backdrop-blur-sm">
                        <Code2 className="h-9 w-9 text-primary" />
                      </div>
                      <div className="absolute -inset-2 -z-10 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-30 blur-xl" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold tracking-tight">
                        Start Building
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Describe what you want to build and I&apos;ll help you
                        create it step by step
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message, i) => (
                    <ChatMessage key={i} {...message} />
                  ))}

                  {/* Show streaming indicator when AI is generating or has just completed */}
                  {(isStreaming || streamState.status !== 'idle') && (
                    <div className="mt-4">
                      <StreamingIndicator state={streamState} />
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="relative border-t border-border/50 bg-background/80 p-4 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/95 to-transparent" />
            <div className="relative flex gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 flex-shrink-0 rounded-xl border-border/50 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe what you want to build..."
                className="max-h-[120px] min-h-[48px] resize-none rounded-xl border-border/50 bg-background/50 backdrop-blur-sm transition-all duration-200 focus-visible:border-primary/50 focus-visible:ring-primary/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="to-primary-hover h-12 w-12 flex-shrink-0 rounded-xl bg-gradient-to-br from-primary transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-gradient-to-b from-transparent via-border to-transparent" />

        {/* Right Panel - Preview/Code (65%) */}
        <div className="relative flex flex-1 flex-col bg-muted/20">
          {/* Control Bar */}
          <div className="relative z-10 flex items-center justify-between border-b border-border/50 bg-background/60 px-6 py-4 backdrop-blur-xl">
            <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-muted/40 p-1 backdrop-blur-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={viewMode === 'preview'}
                onClick={() => setViewMode('preview')}
                className={cn(
                  'rounded-md transition-all duration-200',
                  viewMode === 'preview'
                    ? 'bg-primary/10 text-primary shadow-sm hover:bg-primary/10 hover:text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={viewMode === 'code'}
                onClick={() => setViewMode('code')}
                className={cn(
                  'rounded-md transition-all duration-200',
                  viewMode === 'code'
                    ? 'bg-primary/10 text-primary shadow-sm hover:bg-primary/10 hover:text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Code2 className="mr-2 h-4 w-4" />
                Code
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {viewMode === 'preview' && projectFiles.length > 0 && (
                <>
                  {previewError?.includes('not found') ||
                  previewError?.includes('Sandbox Not Found') ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRegeneratePreview}
                      disabled={isRegeneratingPreview}
                      className="rounded-lg border-border/50 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
                      title="Regenerate preview from database files"
                    >
                      <RefreshCw
                        className={cn(
                          'mr-2 h-4 w-4',
                          isRegeneratingPreview && 'animate-spin'
                        )}
                      />
                      Regenerate Preview
                    </Button>
                  ) : (
                    previewUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRestartPreview}
                        disabled={isGeneratingPreview}
                        className="rounded-lg border-border/50 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
                        title="Restart preview server"
                      >
                        <RefreshCw
                          className={cn(
                            'mr-2 h-4 w-4',
                            isGeneratingPreview && 'animate-spin'
                          )}
                        />
                        Restart Preview
                      </Button>
                    )
                  )}
                </>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-border/50 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
                  >
                    {deviceMode === 'desktop' ? (
                      <>
                        <Monitor className="mr-2 h-4 w-4" />
                        Desktop
                      </>
                    ) : (
                      <>
                        <Smartphone className="mr-2 h-4 w-4" />
                        Mobile
                      </>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-lg">
                  <DropdownMenuItem
                    onClick={() => setDeviceMode('desktop')}
                    className="rounded-md"
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    Desktop
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeviceMode('mobile')}
                    className="rounded-md"
                  >
                    <Smartphone className="mr-2 h-4 w-4" />
                    Mobile
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-8">
            {isGeneratingPreview || isRegeneratingPreview ? (
              <div className="flex h-full items-center justify-center">
                <div className="space-y-4 text-center">
                  <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      {isRegeneratingPreview
                        ? 'Restoring preview...'
                        : 'Starting preview server...'}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isRegeneratingPreview
                        ? 'Syncing files from database and starting preview (20-30s)'
                        : 'Installing dependencies and starting the development server'}
                    </p>
                  </div>
                </div>
              </div>
            ) : viewMode === 'code' ? (
              projectFiles.length > 0 && currentFile ? (
                <div className="space-y-4">
                  {/* File selector if multiple files */}
                  {projectFiles.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {projectFiles.map((file, index) => (
                        <Button
                          key={file.id}
                          variant={
                            index === selectedFileIndex ? 'default' : 'outline'
                          }
                          size="sm"
                          onClick={() => setSelectedFileIndex(index)}
                          className="whitespace-nowrap"
                        >
                          {file.path}
                        </Button>
                      ))}
                    </div>
                  )}
                  <CodeView
                    code={currentFile.content}
                    filename={currentFile.path}
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center">
                  <div className="max-w-md space-y-4">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
                      <Code2 className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">No Files Yet</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Start a conversation with the AI to generate code files
                        for your project.
                      </p>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center">
                <div
                  className={cn(
                    'relative overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl transition-all duration-500',
                    deviceMode === 'mobile' && 'ring-8 ring-muted/30'
                  )}
                  style={{
                    width: deviceMode === 'desktop' ? '100%' : '375px',
                    height: deviceMode === 'desktop' ? '100%' : '667px',
                    maxWidth: '100%',
                  }}
                >
                  {/* Browser-style header */}
                  {deviceMode === 'desktop' && (
                    <div className="flex h-10 items-center gap-2 border-b border-border/50 bg-muted/50 px-4">
                      <div className="flex gap-2">
                        <div className="h-3 w-3 rounded-full bg-destructive/70" />
                        <div className="h-3 w-3 rounded-full bg-accent/70" />
                        <div className="h-3 w-3 rounded-full bg-primary/70" />
                      </div>
                      <div className="flex flex-1 justify-center">
                        <div className="rounded-md border border-border/30 bg-background/50 px-4 py-1 font-mono text-xs text-muted-foreground">
                          {previewUrl
                            ? new URL(previewUrl).host
                            : 'localhost:5173'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      'w-full',
                      deviceMode === 'desktop'
                        ? 'h-[calc(100%-40px)]'
                        : 'h-full'
                    )}
                  >
                    {previewError ? (
                      <div className="flex h-full items-center justify-center p-8 text-center">
                        <div className="max-w-md space-y-4">
                          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/20">
                            <AlertCircle className="h-10 w-10 text-destructive" />
                          </div>
                          <h3 className="text-xl font-semibold">
                            {previewError.includes('not found') ||
                            previewError.includes('Sandbox Not Found')
                              ? 'Preview Expired'
                              : 'Preview Failed'}
                          </h3>
                          <p className="text-muted-foreground">
                            {previewError.includes('not found') ||
                            previewError.includes('Sandbox Not Found')
                              ? 'The preview sandbox has expired. Click below to regenerate from your saved files.'
                              : previewError}
                          </p>
                          {previewError.includes('not found') ||
                          previewError.includes('Sandbox Not Found') ? (
                            <Button
                              onClick={handleRegeneratePreview}
                              variant="default"
                              disabled={isRegeneratingPreview}
                            >
                              <RefreshCw
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  isRegeneratingPreview && 'animate-spin'
                                )}
                              />
                              Regenerate Preview
                            </Button>
                          ) : (
                            <Button
                              onClick={handleRestartPreview}
                              variant="outline"
                            >
                              Restart Preview
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : previewUrl ? (
                      <>
                        <div className="absolute right-4 top-4 z-10">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(previewUrl, '_blank')}
                            className="rounded-lg border-border/50 bg-background/80 backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:bg-primary/5"
                          >
                            Open in New Tab
                          </Button>
                        </div>
                        <iframe
                          src={previewUrl ?? undefined}
                          className="h-full w-full border-0"
                          title="Live Preview"
                          referrerPolicy="no-referrer-when-downgrade"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                          allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; clipboard-read; clipboard-write"
                        />
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center p-8 text-center">
                        <div className="space-y-6">
                          <div className="relative">
                            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent backdrop-blur-sm">
                              <Monitor className="h-12 w-12 text-primary" />
                            </div>
                            <div className="absolute -inset-3 -z-10 rounded-2xl bg-gradient-to-r from-primary/20 to-accent/20 opacity-30 blur-2xl" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-xl font-semibold tracking-tight">
                              Preview will appear here
                            </h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">
                              Start a conversation to generate your application
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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
