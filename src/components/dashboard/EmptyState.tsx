import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, Plus } from 'lucide-react';

type EmptyStateProps = {
  onCreateProject: () => void;
};

export function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <div className="relative flex min-h-[60vh] animate-fade-in items-center justify-center">
      {/* Floating decorative elements */}
      <div className="absolute left-1/4 top-1/4 h-32 w-32 animate-float rounded-full bg-primary/10 blur-3xl" />
      <div
        className="absolute bottom-1/3 right-1/4 h-40 w-40 animate-float rounded-full bg-accent/10 blur-3xl"
        style={{ animationDelay: '1.5s' }}
      />

      <Card className="group relative w-full max-w-md overflow-hidden border-2 border-dashed border-border/50 bg-card/30 p-12 text-center backdrop-blur-sm transition-all hover:border-primary/30">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity group-hover:opacity-100" />

        <div className="relative z-10 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="relative flex h-24 w-24 animate-float items-center justify-center rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/20 to-accent/20">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 blur-xl" />
              <Sparkles className="relative z-10 h-12 w-12 text-primary" />
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3">
            <h2 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-bold text-transparent">
              No Projects Yet
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground">
              Create your first application by describing what you want to
              build. It only takes a few minutes!
            </p>
          </div>

          {/* CTA */}
          <Button
            onClick={onCreateProject}
            size="lg"
            className="group/btn relative w-full overflow-hidden shadow-lg transition-all hover:shadow-xl hover:shadow-primary/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-0 transition-opacity group-hover/btn:opacity-100" />
            <Plus className="relative z-10 mr-2 h-5 w-5" />
            <span className="relative z-10">Create First Project</span>
          </Button>

          {/* Additional hint */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-primary">
              No coding required
            </span>
            <span>•</span>
            <span className="rounded-full border border-accent/20 bg-accent/10 px-2 py-1 text-accent">
              Start in seconds
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
