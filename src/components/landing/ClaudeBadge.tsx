import { Sparkles } from 'lucide-react';

interface ClaudeBadgeProps {
  variant?: 'default' | 'minimal';
  className?: string;
}

export function ClaudeBadge({
  variant = 'default',
  className = '',
}: ClaudeBadgeProps) {
  if (variant === 'minimal') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-sm text-muted-foreground ${className}`}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>Powered by Claude AI</span>
      </div>
    );
  }

  return (
    <div
      className={`group inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 transition-all hover:border-primary/40 hover:bg-primary/10 ${className}`}
    >
      <Sparkles className="h-4 w-4 text-primary transition-transform group-hover:rotate-12" />
      <span className="text-sm font-medium text-foreground">
        Powered by <span className="text-primary">Claude AI</span>
      </span>
    </div>
  );
}
