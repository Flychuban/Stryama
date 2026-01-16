import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PromptHistoryProps {
  onSelectPrompt: (prompt: string) => void;
}

const mockHistory = [
  {
    id: 1,
    prompt: 'Create a todo list app with dark mode and categories',
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
  },
  {
    id: 2,
    prompt: 'Build a weather dashboard with 7-day forecast',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
  {
    id: 3,
    prompt: 'Design a recipe finder with ingredient search',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
];

export function PromptHistory({ onSelectPrompt }: PromptHistoryProps) {
  if (mockHistory.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mockHistory.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelectPrompt(item.prompt)}
          className="group w-full rounded-lg border border-border/50 bg-background/60 p-3 text-left backdrop-blur-sm transition-all duration-300 hover:border-primary/50"
        >
          <p className="mb-1 line-clamp-2 text-sm transition-colors group-hover:text-primary">
            {item.prompt}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
          </p>
        </button>
      ))}
    </div>
  );
}
