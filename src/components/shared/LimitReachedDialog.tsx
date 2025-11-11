'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import Link from 'next/link';
import { Sparkles, FolderOpen } from 'lucide-react';

export type LimitType = 'project' | 'generation';

interface LimitReachedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: LimitType;
  currentUsage: number;
  limit: number;
  plan: 'FREE' | 'BUILDER' | 'PRO';
}

export function LimitReachedDialog({
  open,
  onOpenChange,
  limitType,
  currentUsage,
  limit,
  plan,
}: LimitReachedDialogProps) {
  const isProjectLimit = limitType === 'project';

  const title = isProjectLimit
    ? 'Project Limit Reached'
    : 'Generation Limit Reached';

  const description = isProjectLimit
    ? `You have reached your project limit (${currentUsage}/${limit} projects). ${
        plan === 'FREE'
          ? 'Delete an existing project or upgrade your plan to create more.'
          : 'Delete an existing project or upgrade to a higher tier.'
      }`
    : `You have used all your AI generations this month (${currentUsage}/${limit}). ${
        plan === 'FREE'
          ? 'Upgrade to Builder plan for 100 generations per month.'
          : 'Upgrade to a higher tier for more generations.'
      }`;

  const Icon = isProjectLimit ? FolderOpen : Sparkles;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <Icon className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2 text-left">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Current Usage</span>
            <span className="text-sm font-semibold">
              {currentUsage} / {limit}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-destructive transition-all"
              style={{
                width: `${Math.min((currentUsage / limit) * 100, 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-lg bg-gradient-to-br from-primary/5 to-accent/5 p-4">
          <h4 className="mb-1 font-semibold">
            {plan === 'FREE' ? 'Unlock More Features' : 'Upgrade Your Plan'}
          </h4>
          <p className="text-sm text-muted-foreground">
            {plan === 'FREE'
              ? 'Get 100 generations/month, 5 projects, and access to advanced AI models with Builder plan.'
              : 'Upgrade to unlock higher limits and premium features.'}
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          <Link href="/checkout">
            <AlertDialogAction className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
              {plan === 'FREE'
                ? 'Upgrade to Builder - $19/month'
                : 'View Plans'}
            </AlertDialogAction>
          </Link>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
