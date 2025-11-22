import { Button } from '@/components/ui/button';
import { Code2, Monitor, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import CodeView from './CodeView';
import type { DeviceMode, ViewMode } from './ControlBar';
import type { RefObject } from 'react';
import type { StreamState } from '~/hooks/useAIGenerationStream';
import AILoadingAnimation from './AILoadingAnimation';
import { useState, useEffect } from 'react';

export type ProjectFile = {
  id: string;
  path: string;
  content: string;
};

interface PreviewCodePanelProps {
  viewMode: ViewMode;
  deviceMode: DeviceMode;
  previewUrl: string | null;
  previewError: string | null;
  isGeneratingPreview: boolean;
  isRegeneratingPreview: boolean;
  isWaitingForVite?: boolean;
  projectFiles: ProjectFile[];
  selectedFileIndex: number;
  onFileSelect: (index: number) => void;
  onRestartPreview?: () => void;
  onRegeneratePreview?: () => void;
  isMobile?: boolean;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  iframeKey?: number;
  streamState?: StreamState;
}

export function PreviewCodePanel({
  viewMode,
  deviceMode,
  previewUrl,
  previewError,
  isGeneratingPreview,
  isRegeneratingPreview,
  isWaitingForVite = false,
  projectFiles,
  selectedFileIndex,
  onFileSelect,
  onRestartPreview,
  onRegeneratePreview,
  isMobile = false,
  iframeRef,
  iframeKey = 0,
  streamState,
}: PreviewCodePanelProps) {
  const currentFile = projectFiles[selectedFileIndex] ?? null;

  // Phase 3: Track iframe loading state and detect E2B errors
  const [isIframeLoading, setIsIframeLoading] = useState(false);
  const [iframeLoadError, setIframeLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Reset states when preview URL changes
  useEffect(() => {
    setIsIframeLoading(true);
    setIframeLoadError(false);
    setRetryCount(0);
  }, [previewUrl, iframeKey]);

  // Handle iframe load event
  const handleIframeLoad = () => {
    setIsIframeLoading(false);

    // Try to detect E2B error page by checking iframe content
    // Note: We can't access cross-origin iframe content directly,
    // but we can detect it via timing and retry logic
    if (iframeRef?.current) {
      try {
        // If iframe loaded successfully, content should be accessible
        // Cross-origin will throw an error which we catch below
        const iframeDoc =
          iframeRef.current.contentDocument ??
          iframeRef.current.contentWindow?.document;

        if (iframeDoc) {
          const html = iframeDoc.documentElement.innerHTML;

          // Check for E2B error page markers
          if (
            html.includes('Closed Port Error') ||
            html.includes('no service running on port') ||
            html.includes('Connection refused on port')
          ) {
            console.log(
              '[Preview] E2B error page detected in iframe - will retry'
            );
            setIframeLoadError(true);

            // Retry after 3 seconds if not too many retries
            if (retryCount < 3) {
              setTimeout(() => {
                console.log(
                  `[Preview] Retrying iframe load (attempt ${retryCount + 1}/3)`
                );
                setRetryCount((prev) => prev + 1);
                setIsIframeLoading(true);
                setIframeLoadError(false);
                // Force reload by incrementing key would happen in parent
              }, 3000);
            }
          }
        }
      } catch (e) {
        // Cross-origin error is expected and means the preview loaded successfully
        // (our preview server is on different domain than our app)
        console.log(
          '[Preview] Iframe loaded (cross-origin - this is expected)'
        );
      }
    }
  };

  // Show AI generation animation when streaming
  if (
    streamState?.isStreaming &&
    viewMode === 'preview' &&
    !isRegeneratingPreview
  ) {
    return <AILoadingAnimation streamState={streamState} />;
  }

  // Show loading state for preview server starting
  if (isGeneratingPreview || isRegeneratingPreview) {
    return (
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
    );
  }

  // Show code view
  if (viewMode === 'code') {
    if (projectFiles.length > 0 && currentFile) {
      return (
        <div className="space-y-4">
          {/* File selector if multiple files */}
          {projectFiles.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {projectFiles.map((file, index) => (
                <Button
                  key={file.id}
                  variant={index === selectedFileIndex ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onFileSelect(index)}
                  className="whitespace-nowrap"
                >
                  {file.path}
                </Button>
              ))}
            </div>
          )}
          <CodeView code={currentFile.content} filename={currentFile.path} />
        </div>
      );
    }

    // No files yet
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="max-w-md space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
            <Code2 className="h-10 w-10 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-xl font-semibold">No Files Yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Start a conversation with the AI to generate code files for your
              project.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show preview view
  return (
    <div className="flex h-full items-center justify-center">
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl transition-all duration-500',
          deviceMode === 'mobile' && !isMobile && 'ring-8 ring-muted/30'
        )}
        style={{
          width:
            deviceMode === 'desktop' ? '100%' : isMobile ? '100%' : '375px',
          height:
            deviceMode === 'desktop'
              ? '100%'
              : isMobile
                ? 'calc(100vh - 200px)'
                : '667px',
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
                {previewUrl ? new URL(previewUrl).host : 'localhost:5173'}
              </div>
            </div>
          </div>
        )}

        <div
          className={cn(
            'w-full',
            deviceMode === 'desktop' ? 'h-[calc(100%-40px)]' : 'h-full'
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
                previewError.includes('Sandbox Not Found')
                  ? onRegeneratePreview && (
                      <Button
                        onClick={onRegeneratePreview}
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
                    )
                  : onRestartPreview && (
                      <Button onClick={onRestartPreview} variant="outline">
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

              {/* Loading overlay when waiting for Vite to be ready after server restart */}
              {(isWaitingForVite || streamState?.isStreaming) &&
                viewMode === 'preview' && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
                    <div className="space-y-4 text-center">
                      <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                      <div>
                        <h3 className="text-lg font-semibold">
                          Starting preview server...
                        </h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Vite is compiling your changes, this usually takes
                          5-10 seconds
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* Phase 3: Loading overlay for iframe while E2B error is showing */}
              {(isIframeLoading || iframeLoadError) && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 backdrop-blur-sm">
                  <div className="space-y-4 text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                    <div>
                      <h3 className="text-base font-semibold">
                        {iframeLoadError
                          ? 'Waiting for preview server...'
                          : 'Loading preview...'}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {iframeLoadError
                          ? `Retrying (${retryCount + 1}/3)...`
                          : 'Vite is finishing compilation'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <iframe
                ref={iframeRef}
                key={iframeKey}
                src={previewUrl ? `${previewUrl}?v=${iframeKey}` : undefined}
                className="h-full w-full border-0"
                title="Live Preview"
                referrerPolicy="no-referrer-when-downgrade"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
                allow="accelerometer; camera; encrypted-media; geolocation; gyroscope; microphone; clipboard-read; clipboard-write"
                onLoad={handleIframeLoad}
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
  );
}
