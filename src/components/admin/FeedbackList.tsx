'use client';

import { useState } from 'react';
import { type Feedback } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';

import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import {
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_COLORS,
  type FeedbackMetadata,
} from '~/types/feedback';
import { FeedbackDetailDialog } from './FeedbackDetailDialog';

interface FeedbackListProps {
  feedback: Feedback[];
}

export function FeedbackList({ feedback }: FeedbackListProps) {
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(
    null
  );

  const handleFeedbackClick = (item: Feedback) => {
    setSelectedFeedback(item);
  };

  const truncateMessage = (message: string, maxLength = 100) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
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
    <>
      <div className="space-y-3">
        {feedback.map((item) => {
          const metadata = item.metadata as FeedbackMetadata | null;
          const statusColors = FEEDBACK_STATUS_COLORS[item.status];

          return (
            <Card
              key={item.id}
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
              onClick={() => handleFeedbackClick(item)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={getTypeBadgeVariant(item.type)}>
                        {FEEDBACK_TYPE_LABELS[item.type]}
                      </Badge>
                      <Badge
                        className={`${statusColors.bg} ${statusColors.text} border-0`}
                      >
                        {FEEDBACK_STATUS_LABELS[item.status]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-sm leading-relaxed">
                      {truncateMessage(item.message)}
                    </p>

                    {/* Footer Row */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      {metadata?.userEmail && (
                        <span className="font-medium">
                          {metadata.userEmail}
                        </span>
                      )}
                      {metadata?.userPlan && (
                        <Badge variant="outline" className="text-xs">
                          {metadata.userPlan}
                        </Badge>
                      )}
                      {metadata?.url && (
                        <span className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {metadata.url}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Dialog */}
      {selectedFeedback && (
        <FeedbackDetailDialog
          feedback={selectedFeedback}
          open={!!selectedFeedback}
          onOpenChange={(open) => !open && setSelectedFeedback(null)}
        />
      )}
    </>
  );
}
