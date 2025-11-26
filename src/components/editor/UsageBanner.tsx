'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { api } from '@/trpc/react';

export function UsageBanner() {
  const { data: stats } = api.usage.getStats.useQuery();

  if (!stats) return null;

  const isLow =
    stats.generationsRemaining < 5 && stats.generationsRemaining > 0;
  const isEmpty = stats.generationsRemaining === 0;

  if (!isLow && !isEmpty) return null;

  return (
    <div
      className={`border-b px-4 py-2.5 text-sm ${
        isEmpty
          ? 'border-destructive/20 bg-destructive/10 text-destructive'
          : 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100'
      }`}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {isEmpty
              ? 'Generation limit reached. Upgrade to continue building.'
              : `Only ${stats.generationsRemaining} generation${stats.generationsRemaining === 1 ? '' : 's'} remaining this month.`}
          </span>
        </div>
        <Link href="/checkout">
          <Button
            size="sm"
            variant={isEmpty ? 'default' : 'outline'}
            className="flex-shrink-0"
          >
            Upgrade Plan
          </Button>
        </Link>
      </div>
    </div>
  );
}
