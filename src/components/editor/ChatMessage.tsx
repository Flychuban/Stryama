import { User, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string[];
  files?: string[];
}

const ChatMessage = ({ role, content, thinking, files }: ChatMessageProps) => {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'group flex gap-4 rounded-xl p-5 transition-all duration-300',
        isUser
          ? 'border border-border/30 bg-muted/40 hover:border-border/50'
          : 'border border-transparent bg-gradient-to-br from-primary/[0.03] to-accent/[0.02] hover:border-primary/10'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-300',
          isUser
            ? 'border border-border/30 bg-gradient-to-br from-muted to-muted/50 text-foreground group-hover:border-border/50'
            : 'bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground shadow-lg shadow-primary/20 group-hover:shadow-primary/30'
        )}
      >
        {isUser ? (
          <User className="h-5 w-5" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-4">
        {/* Thinking Process */}
        {thinking && thinking.length > 0 && (
          <div className="space-y-2.5 py-2">
            {thinking.map((step, i) => (
              <div
                key={i}
                className="group/step flex animate-fade-in items-start gap-3 text-sm text-muted-foreground"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="mt-1.5 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-gradient-to-br from-primary to-accent shadow-sm shadow-primary/30" />
                <span className="leading-relaxed transition-colors group-hover/step:text-foreground">
                  {step}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Files */}
        {files && files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <div
                key={i}
                className="cursor-default rounded-lg border border-border/40 bg-background/60 px-3 py-2 font-mono text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:text-foreground"
              >
                {file}
              </div>
            ))}
          </div>
        )}

        {/* Message Content */}
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {content}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
