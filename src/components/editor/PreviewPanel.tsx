import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  RefreshCw,
  Maximize2,
  Monitor,
  Tablet,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

interface PreviewPanelProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  content: string;
  onRefresh: () => void;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const PreviewPanel = ({ status, content, onRefresh }: PreviewPanelProps) => {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const getDeviceWidth = () => {
    switch (device) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      default:
        return '100%';
    }
  };

  const getDeviceIcon = () => {
    switch (device) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      void document.documentElement.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className="flex w-full flex-col bg-background/40 backdrop-blur-sm lg:w-1/2">
      {/* Control Bar */}
      <div className="flex items-center gap-2 border-b border-border/50 bg-background/60 p-4 backdrop-blur-md">
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          className="border-border/50 bg-background/60 backdrop-blur-sm hover:border-primary/50"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="border-border/50 bg-background/60 backdrop-blur-sm hover:border-primary/50"
            >
              {getDeviceIcon()}
              <span className="ml-2 capitalize">{device}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="border-border/50 bg-background/95 backdrop-blur-xl">
            <DropdownMenuItem onClick={() => setDevice('desktop')}>
              <Monitor className="mr-2 h-4 w-4" />
              Desktop
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDevice('tablet')}>
              <Tablet className="mr-2 h-4 w-4" />
              Tablet
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDevice('mobile')}>
              <Smartphone className="mr-2 h-4 w-4" />
              Mobile
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="icon"
          onClick={toggleFullscreen}
          className="ml-auto border-border/50 bg-background/60 backdrop-blur-sm hover:border-primary/50"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-auto bg-muted/20 p-6">
        <div className="flex h-full items-center justify-center">
          <div
            className="overflow-hidden rounded-lg border border-border/50 bg-background shadow-2xl transition-all duration-500"
            style={{
              width: getDeviceWidth(),
              height: device === 'desktop' ? '100%' : '667px',
              maxWidth: '100%',
            }}
          >
            {status === 'idle' && (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div className="space-y-4">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20">
                    <Monitor className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">
                    Your preview will appear here
                  </h3>
                  <p className="text-muted-foreground">
                    Enter a prompt and click Generate to see your application
                  </p>
                </div>
              </div>
            )}

            {status === 'loading' && (
              <div className="h-full space-y-4 p-8">
                <div className="mb-8 flex items-center gap-4">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      Generating your application...
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      This will take a few moments
                    </p>
                  </div>
                </div>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-3/4" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}

            {status === 'error' && (
              <div className="flex h-full items-center justify-center p-8">
                <div className="max-w-md space-y-4 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/20">
                    <AlertCircle className="h-10 w-10 text-destructive" />
                  </div>
                  <h3 className="text-xl font-semibold">Generation Failed</h3>
                  <p className="text-muted-foreground">
                    We couldn&apos;t generate your application. Please try again
                    with a different prompt.
                  </p>
                  <Button onClick={onRefresh} variant="outline">
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {status === 'success' && content && (
              <iframe
                srcDoc={content}
                className="h-full w-full border-0"
                title="Preview"
                sandbox="allow-scripts"
              />
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-3 border-t border-border/50 bg-background/60 p-4 backdrop-blur-md">
        <div
          className={`h-3 w-3 rounded-full ${
            status === 'success'
              ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'
              : status === 'loading'
                ? 'animate-pulse bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                : status === 'error'
                  ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  : 'bg-muted'
          }`}
        />
        <span className="text-sm text-muted-foreground">
          {status === 'success'
            ? 'Ready'
            : status === 'loading'
              ? 'Generating...'
              : status === 'error'
                ? 'Error'
                : 'Idle'}
        </span>
      </div>
    </div>
  );
};

export default PreviewPanel;
