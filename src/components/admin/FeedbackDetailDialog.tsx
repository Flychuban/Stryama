'use client';

import { type Feedback, type FeedbackStatus } from '@prisma/client';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  ExternalLink,
  Calendar,
  User,
  Mail,
  Crown,
  Globe,
  Smartphone,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Badge } from '~/components/ui/badge';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import {
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_COLORS,
  type FeedbackMetadata,
} from '~/types/feedback';

interface FeedbackDetailDialogProps {
  feedback: Feedback;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackDetailDialog({
  feedback,
  open,
  onOpenChange,
}: FeedbackDetailDialogProps) {
  const utils = api.useUtils();
  const metadata = feedback.metadata as FeedbackMetadata | null;
  const statusColors = FEEDBACK_STATUS_COLORS[feedback.status];

  const updateStatus = api.feedback.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Status updated successfully');
      void utils.feedback.getAll.invalidate();
      void utils.feedback.getStats.invalidate();
    },
    onError: (error) => {
      console.error('[FeedbackDetailDialog] Failed to update status:', error);
      toast.error('Failed to update status');
    },
  });

  const handleStatusChange = (newStatus: FeedbackStatus) => {
    updateStatus.mutate({
      id: feedback.id,
      status: newStatus,
    });
  };

  const getTypeBadgeVariant = (
    type: string
  ): 'destructive' | 'default' | 'secondary' | 'outline' => {
    switch (type) {
      case 'BUG_REPORT':
        return 'destructive';
      case 'FEATURE_REQUEST':
        return 'default';
      case 'GENERAL_FEEDBACK':
        return 'secondary';
      case 'SUPPORT_REQUEST':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Badge variant={getTypeBadgeVariant(feedback.type)}>
              {FEEDBACK_TYPE_LABELS[feedback.type]}
            </Badge>
            <Badge
              className={`${statusColors.bg} ${statusColors.text} border-0`}
            >
              {FEEDBACK_STATUS_LABELS[feedback.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Message */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Message</Label>
            <div className="rounded-lg bg-muted p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {feedback.message}
              </p>
            </div>
          </div>

          {/* Status Update */}
          <div className="space-y-2">
            <Label htmlFor="status">Update Status</Label>
            <Select
              value={feedback.status}
              onValueChange={(value) =>
                handleStatusChange(value as FeedbackStatus)
              }
              disabled={updateStatus.isPending}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FEEDBACK_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User Information */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">User Information</Label>
            <div className="grid gap-3 rounded-lg bg-muted p-4">
              {metadata?.userEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {metadata.userEmail}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm text-muted-foreground">
                  {feedback.clerkUserId}
                </span>
              </div>

              {metadata?.userPlan && (
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline">{metadata.userPlan}</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Context Information */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Context</Label>
            <div className="grid gap-3 rounded-lg bg-muted p-4">
              {metadata?.url && (
                <div className="flex items-start gap-2">
                  <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-sm text-muted-foreground">
                      Page URL
                    </p>
                    <p className="break-all font-mono text-sm">
                      {metadata.url}
                    </p>
                  </div>
                </div>
              )}

              {metadata?.projectId && (
                <div className="flex items-start gap-2">
                  <ExternalLink className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="mb-1 text-sm text-muted-foreground">
                      Project
                    </p>
                    <Link
                      href={`/editor?id=${metadata.projectId}`}
                      className="font-mono text-sm text-primary hover:underline"
                      target="_blank"
                    >
                      {metadata.projectId}
                    </Link>
                  </div>
                </div>
              )}

              {metadata?.userAgent && (
                <div className="flex items-start gap-2">
                  <Smartphone className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-sm text-muted-foreground">
                      User Agent
                    </p>
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {metadata.userAgent}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Timeline</Label>
            <div className="grid gap-3 rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Created:</span>
                <span className="text-sm font-medium">
                  {format(new Date(feedback.createdAt), 'PPpp')}
                </span>
              </div>

              {feedback.updatedAt !== feedback.createdAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Updated:
                  </span>
                  <span className="text-sm font-medium">
                    {format(new Date(feedback.updatedAt), 'PPpp')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
