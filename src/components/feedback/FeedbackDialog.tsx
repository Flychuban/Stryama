'use client';

import { useState } from 'react';
import { FeedbackType } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
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
import { Loader2, MessageCircle } from 'lucide-react';
import { FEEDBACK_TYPE_LABELS } from '~/types/feedback';
import { usePathname } from 'next/navigation';

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: FeedbackType;
  defaultMessage?: string;
  projectId?: string;
}

export function FeedbackDialog({
  open,
  onOpenChange,
  defaultType = FeedbackType.GENERAL_FEEDBACK,
  defaultMessage = '',
  projectId,
}: FeedbackDialogProps) {
  const [type, setType] = useState<FeedbackType>(defaultType);
  const [message, setMessage] = useState(defaultMessage);
  const pathname = usePathname();

  const createFeedback = api.feedback.create.useMutation({
    onSuccess: () => {
      toast.success("Thank you for your feedback! We'll review it soon.");
      onOpenChange(false);
      // Reset form
      setMessage('');
      setType(FeedbackType.GENERAL_FEEDBACK);
    },
    onError: (error) => {
      console.error('[FeedbackDialog] Failed to submit feedback:', error);
      toast.error('Failed to submit feedback. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (message.trim().length < 10) {
      toast.error('Please provide at least 10 characters');
      return;
    }

    // Auto-capture context
    const metadata = {
      url: pathname,
      projectId,
      userAgent:
        typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    };

    createFeedback.mutate({
      type,
      message: message.trim(),
      metadata,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Send Feedback
          </DialogTitle>
          <DialogDescription>
            Help us improve by sharing your thoughts, reporting bugs, or
            requesting features.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(value as FeedbackType)}
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FEEDBACK_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Tell us what's on your mind..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px] resize-none"
              required
              minLength={10}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">
              {message.length}/2000 characters (minimum 10)
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createFeedback.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createFeedback.isPending || message.trim().length < 10}
            >
              {createFeedback.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Feedback'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
