'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Code2, Palette, Database, Cloud } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { api } from '@/trpc/react';
import { usePromptHandoff } from '@/hooks/usePromptHandoff';
import { useToast } from '@/hooks/use-toast';
import {
  LimitReachedDialog,
  type LimitType,
} from '@/components/shared/LimitReachedDialog';

type SuggestionPill = {
  icon: React.ReactNode;
  text: string;
};

const suggestions: SuggestionPill[] = [
  { icon: <Palette className="h-3.5 w-3.5" />, text: 'Portfolio Website' },
  { icon: <Database className="h-3.5 w-3.5" />, text: 'Task Manager' },
  { icon: <Cloud className="h-3.5 w-3.5" />, text: 'Landing Page' },
  { icon: <Code2 className="h-3.5 w-3.5" />, text: 'Dashboard' },
];

const PROJECT_NAME_CONFIG = {
  MAX_WORDS: 5,
  MAX_LENGTH: 50,
  TRUNCATE_SUFFIX: '...',
  DEFAULT_NAME: 'New Project',
} as const;

export function Hero() {
  const [prompt, setPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitDialogData, setLimitDialogData] = useState<{
    type: LimitType;
    currentUsage: number;
    limit: number;
    plan: 'FREE' | 'BUILDER' | 'PRO';
  } | null>(null);

  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const { storePrompt } = usePromptHandoff();

  // Fetch usage stats for authenticated users
  const { data: usageStats } = api.usage.getStats.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const createProjectMutation = api.project.create.useMutation({
    onSuccess: (newProject) => {
      // Store the prompt for auto-start in editor
      sessionStorage.setItem('initialPrompt', prompt);
      router.push(`/editor?id=${newProject.id}&autoStart=true`);
    },
    onError: (error) => {
      setIsCreating(false);
      toast({
        title: 'Failed to create project',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (): void => {
    if (!prompt.trim()) return;

    // Check limits for authenticated users before proceeding
    if (isSignedIn && usageStats) {
      // Check project limit
      if (usageStats.projectsUsed >= usageStats.projectsLimit) {
        setLimitDialogData({
          type: 'project',
          currentUsage: usageStats.projectsUsed,
          limit: usageStats.projectsLimit,
          plan: usageStats.plan,
        });
        setShowLimitDialog(true);
        return; // Block submission
      }

      // Warn if approaching generation limit (but allow submission)
      if (
        usageStats.generationsRemaining < 5 &&
        usageStats.generationsRemaining > 0
      ) {
        toast({
          title: 'Low on generations',
          description: `Only ${usageStats.generationsRemaining} generation${
            usageStats.generationsRemaining === 1 ? '' : 's'
          } remaining this month.`,
          variant: 'default',
        });
      }

      // Block if no generations remaining
      if (usageStats.generationsRemaining === 0) {
        setLimitDialogData({
          type: 'generation',
          currentUsage: usageStats.generationsUsed,
          limit: usageStats.generationsLimit,
          plan: usageStats.plan,
        });
        setShowLimitDialog(true);
        return; // Block submission
      }
    }

    setIsCreating(true);

    if (isSignedIn) {
      // User is authenticated - create project immediately
      createProjectMutation.mutate({
        name: generateProjectName(prompt),
        description: prompt,
      });
    } else {
      // User is not authenticated - store prompt and redirect to sign-up
      storePrompt(prompt);
      router.push('/sign-up');
    }
  };

  const handleSuggestionClick = (text: string): void => {
    setPrompt(
      `Create a modern ${text.toLowerCase()} with beautiful design and animations`
    );
  };

  const placeholderText = 'Describe your app idea here...';

  // Generate a concise project name from prompt
  const generateProjectName = (promptText: string): string => {
    const words = promptText
      .trim()
      .split(/\s+/)
      .slice(0, PROJECT_NAME_CONFIG.MAX_WORDS);
    let name = words.join(' ');
    if (name.length > PROJECT_NAME_CONFIG.MAX_LENGTH) {
      const truncateAt =
        PROJECT_NAME_CONFIG.MAX_LENGTH -
        PROJECT_NAME_CONFIG.TRUNCATE_SUFFIX.length;
      name =
        name.substring(0, truncateAt) + PROJECT_NAME_CONFIG.TRUNCATE_SUFFIX;
    }
    return name || PROJECT_NAME_CONFIG.DEFAULT_NAME;
  };

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-20 md:py-32">
      {/* Animated gradient background */}
      <div className="gradient-mesh absolute inset-0 -z-10" />

      <div className="mx-auto w-full max-w-5xl">
        <div className="animate-fade-in space-y-8 text-center md:space-y-12">
          {/* Headline with better typography */}
          <div className="space-y-4 md:space-y-6">
            <h1 className="text-5xl font-bold leading-[1.1] tracking-tight text-foreground md:text-7xl lg:text-8xl">
              Shape your ideas into
              <br />
              <span className="animate-gradient-shift bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] bg-clip-text text-transparent">
                apps that work
              </span>
            </h1>
            <p className="mx-auto max-w-3xl text-lg leading-relaxed text-muted-foreground md:text-xl lg:text-2xl">
              Stryama transforms your words into working applications.
              <br className="hidden sm:inline" />
              No code. No limits. Just pure creation.
            </p>
          </div>

          {/* Enhanced demo input */}
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="group relative">
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary to-accent opacity-20 blur transition-opacity group-hover:opacity-30" />
              <div className="relative rounded-3xl border border-border/50 bg-card/80 p-2 shadow-2xl backdrop-blur-xl">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={placeholderText}
                    autoGrow
                    minHeight={100}
                    maxHeight={300}
                    className="border-0 bg-transparent text-base placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isCreating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                  />
                  <Button
                    onClick={handleSubmit}
                    disabled={isCreating || !prompt.trim()}
                    size="icon"
                    className="mb-2 h-12 w-12 flex-shrink-0 rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                  >
                    {isCreating ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    ) : (
                      <ArrowUp className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Suggestion pills */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground">
                Try building:
              </span>
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="rounded-full transition-all hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => handleSuggestionClick(suggestion.text)}
                  disabled={isCreating}
                >
                  {suggestion.icon}
                  <span className="ml-1.5">{suggestion.text}</span>
                </Button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Logo
                size={16}
                showText={false}
                withContainer
                containerVariant="glass"
              />
              {isSignedIn ? (
                usageStats ? (
                  <div className="flex items-center gap-3">
                    <span>Start creating instantly</span>
                    <span className="text-xs">•</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-medium ${
                          usageStats.projectsUsed >= usageStats.projectsLimit
                            ? 'text-destructive'
                            : usageStats.projectsUsed /
                                  usageStats.projectsLimit >
                                0.8
                              ? 'text-yellow-600 dark:text-yellow-500'
                              : 'text-primary'
                        }`}
                      >
                        {usageStats.projectsUsed}/{usageStats.projectsLimit}{' '}
                        projects
                      </span>
                      <span className="text-xs">•</span>
                      <span
                        className={`font-medium ${
                          usageStats.generationsRemaining === 0
                            ? 'text-destructive'
                            : usageStats.generationsRemaining < 5
                              ? 'text-yellow-600 dark:text-yellow-500'
                              : 'text-primary'
                        }`}
                      >
                        {usageStats.generationsRemaining} generations left
                      </span>
                    </div>
                  </div>
                ) : (
                  'Start creating instantly'
                )
              ) : (
                'Sign up to save your project'
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Limit reached dialog */}
      {limitDialogData && (
        <LimitReachedDialog
          open={showLimitDialog}
          onOpenChange={setShowLimitDialog}
          limitType={limitDialogData.type}
          currentUsage={limitDialogData.currentUsage}
          limit={limitDialogData.limit}
          plan={limitDialogData.plan}
        />
      )}
    </section>
  );
}
