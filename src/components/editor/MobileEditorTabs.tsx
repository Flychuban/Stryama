'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Eye, Code2 } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { PreviewCodePanel } from './PreviewCodePanel';
import { ControlBar } from './ControlBar';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { Message } from './ChatPanel';
import type { StreamState } from '@/hooks/useAIGenerationStream';
import type { ProjectFile } from './PreviewCodePanel';
import type { ViewMode, DeviceMode } from './ControlBar';
import type { RefObject } from 'react';

interface MobileEditorTabsProps {
  // Chat props
  messages: Message[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  streamState: StreamState;

  // Preview/Code props
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  deviceMode: DeviceMode;
  onDeviceModeChange: (mode: DeviceMode) => void;
  previewUrl: string | null;
  previewError: string | null;
  isGeneratingPreview: boolean;
  isRegeneratingPreview: boolean;
  projectFiles: ProjectFile[];
  selectedFileIndex: number;
  onFileSelect: (index: number) => void;
  onRestartPreview?: () => void;
  onRegeneratePreview?: () => void;
  onDownload?: () => void;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  iframeKey?: number;

  // Project props (for GitHub export)
  projectId?: string;
  projectName?: string;
}

type MobileTab = 'chat' | 'preview';

export function MobileEditorTabs({
  messages,
  input,
  onInputChange,
  onSend,
  isStreaming,
  streamState,
  viewMode,
  onViewModeChange,
  deviceMode,
  onDeviceModeChange,
  previewUrl,
  previewError,
  isGeneratingPreview,
  isRegeneratingPreview,
  projectFiles,
  selectedFileIndex,
  onFileSelect,
  onRestartPreview,
  onRegeneratePreview,
  onDownload,
  iframeRef,
  iframeKey,
  projectId,
  projectName,
}: MobileEditorTabsProps) {
  const [activeTab, setActiveTab] = useLocalStorage<MobileTab>(
    'stryama_mobile_active_tab',
    'chat'
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as MobileTab)}
      className="flex h-full flex-col"
    >
      {/* Tab Navigation - Fixed at bottom for easy thumb access */}
      <TabsList className="fixed bottom-0 left-0 right-0 z-50 grid h-16 w-full grid-cols-2 rounded-none border-t border-border/50 bg-background/95 backdrop-blur-xl">
        <TabsTrigger
          value="chat"
          className="relative flex min-h-[52px] flex-col items-center justify-center gap-1 py-3 transition-colors data-[state=active]:bg-primary/10"
        >
          <MessageSquare className="h-5 w-5" />
          <span className="text-xs font-medium">Chat</span>
          <span className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-primary opacity-0 transition-opacity data-[state=active]:opacity-100" />
        </TabsTrigger>
        <TabsTrigger
          value="preview"
          className="relative flex min-h-[52px] flex-col items-center justify-center gap-1 py-3 transition-colors data-[state=active]:bg-primary/10"
        >
          {viewMode === 'preview' ? (
            <>
              <Eye className="h-5 w-5" />
              <span className="text-xs font-medium">Preview</span>
            </>
          ) : (
            <>
              <Code2 className="h-5 w-5" />
              <span className="text-xs font-medium">Code</span>
            </>
          )}
          <span className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-primary opacity-0 transition-opacity data-[state=active]:opacity-100" />
        </TabsTrigger>
      </TabsList>

      {/* Chat Tab Content */}
      <TabsContent value="chat" className="m-0 h-[calc(100%-4rem)] flex-1">
        <ChatPanel
          messages={messages}
          input={input}
          onInputChange={onInputChange}
          onSend={onSend}
          isStreaming={isStreaming}
          streamState={streamState}
        />
      </TabsContent>

      {/* Preview Tab Content */}
      <TabsContent
        value="preview"
        className="m-0 flex h-[calc(100%-4rem)] flex-1 flex-col"
      >
        <ControlBar
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          deviceMode={deviceMode}
          onDeviceModeChange={onDeviceModeChange}
          onRestartPreview={onRestartPreview}
          onRegeneratePreview={onRegeneratePreview}
          onDownload={onDownload}
          isGeneratingPreview={isGeneratingPreview}
          isRegeneratingPreview={isRegeneratingPreview}
          previewError={previewError}
          previewUrl={previewUrl}
          hasFiles={projectFiles.length > 0}
          projectId={projectId}
          projectName={projectName}
        />
        <div className="flex-1 overflow-auto p-4 sm:p-8">
          <PreviewCodePanel
            viewMode={viewMode}
            deviceMode={deviceMode}
            previewUrl={previewUrl}
            previewError={previewError}
            isGeneratingPreview={isGeneratingPreview}
            isRegeneratingPreview={isRegeneratingPreview}
            projectFiles={projectFiles}
            selectedFileIndex={selectedFileIndex}
            onFileSelect={onFileSelect}
            onRestartPreview={onRestartPreview}
            onRegeneratePreview={onRegeneratePreview}
            isMobile={true}
            iframeRef={iframeRef}
            iframeKey={iframeKey}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
