'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Terminal,
  Trash2,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type LogLevel = 'stdout' | 'stderr' | 'info' | 'warn' | 'error';

type LogEntry = {
  readonly id: string;
  readonly sandboxId: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: number;
  readonly source?: 'preview' | 'build' | 'install' | 'command';
};

type ConsolePanelProps = {
  readonly logs: readonly LogEntry[];
  readonly isStreaming?: boolean;
  readonly onClear?: () => void;
  readonly onDownload?: () => void;
  readonly className?: string;
};

const ConsolePanel = ({
  logs,
  isStreaming = false,
  onClear,
  onDownload,
  className,
}: ConsolePanelProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'all' | 'console' | 'build' | 'errors'
  >('all');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Detect manual scroll and disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  }, [autoScroll]);

  // Filter logs based on active tab and search term
  const filteredLogs = logs.filter((log) => {
    // Filter by tab
    let tabMatch = true;
    switch (activeTab) {
      case 'console':
        tabMatch = log.source === 'preview' || log.source === 'command';
        break;
      case 'build':
        tabMatch = log.source === 'build' || log.source === 'install';
        break;
      case 'errors':
        tabMatch = log.level === 'error' || log.level === 'stderr';
        break;
      // 'all' shows everything
    }

    // Filter by search term
    const searchMatch =
      !searchTerm ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase());

    return tabMatch && searchMatch;
  });

  // Count logs by type
  const errorCount = logs.filter(
    (log) => log.level === 'error' || log.level === 'stderr'
  ).length;
  const buildLogs = logs.filter(
    (log) => log.source === 'build' || log.source === 'install'
  ).length;

  const getLogIcon = (level: LogLevel) => {
    switch (level) {
      case 'error':
      case 'stderr':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Terminal className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getLogColor = (level: LogLevel) => {
    switch (level) {
      case 'error':
      case 'stderr':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-foreground';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }

    // Default download implementation
    const content = filteredLogs
      .map(
        (log) =>
          `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}`
      )
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={cn(
        'flex flex-col border-t border-border/50 bg-background',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-background/60 p-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Console</span>
          {isStreaming && (
            <Badge
              variant="secondary"
              className="animate-pulse bg-green-500/10 text-green-600 dark:text-green-400"
            >
              Live
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-scroll toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
            className="h-8 gap-1.5 text-xs"
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            {autoScroll ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
            {autoScroll ? 'Auto-scroll' : 'Paused'}
          </Button>

          {/* Download logs */}
          {filteredLogs.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="h-8 w-8"
              title="Download logs"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Clear logs */}
          {onClear && logs.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              className="h-8 w-8"
              title="Clear logs"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tabs and Search */}
      <div className="border-b border-border/50 bg-background/40 p-2">
        <div className="flex items-center gap-2">
          <Tabs
            value={activeTab}
            onValueChange={(v: string) => setActiveTab(v as typeof activeTab)}
          >
            <TabsList className="h-8 bg-muted/50">
              <TabsTrigger value="all" className="text-xs">
                All ({logs.length})
              </TabsTrigger>
              <TabsTrigger value="console" className="text-xs">
                Console
              </TabsTrigger>
              <TabsTrigger value="build" className="text-xs">
                Build {buildLogs > 0 && `(${buildLogs})`}
              </TabsTrigger>
              <TabsTrigger value="errors" className="text-xs">
                Errors {errorCount > 0 && `(${errorCount})`}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative ml-auto w-64">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Logs Content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-background/95 p-2 font-mono text-xs"
        style={{ maxHeight: '400px', minHeight: '200px' }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {logs.length === 0 ? (
              <div className="text-center">
                <Terminal className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No console output yet</p>
                <p className="mt-1 text-[10px]">
                  Logs will appear here when your preview runs
                </p>
              </div>
            ) : (
              <p>No logs match your filters</p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="group flex items-start gap-2 rounded px-2 py-1 hover:bg-muted/30"
              >
                <span className="mt-0.5 flex-shrink-0">
                  {getLogIcon(log.level)}
                </span>
                <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span
                  className={cn('flex-1 break-all', getLogColor(log.level))}
                >
                  {log.message}
                </span>
                {log.source && (
                  <Badge
                    variant="outline"
                    className="flex-shrink-0 text-[9px] opacity-0 group-hover:opacity-100"
                  >
                    {log.source}
                  </Badge>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between border-t border-border/50 bg-background/60 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>
          {filteredLogs.length} {filteredLogs.length === 1 ? 'line' : 'lines'}
          {searchTerm && ` matching "${searchTerm}"`}
        </span>
        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="hover:text-foreground"
          >
            Jump to bottom
          </button>
        )}
      </div>
    </div>
  );
};

export default ConsolePanel;
