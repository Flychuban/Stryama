'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Heart } from 'lucide-react';
import { FeedbackDialog } from '~/components/feedback/FeedbackDialog';

export function AppFooter() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            {/* Left side - Copyright */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>Built with</span>
              <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
              <span>by Stryama</span>
            </div>

            {/* Right side - Links */}
            <div className="flex items-center gap-6 text-sm">
              <button
                onClick={() => setFeedbackOpen(true)}
                className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Send Feedback</span>
              </button>

              <Link
                href="/privacy"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy
              </Link>

              <Link
                href="/terms"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Feedback Dialog */}
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
