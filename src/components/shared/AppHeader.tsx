'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { User, MessageCircle, Shield } from 'lucide-react';
import Link from 'next/link';
import { useUser, useClerk } from '@clerk/nextjs';
import { Logo } from '@/components/shared/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog';
import { api } from '@/trpc/react';

export function AppHeader() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Check if user is admin via tRPC
  const { data: userIsAdmin = false } = api.feedback.checkIsAdmin.useQuery(
    undefined,
    {
      enabled: !!user,
    }
  );

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center">
            <Logo size={32} showText={true} />
          </Link>

          <nav className="flex items-center gap-4">
            {isLoaded && user ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={user.imageUrl}
                          alt={user.firstName ?? ''}
                        />
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">
                          {user.firstName?.[0]}
                          {user.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline">{user.firstName}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={() => setFeedbackOpen(true)}
                      className="cursor-pointer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Send Feedback
                    </DropdownMenuItem>

                    {userIsAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link
                            href="/admin/feedback"
                            className="cursor-pointer"
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Admin Dashboard
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => signOut()}
                      className="cursor-pointer text-destructive"
                    >
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/sign-in">Sign In</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/sign-up">Get Started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Feedback Dialog */}
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
