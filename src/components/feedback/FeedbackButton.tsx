'use client';

import { useState } from 'react';
import { type FeedbackType } from '@prisma/client';
import { Button } from '~/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { FeedbackDialog } from './FeedbackDialog';

interface FeedbackButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showIcon?: boolean;
  defaultType?: FeedbackType;
  defaultMessage?: string;
  projectId?: string;
  children?: React.ReactNode;
}

export function FeedbackButton({
  variant = 'default',
  size = 'default',
  className,
  showIcon = true,
  defaultType,
  defaultMessage,
  projectId,
  children,
}: FeedbackButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        {showIcon && <MessageCircle className="mr-2 h-4 w-4" />}
        {children ?? 'Send Feedback'}
      </Button>

      <FeedbackDialog
        open={open}
        onOpenChange={setOpen}
        defaultType={defaultType}
        defaultMessage={defaultMessage}
        projectId={projectId}
      />
    </>
  );
}
