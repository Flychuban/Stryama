'use client';

import { api } from '~/trpc/react';
import Link from 'next/link';
import { BarChart3, FolderOpen, Calendar, Sparkles } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';

export function UsageDashboard() {
  const { data: stats, isLoading } = api.usage.getStats.useQuery();

  if (isLoading) {
    return (
      <Card className="border-border/50 shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const generationPercent = stats.percentageUsed;
  const projectPercent = (stats.projectsUsed / stats.projectsLimit) * 100;

  // Color coding for usage bars with design system colors
  const getProgressColor = (percent: number) => {
    if (percent < 50) return 'bg-accent';
    if (percent < 80) return 'bg-yellow-500';
    return 'bg-destructive';
  };

  const showUpgradePrompt = stats.plan === 'FREE' || stats.percentageUsed > 80;

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl font-semibold">
            Current Plan:{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {stats.plan}
            </span>
          </span>
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Resets in {stats.daysUntilReset} day
          {stats.daysUntilReset !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Generations Usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">AI Generations</span>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {stats.generationsUsed} / {stats.generationsLimit}
            </span>
          </div>

          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ease-out ${getProgressColor(generationPercent)}`}
              style={{ width: `${Math.min(generationPercent, 100)}%` }}
            />
            {generationPercent > 0 && (
              <div
                className="absolute top-0 h-full w-1/3 bg-white/20"
                style={{
                  width: `${Math.min(generationPercent, 100)}%`,
                  animation: 'shimmer 2s infinite',
                }}
              />
            )}
          </div>

          {generationPercent > 80 && stats.generationsRemaining > 0 && (
            <p className="flex items-center gap-1.5 text-sm text-yellow-600 dark:text-yellow-500">
              <Sparkles className="h-4 w-4" />
              You&apos;re approaching your limit. Consider upgrading!
            </p>
          )}
          {stats.generationsRemaining === 0 && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <Sparkles className="h-4 w-4" />
              Limit reached. Upgrade to continue generating.
            </p>
          )}
        </div>

        {/* Projects Usage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
                <FolderOpen className="h-4 w-4 text-accent" />
              </div>
              <span className="font-medium">Active Projects</span>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {stats.projectsUsed} / {stats.projectsLimit}
            </span>
          </div>

          <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-500 ease-out ${getProgressColor(projectPercent)}`}
              style={{ width: `${Math.min(projectPercent, 100)}%` }}
            />
            {projectPercent > 0 && (
              <div
                className="absolute top-0 h-full w-1/3 bg-white/20"
                style={{
                  width: `${Math.min(projectPercent, 100)}%`,
                  animation: 'shimmer 2s infinite',
                }}
              />
            )}
          </div>
        </div>

        {/* Upgrade CTA */}
        {showUpgradePrompt && (
          <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4 backdrop-blur-sm">
            <h4 className="mb-2 font-semibold">
              {stats.plan === 'FREE'
                ? 'Unlock More Features'
                : 'Running Low on Credits'}
            </h4>
            <p className="mb-4 text-sm text-muted-foreground">
              {stats.plan === 'FREE'
                ? 'Upgrade to Builder plan for 100 generations/month and access to advanced AI models.'
                : 'Upgrade your plan for more generations and features.'}
            </p>
            <Link
              href="/checkout"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
            >
              {stats.plan === 'FREE'
                ? 'Upgrade to Builder - $19/month'
                : 'View Plans'}
            </Link>
          </div>
        )}

        {/* Help Text */}
        <div className="rounded-lg bg-muted/50 p-3 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">
            Need more? Check out our{' '}
            <Link
              href="/checkout"
              className="font-medium text-primary hover:underline"
            >
              pricing plans
            </Link>{' '}
            or{' '}
            <a
              href="mailto:support@stryama.com"
              className="font-medium text-primary hover:underline"
            >
              contact support
            </a>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
