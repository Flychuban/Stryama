import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Monitor,
  Smartphone,
  Code2,
  Eye,
  RefreshCw,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewMode = 'preview' | 'code';
export type DeviceMode = 'desktop' | 'mobile';

interface ControlBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  deviceMode: DeviceMode;
  onDeviceModeChange: (mode: DeviceMode) => void;
  onRestartPreview?: () => void;
  onRegeneratePreview?: () => void;
  onDownload?: () => void;
  isGeneratingPreview?: boolean;
  isRegeneratingPreview?: boolean;
  previewError?: string | null;
  previewUrl?: string | null;
  hasFiles?: boolean;
}

export function ControlBar({
  viewMode,
  onViewModeChange,
  deviceMode,
  onDeviceModeChange,
  onRestartPreview,
  onRegeneratePreview,
  onDownload,
  isGeneratingPreview = false,
  isRegeneratingPreview = false,
  previewError,
  previewUrl,
  hasFiles = false,
}: ControlBarProps) {
  const showRegenerateButton =
    (previewError?.includes('not found') ?? false) ||
    (previewError?.includes('Sandbox Not Found') ?? false);

  return (
    <div className="relative z-10 flex items-center justify-between gap-2 border-b border-border/50 bg-background/60 px-3 py-2 backdrop-blur-xl sm:px-6 sm:py-4">
      {/* Primary Navigation - Always show text */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border/30 bg-muted/40 p-0.5 backdrop-blur-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={viewMode === 'preview'}
          onClick={() => onViewModeChange('preview')}
          className={cn(
            'h-auto min-h-[44px] rounded-md px-3 py-2 text-xs transition-all duration-200 sm:h-9 sm:px-3 sm:text-sm',
            viewMode === 'preview'
              ? 'bg-primary/10 text-primary shadow-sm hover:bg-primary/10 hover:text-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          <Eye className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Preview</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={viewMode === 'code'}
          onClick={() => onViewModeChange('code')}
          className={cn(
            'h-auto min-h-[44px] rounded-md px-3 py-2 text-xs transition-all duration-200 sm:h-9 sm:px-3 sm:text-sm',
            viewMode === 'code'
              ? 'bg-primary/10 text-primary shadow-sm hover:bg-primary/10 hover:text-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          )}
        >
          <Code2 className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Code</span>
        </Button>
      </div>

      {/* Secondary Actions */}
      <div className="flex items-center gap-1 sm:gap-2">
        {hasFiles && onDownload && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            className="h-auto min-h-[44px] rounded-lg border-border/50 px-3 py-2 text-xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 sm:h-9 sm:px-3 sm:text-sm"
            title="Download code"
          >
            <Download className="h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Download</span>
          </Button>
        )}

        {viewMode === 'preview' && hasFiles && (
          <>
            {showRegenerateButton && onRegeneratePreview ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onRegeneratePreview}
                disabled={isRegeneratingPreview}
                className="h-auto min-h-[44px] rounded-lg border-border/50 px-3 py-2 text-xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 sm:h-9 sm:px-3 sm:text-sm"
                title="Regenerate preview"
              >
                <RefreshCw
                  className={cn(
                    'h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4',
                    isRegeneratingPreview && 'animate-spin'
                  )}
                />
                <span className="hidden sm:inline">Regenerate</span>
              </Button>
            ) : (
              previewUrl &&
              onRestartPreview && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRestartPreview}
                  disabled={isGeneratingPreview}
                  className="h-auto min-h-[44px] rounded-lg border-border/50 px-3 py-2 text-xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 sm:h-9 sm:px-3 sm:text-sm"
                  title="Restart preview"
                >
                  <RefreshCw
                    className={cn(
                      'h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4',
                      isGeneratingPreview && 'animate-spin'
                    )}
                  />
                  <span className="hidden sm:inline">Restart</span>
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
              className="h-auto min-h-[44px] rounded-lg border-border/50 px-3 py-2 text-xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 sm:h-9 sm:px-3 sm:text-sm"
            >
              {deviceMode === 'desktop' ? (
                <>
                  <Monitor className="h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Desktop</span>
                </>
              ) : (
                <>
                  <Smartphone className="h-3.5 w-3.5 sm:mr-2 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Mobile</span>
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-lg">
            <DropdownMenuItem
              onClick={() => onDeviceModeChange('desktop')}
              className="rounded-md"
            >
              <Monitor className="mr-2 h-4 w-4" />
              Desktop
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeviceModeChange('mobile')}
              className="rounded-md"
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Mobile
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
