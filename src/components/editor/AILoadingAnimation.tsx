'use client';

import { useState, useEffect } from 'react';
import { Code2, Search, Sparkles, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

const loadingSteps = [
  { icon: Search, text: 'Reading codebase', duration: 2000 },
  { icon: Sparkles, text: 'Analyzing requirements', duration: 2000 },
  { icon: Code2, text: 'Generating code', duration: 3000 },
  { icon: FileCode, text: 'Implementing changes', duration: 2000 },
];

const AILoadingAnimation = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep < loadingSteps.length) {
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, loadingSteps[currentStep]?.duration ?? 2000);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  return (
    <div className="flex h-full flex-col items-center justify-center space-y-10 p-8">
      {/* Animated Code Window */}
      <div className="relative w-full max-w-lg">
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-background to-muted/30 shadow-2xl backdrop-blur-sm">
          {/* Window Header */}
          <div className="flex items-center gap-3 border-b border-border/50 bg-muted/40 px-5 py-3.5 backdrop-blur-sm">
            <div className="flex gap-2">
              <div className="h-3 w-3 rounded-full bg-destructive/70 shadow-sm" />
              <div className="h-3 w-3 rounded-full bg-accent/70 shadow-sm" />
              <div className="h-3 w-3 rounded-full bg-primary/70 shadow-sm" />
            </div>
            <div className="flex-1 text-center">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border/30 bg-background/60 px-3 py-1">
                <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                <span className="font-mono text-xs font-medium text-foreground">
                  component.tsx
                </span>
              </div>
            </div>
          </div>

          {/* Code Content with Animation */}
          <div className="space-y-3 bg-background/40 p-8 backdrop-blur-sm">
            {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="h-2.5 animate-pulse rounded-full bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 shadow-sm"
                style={{
                  width: `${Math.random() * 35 + 65}%`,
                  animationDelay: `${i * 150}ms`,
                  animationDuration: '1.5s',
                }}
              />
            ))}
            <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/20" />
          </div>
        </div>

        {/* Floating Glow Elements */}
        <div className="absolute -right-6 -top-6 h-24 w-24 animate-pulse rounded-full bg-gradient-to-br from-primary/30 to-transparent blur-2xl" />
        <div
          className="absolute -bottom-6 -left-6 h-32 w-32 animate-pulse rounded-full bg-gradient-to-br from-accent/30 to-transparent blur-2xl"
          style={{ animationDelay: '1s' }}
        />
      </div>

      {/* Loading Steps */}
      <div className="w-full max-w-lg space-y-3">
        {loadingSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <div
              key={index}
              className={cn(
                'group flex items-center gap-4 rounded-xl p-4 transition-all duration-500',
                isActive &&
                  'border border-primary/20 bg-gradient-to-r from-primary/10 to-accent/5 shadow-lg shadow-primary/5',
                isCompleted && 'opacity-60',
                !isActive &&
                  !isCompleted &&
                  'border border-transparent bg-muted/20'
              )}
            >
              <div
                className={cn(
                  'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-500',
                  isActive &&
                    'scale-110 bg-gradient-to-br from-primary via-primary to-accent shadow-xl shadow-primary/30',
                  isCompleted && 'border border-border/30 bg-muted/60',
                  !isActive &&
                    !isCompleted &&
                    'border border-border/20 bg-muted/40'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-all duration-300',
                    isActive && 'text-primary-foreground',
                    !isActive && 'text-muted-foreground'
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm font-medium leading-relaxed transition-colors',
                    isActive && 'text-foreground',
                    !isActive && 'text-muted-foreground'
                  )}
                >
                  {step.text}
                </p>
              </div>
              {isActive && (
                <div className="flex gap-1">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-sm shadow-primary/50" />
                  <div
                    className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-sm shadow-primary/50"
                    style={{ animationDelay: '0.3s' }}
                  />
                  <div
                    className="h-2 w-2 animate-pulse rounded-full bg-primary shadow-sm shadow-primary/50"
                    style={{ animationDelay: '0.6s' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Text */}
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-gradient-to-r from-primary to-accent shadow-lg shadow-primary/50" />
        <p className="animate-pulse text-sm font-medium text-muted-foreground">
          Building your application...
        </p>
        <div className="h-2 w-2 animate-pulse rounded-full bg-gradient-to-r from-accent to-primary shadow-lg shadow-accent/50" />
      </div>
    </div>
  );
};

export default AILoadingAnimation;
