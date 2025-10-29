'use client';

import { useState, useEffect, Suspense } from 'react';
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

function EditorContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');

  // Fetch project data if ID is provided
  const { data: project } = api.project.getById.useQuery(
    { id: projectId! },
    { enabled: !!projectId }
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // tRPC mutations for E2B sandbox operations
  const syncFilesMutation = api.sandbox.syncFiles.useMutation();
  const startPreviewMutation = api.sandbox.startPreview.useMutation();
  const restartPreviewMutation = api.sandbox.restartPreview.useMutation();

  // Update document title with project name
  useEffect(() => {
    if (project) {
      document.title = `${project.name} - Stryama Editor`;
    }
  }, [project]);

  const handleSend = async () => {
    if (!input.trim() || !projectId) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setPreviewError(null);

    // Simulate AI response
    setTimeout(() => {
      void (async () => {
        const aiMessage: Message = {
          role: 'assistant',
          content:
            "I'll help you build that! Let me start by understanding the requirements and creating the necessary components.",
          thinking: [
            'Read attached files',
            'Explored codebase structure',
            'Generated design brief',
            'Building landing page',
          ],
          files: ['layout.tsx', 'header.tsx', 'globals.css'],
        };

        setMessages((prev) => [...prev, aiMessage]);
        setIsGenerating(false);

        // After AI generates code, sync files and start preview
        try {
          setIsGeneratingPreview(true);

          // Step 1: Sync files to E2B sandbox
          await syncFilesMutation.mutateAsync({
            projectId,
            syncType: 'all',
          });

          // Step 2: Start preview server
          const previewResult = await startPreviewMutation.mutateAsync({
            projectId,
          });

          setPreviewUrl(previewResult.url);
          setPreviewError(null);
        } catch (error) {
          console.error('Failed to generate preview:', error);
          setPreviewError(
            error instanceof Error
              ? error.message
              : 'Failed to start preview server'
          );
          setPreviewUrl(null);
        } finally {
          setIsGeneratingPreview(false);
        }
      })();
    }, 5000);
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
      console.error('Failed to restart preview:', error);
      setPreviewError(
        error instanceof Error
          ? error.message
          : 'Failed to restart preview server'
      );
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const sampleCode = `import { Button } from "@/components/ui/button";

export default function Component() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold">My App</h1>
        </div>
      </header>

      <main className="container mx-auto p-8">
        <h2 className="text-3xl font-bold mb-4">
          Welcome to your application
        </h2>
        <Button>Get Started</Button>
      </main>
    </div>
  );
}`;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
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
                messages.map((message, i) => (
                  <ChatMessage key={i} {...message} />
                ))
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
                disabled={!input.trim() || isGenerating}
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
                variant={viewMode === 'preview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('preview')}
                className={cn(
                  'rounded-md transition-all duration-200',
                  viewMode === 'preview'
                    ? 'bg-background shadow-sm hover:bg-background'
                    : 'hover:bg-background/50'
                )}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button
                variant={viewMode === 'code' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('code')}
                className={cn(
                  'rounded-md transition-all duration-200',
                  viewMode === 'code'
                    ? 'bg-background shadow-sm hover:bg-background'
                    : 'hover:bg-background/50'
                )}
              >
                <Code2 className="mr-2 h-4 w-4" />
                Code
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {previewUrl && viewMode === 'preview' && (
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
            {isGenerating || isGeneratingPreview ? (
              <div className="flex h-full items-center justify-center">
                <div className="space-y-4 text-center">
                  <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      {isGeneratingPreview
                        ? 'Starting preview server...'
                        : 'Generating your application...'}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {isGeneratingPreview
                        ? 'Installing dependencies and starting the development server'
                        : 'This will take a few moments'}
                    </p>
                  </div>
                </div>
              </div>
            ) : viewMode === 'code' ? (
              <CodeView code={sampleCode} filename="component.tsx" />
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
                            Preview Failed
                          </h3>
                          <p className="text-muted-foreground">
                            {previewError}
                          </p>
                          <Button
                            onClick={handleRestartPreview}
                            variant="outline"
                          >
                            Restart Preview
                          </Button>
                        </div>
                      </div>
                    ) : previewUrl ? (
                      <iframe
                        src={previewUrl}
                        className="h-full w-full border-0"
                        title="Live Preview"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                        allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone"
                      />
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
