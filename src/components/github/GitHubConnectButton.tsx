'use client';

import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useState } from 'react';
import { toast } from 'sonner';

interface GitHubConnectButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

/**
 * Button component to connect GitHub account
 * Uses server-side OAuth flow to avoid step-up authentication requirements
 */
export function GitHubConnectButton({
  className,
  variant = 'default',
  size = 'default',
}: GitHubConnectButtonProps) {
  const { user } = useUser();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    if (!user) {
      toast.error('Please sign in first.');
      return;
    }

    setIsConnecting(true);

    // Preserve current URL for return after OAuth
    // Use relative path (pathname + search) to pass security validation
    const currentUrl = window.location.href;
    const returnUrl = new URL(currentUrl);
    returnUrl.searchParams.set('github_connected', 'true');

    // Redirect to server endpoint that initiates GitHub OAuth
    // This server-side approach bypasses Clerk's step-up authentication requirement
    const connectUrl = new URL('/api/github/connect', window.location.origin);
    // Use pathname + search (relative URL) instead of full URL to pass security validation
    connectUrl.searchParams.set(
      'return_url',
      returnUrl.pathname + returnUrl.search
    );

    window.location.href = connectUrl.toString();

    // Note: isConnecting state persists until redirect happens
  };

  return (
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      variant={variant}
      size={size}
      className={className}
    >
      <Github className="mr-2 h-4 w-4" />
      {isConnecting ? 'Redirecting...' : 'Connect GitHub'}
    </Button>
  );
}
