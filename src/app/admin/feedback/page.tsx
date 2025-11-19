'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2 } from 'lucide-react';
import { type FeedbackType, type FeedbackStatus } from '@prisma/client';

import { api } from '~/trpc/react';
import { AppHeader } from '~/components/shared/AppHeader';
import { FeedbackList } from '~/components/admin/FeedbackList';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import { FEEDBACK_TYPE_LABELS, FEEDBACK_STATUS_LABELS } from '~/types/feedback';

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<FeedbackType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'ALL'>(
    'ALL'
  );

  // Check if user is admin via tRPC
  const { data: isAuthorized, isLoading: isCheckingAuth } =
    api.feedback.checkIsAdmin.useQuery();

  // Redirect non-admins
  useEffect(() => {
    if (isCheckingAuth) return;

    if (isAuthorized === false) {
      router.push('/dashboard');
    }
  }, [isAuthorized, isCheckingAuth, router]);

  // Fetch all feedback with filters
  const { data: allFeedback, isLoading } = api.feedback.getAll.useQuery(
    {
      type: typeFilter === 'ALL' ? undefined : typeFilter,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    },
    {
      enabled: isAuthorized === true,
    }
  );

  // Fetch stats
  const { data: stats } = api.feedback.getStats.useQuery(undefined, {
    enabled: isAuthorized === true,
  });

  // Show loading state while checking authorization
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If not authorized, return null (will redirect)
  if (!isAuthorized) {
    return null;
  }

  const openCount = stats?.byStatus.OPEN ?? 0;
  const totalCount = stats?.total ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 opacity-30" />

        {/* Gradient orbs */}
        <div className="absolute left-1/4 top-1/4 h-96 w-96 animate-pulse rounded-full bg-primary/20 blur-3xl" />
        <div className="animation-delay-2000 absolute bottom-1/4 right-1/4 h-96 w-96 animate-pulse rounded-full bg-accent/20 blur-3xl" />
      </div>

      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin: Feedback Management</h1>
          </div>
          <p className="text-muted-foreground">
            View and manage user feedback, bug reports, and feature requests
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Feedback</CardDescription>
              <CardTitle className="text-3xl">{totalCount}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                {openCount}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">
                {stats?.byStatus.IN_PROGRESS ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {stats?.byStatus.RESOLVED ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={typeFilter}
                  onValueChange={(value) =>
                    setTypeFilter(value as FeedbackType | 'ALL')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    {Object.entries(FEEDBACK_TYPE_LABELS).map(
                      ([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label} ({stats?.byType[key as FeedbackType] ?? 0})
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as FeedbackStatus | 'ALL')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    {Object.entries(FEEDBACK_STATUS_LABELS).map(
                      ([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label} ({stats?.byStatus[key as FeedbackStatus] ?? 0}
                          )
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !allFeedback || allFeedback.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No feedback found matching the filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <FeedbackList feedback={allFeedback} />
        )}
      </main>
    </div>
  );
}
