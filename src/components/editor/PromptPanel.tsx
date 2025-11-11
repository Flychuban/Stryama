// 1. External libraries
import { useState } from 'react';
import { Sparkles, History, ChevronDown } from 'lucide-react';

// 4. UI components
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

// 6. Local components
import ExamplePrompts from './ExamplePrompts';
import PromptHistory from './PromptHistory';

type PromptPanelProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
};

const MAX_CHARS = 50000;

const PromptPanel = ({
  prompt,
  onPromptChange,
  onGenerate,
  isLoading,
}: PromptPanelProps) => {
  const [showExamples, setShowExamples] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const charCount = prompt.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <div className="flex w-full flex-col border-r border-border/50 bg-background/40 backdrop-blur-sm lg:w-1/2">
      {/* Header */}
      <div className="border-b border-border/50 bg-background/60 p-6 backdrop-blur-md">
        <h1 className="animate-gradient-shift bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] bg-clip-text text-3xl font-bold text-transparent">
          What do you want to build?
        </h1>
        <p className="mt-2 text-muted-foreground">
          Describe your application and watch it come to life
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Textarea */}
        <div className="group relative">
          <Textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="E.g., Create a todo list app with dark mode, categories, and priority levels..."
            autoGrow
            minHeight={200}
            maxHeight={400}
            className="border-border/50 bg-background/80 text-base backdrop-blur-sm transition-all duration-300 focus:border-primary/50 group-hover:border-primary/30"
            disabled={isLoading}
          />
          <div
            className={`absolute bottom-3 right-3 text-sm ${isOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            {charCount} / {MAX_CHARS}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-4 flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExamples(true)}
            className="border-border/50 bg-background/60 backdrop-blur-sm hover:border-primary/50 hover:bg-background/80"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Example prompts
          </Button>
        </div>

        {/* Generate Button */}
        <Button
          onClick={onGenerate}
          disabled={!prompt.trim() || isOverLimit || isLoading}
          className="group relative mt-6 h-14 w-full overflow-hidden bg-gradient-to-r from-primary to-accent text-lg font-semibold shadow-lg transition-all duration-300 hover:opacity-90 hover:shadow-xl"
        >
          <span className="relative z-10 flex items-center justify-center">
            {isLoading ? (
              <>
                <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Application
              </>
            )}
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </Button>

        {/* History Section */}
        <Collapsible
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          className="mt-8"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-background/60 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/50">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="font-medium">Prompt History</span>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${historyOpen ? 'rotate-180' : ''}`}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <PromptHistory onSelectPrompt={onPromptChange} />
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Example Prompts Dialog */}
      <ExamplePrompts
        open={showExamples}
        onOpenChange={setShowExamples}
        onSelectPrompt={(example) => {
          onPromptChange(example);
          setShowExamples(false);
        }}
      />
    </div>
  );
};

export default PromptPanel;
