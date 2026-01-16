import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Code2, Lightbulb } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { StreamingIndicator } from './StreamingIndicator';
import type { StreamState } from '@/hooks/useAIGenerationStream';
import { useEffect, useState } from 'react';
import ExamplePrompts from './ExamplePrompts';

export type Message = {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string[];
  files?: string[];
};

interface ChatPanelProps {
  messages: Message[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  streamState: StreamState;
}

export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSend,
  isStreaming,
  streamState,
}: ChatPanelProps) {
  const [showExamplesDialog, setShowExamplesDialog] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isModifierEnter = (e.metaKey || e.ctrlKey) && e.key === 'Enter';
    const isPlainEnter = e.key === 'Enter' && !e.shiftKey;

    if (isModifierEnter || isPlainEnter) {
      e.preventDefault();
      onSend();
    }
  };

  // Handle mobile keyboard covering input
  useEffect(() => {
    const handleResize = () => {
      const inputArea = document.querySelector('[data-chat-input]');
      if (inputArea && document.activeElement?.closest('[data-chat-input]')) {
        inputArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col">
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] to-transparent" />

      {/* Chat Messages */}
      <ScrollArea className="relative flex-1 p-6">
        <div className="space-y-6">
          {messages.length === 0 ? (
            <div className="flex h-[calc(100vh-220px)] items-center justify-center px-8 text-center">
              <div className="max-w-md space-y-6">
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

                {/* Example prompts */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Try these examples:
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() =>
                        onInputChange(
                          'Create a todo list application with dark mode support, task categories, priority levels, and the ability to mark tasks as complete.'
                        )
                      }
                      className="rounded-lg border border-border/50 px-4 py-2.5 text-left text-xs transition-all hover:border-primary/50 hover:bg-primary/5"
                    >
                      <div className="font-medium">Todo List App</div>
                      <div className="text-muted-foreground">
                        With dark mode & categories
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        onInputChange(
                          'Build a weather dashboard that shows current weather, 7-day forecast, and location search. Include temperature, humidity, and wind speed.'
                        )
                      }
                      className="rounded-lg border border-border/50 px-4 py-2.5 text-left text-xs transition-all hover:border-primary/50 hover:bg-primary/5"
                    >
                      <div className="font-medium">Weather Dashboard</div>
                      <div className="text-muted-foreground">
                        Current & 7-day forecast
                      </div>
                    </button>
                    <button
                      onClick={() =>
                        onInputChange(
                          'Build an expense tracker with categories, monthly summaries, charts showing spending patterns, and the ability to export data as CSV.'
                        )
                      }
                      className="rounded-lg border border-border/50 px-4 py-2.5 text-left text-xs transition-all hover:border-primary/50 hover:bg-primary/5"
                    >
                      <div className="font-medium">Expense Tracker</div>
                      <div className="text-muted-foreground">
                        With charts & export
                      </div>
                    </button>
                  </div>

                  {/* Link to see all examples */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowExamplesDialog(true)}
                    className="w-full text-xs"
                  >
                    <Lightbulb className="mr-2 h-3 w-3" />
                    See more examples
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, i) => (
                <ChatMessage key={i} {...message} />
              ))}

              {/* Show streaming indicator when AI is generating or has just completed */}
              {(isStreaming || streamState.status !== 'idle') && (
                <div className="mt-4">
                  <StreamingIndicator state={streamState} />
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div
        className="relative border-t border-border/50 bg-background/80 p-4 backdrop-blur-xl"
        data-chat-input
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/95 to-transparent" />
        <div className="relative flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Describe what you want to build..."
            autoGrow
            minHeight={48}
            maxHeight={200}
            className="rounded-xl border-border/50 bg-background/50 backdrop-blur-sm transition-all duration-200 focus-visible:border-primary/50 focus-visible:ring-primary/20"
            onKeyDown={handleKeyDown}
          />
          <Button
            size="icon"
            onClick={onSend}
            disabled={!input.trim() || isStreaming}
            className="to-primary-hover h-12 w-12 flex-shrink-0 rounded-xl bg-gradient-to-br from-primary transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        {/* Keyboard shortcut hint */}
        <p className="mt-2 text-xs text-muted-foreground/70">
          Press{' '}
          <kbd className="rounded border border-border/50 bg-muted px-1 py-0.5 text-[10px]">
            Enter
          </kbd>{' '}
          or{' '}
          <kbd className="rounded border border-border/50 bg-muted px-1 py-0.5 text-[10px]">
            ⌘ Enter
          </kbd>{' '}
          to send
        </p>
      </div>

      {/* Example Prompts Dialog */}
      <ExamplePrompts
        open={showExamplesDialog}
        onOpenChange={setShowExamplesDialog}
        onSelectPrompt={(prompt) => {
          onInputChange(prompt);
          setShowExamplesDialog(false);
        }}
      />
    </div>
  );
}
