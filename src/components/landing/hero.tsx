'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUp, Zap, Code2, Palette, Database, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/shared/logo';

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

export function Hero() {
  const [demoPrompt, setDemoPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDemo = (): void => {
    if (!demoPrompt.trim()) return;

    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };

  const handleSuggestionClick = (text: string): void => {
    setDemoPrompt(
      `Create a modern ${text.toLowerCase()} with beautiful design and animations`
    );
  };

  const placeholderText = 'Describe your app idea here...';

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-32">
      {/* Animated gradient background */}
      <div className="gradient-mesh absolute inset-0 -z-10" />

      {/* Floating badges for visual interest */}
      <div className="animate-float absolute top-32 left-12 hidden lg:block">
        <Badge
          variant="secondary"
          className="bg-accent/20 text-accent border-accent/30 backdrop-blur-sm"
        >
          <Zap className="mr-1 h-3 w-3" />
          Lightning Fast
        </Badge>
      </div>
      <div
        className="animate-float absolute top-48 right-16 hidden lg:block"
        style={{ animationDelay: '1s' }}
      >
        <Badge
          variant="secondary"
          className="bg-primary/20 text-primary border-primary/30 flex items-center gap-1 backdrop-blur-sm"
        >
          <Logo size={12} showText={false} />
          AI Powered
        </Badge>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <div className="animate-fade-in space-y-12 text-center">
          {/* Headline with better typography */}
          <div className="space-y-6">
            <h1 className="text-foreground text-6xl leading-[1.1] font-bold tracking-tight md:text-7xl lg:text-8xl">
              Shape your ideas into
              <br />
              <span className="from-primary via-accent to-primary animate-gradient-shift bg-gradient-to-r bg-[length:200%_auto] bg-clip-text text-transparent">
                apps that work
              </span>
            </h1>
            <p className="text-muted-foreground mx-auto max-w-3xl text-xl leading-relaxed md:text-2xl">
              Stryama transforms your words into working applications.
              <br />
              No code. No limits. Just pure creation.
            </p>
          </div>

          {/* Enhanced demo input */}
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="group relative">
              <div className="from-primary to-accent absolute -inset-1 rounded-3xl bg-gradient-to-r opacity-20 blur transition-opacity group-hover:opacity-30" />
              <div className="bg-card/80 border-border/50 relative rounded-3xl border p-2 shadow-2xl backdrop-blur-xl">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={demoPrompt}
                    onChange={(e) => setDemoPrompt(e.target.value)}
                    placeholder={placeholderText}
                    className="placeholder:text-muted-foreground/60 min-h-[100px] resize-none border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isGenerating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleDemo();
                      }
                    }}
                  />
                  <Button
                    onClick={handleDemo}
                    disabled={isGenerating || !demoPrompt.trim()}
                    size="icon"
                    className="mb-2 h-12 w-12 flex-shrink-0 rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Suggestion pills */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="text-muted-foreground text-sm">
                Try building:
              </span>
              {suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="hover:border-primary/50 hover:bg-primary/5 rounded-full transition-all"
                  onClick={() => handleSuggestionClick(suggestion.text)}
                >
                  {suggestion.icon}
                  <span className="ml-1.5">{suggestion.text}</span>
                </Button>
              ))}
            </div>

            <p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
              <Logo size={16} showText={false} />
              No sign up required to try
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
