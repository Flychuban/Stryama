'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Zap, Code2, Palette, Database, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/shared/Logo';
import { api } from '@/trpc/react';
import { usePromptHandoff } from '@/hooks/usePromptHandoff';
import { useToast } from '@/hooks/use-toast';

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

  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { toast } = useToast();
  const { storePrompt } = usePromptHandoff();

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
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-32">
      {/* Animated gradient background */}
      <div className="gradient-mesh absolute inset-0 -z-10" />

      {/* Floating badges for visual interest */}
      <div className="absolute left-12 top-32 hidden animate-float lg:block">
        <Badge
          variant="secondary"
          className="border-accent/30 bg-accent/20 text-accent backdrop-blur-sm"
        >
          <Zap className="mr-1 h-3 w-3" />
          Lightning Fast
        </Badge>
      </div>
      <div
        className="absolute right-16 top-48 hidden animate-float lg:block"
        style={{ animationDelay: '1s' }}
      >
        <Badge
          variant="secondary"
          className="flex items-center gap-1 border-primary/30 bg-primary/20 text-primary backdrop-blur-sm"
        >
          <Logo size={12} showText={false} />
          AI Powered
        </Badge>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <div className="animate-fade-in space-y-12 text-center">
          {/* Headline with better typography */}
          <div className="space-y-6">
            <h1 className="text-6xl font-bold leading-[1.1] tracking-tight text-foreground md:text-7xl lg:text-8xl">
              Shape your ideas into
              <br />
              <span className="animate-gradient-shift bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] bg-clip-text text-transparent">
                apps that work
              </span>
            </h1>
            <p className="mx-auto max-w-3xl text-xl leading-relaxed text-muted-foreground md:text-2xl">
              Stryama transforms your words into working applications.
              <br />
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
              <Logo size={16} showText={false} />
              {isSignedIn
                ? 'Start creating instantly'
                : 'Sign up to save your project'}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
