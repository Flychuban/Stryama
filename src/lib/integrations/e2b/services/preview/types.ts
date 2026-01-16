/**
 * Log entry structure for dev server output
 */
export type LogEntry = {
  timestamp: number;
  type: 'stdout' | 'stderr';
  line: string;
};

/**
 * Preview process information including logs
 */
export type PreviewProcessInfo = {
  pid: number;
  port: number;
  logs: LogEntry[];
  lastActivity: number;
};
