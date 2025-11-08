'use client';

import { api } from '~/trpc/react';
import Link from 'next/link';

export function UsageDashboard() {
  const { data: stats, isLoading } = api.usage.getStats.useQuery();

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-lg bg-gray-100 p-6">
        <div className="h-4 w-1/3 rounded bg-gray-300"></div>
        <div className="mt-4 h-4 w-full rounded bg-gray-300"></div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const generationPercent = stats.percentageUsed;
  const projectPercent = (stats.projectsUsed / stats.projectsLimit) * 100;

  // Color coding for usage bars
  const getProgressColor = (percent: number) => {
    if (percent < 50) return 'bg-green-500';
    if (percent < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const showUpgradePrompt = stats.plan === 'FREE' || stats.percentageUsed > 80;

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">
          Current Plan: <span className="text-blue-600">{stats.plan}</span>
        </h3>
        <p className="text-sm text-gray-600">
          Resets in {stats.daysUntilReset} day
          {stats.daysUntilReset !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Generations Usage */}
      <div>
        <div className="mb-2 flex justify-between">
          <span className="text-sm font-medium text-gray-700">
            AI Generations
          </span>
          <span className="text-sm text-gray-600">
            {stats.generationsUsed} / {stats.generationsLimit}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all duration-300 ${getProgressColor(generationPercent)}`}
            style={{ width: `${Math.min(generationPercent, 100)}%` }}
          />
        </div>
        {generationPercent > 80 && (
          <p className="mt-1 text-sm text-amber-600">
            You&apos;re approaching your limit. Consider upgrading!
          </p>
        )}
        {stats.generationsRemaining === 0 && (
          <p className="mt-1 text-sm font-medium text-red-600">
            Limit reached. Upgrade to continue generating.
          </p>
        )}
      </div>

      {/* Projects Usage */}
      <div>
        <div className="mb-2 flex justify-between">
          <span className="text-sm font-medium text-gray-700">
            Active Projects
          </span>
          <span className="text-sm text-gray-600">
            {stats.projectsUsed} / {stats.projectsLimit}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full transition-all duration-300 ${getProgressColor(projectPercent)}`}
            style={{ width: `${Math.min(projectPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Upgrade CTA */}
      {showUpgradePrompt && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-blue-900">
            {stats.plan === 'FREE'
              ? 'Unlock More Features'
              : 'Running Low on Credits'}
          </h4>
          <p className="mb-3 text-sm text-blue-700">
            {stats.plan === 'FREE'
              ? 'Upgrade to Builder plan for 100 generations/month and access to advanced AI models.'
              : 'Upgrade your plan for more generations and features.'}
          </p>
          <Link
            href="/pricing"
            className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            {stats.plan === 'FREE'
              ? 'Upgrade to Builder - $19/month'
              : 'View Plans'}
          </Link>
        </div>
      )}

      {/* Help Text */}
      <div className="rounded-md bg-gray-50 p-3">
        <p className="text-xs text-gray-600">
          Need more? Check out our{' '}
          <Link href="/#pricing" className="text-blue-600 hover:underline">
            pricing plans
          </Link>{' '}
          or{' '}
          <a
            href="mailto:support@stryama.com"
            className="text-blue-600 hover:underline"
          >
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}
