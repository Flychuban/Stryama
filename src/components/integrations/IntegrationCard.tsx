'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Unlink } from 'lucide-react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { GitHubConnectButton } from '@/components/github/GitHubConnectButton';
import { NetlifyConnectButton } from '@/components/netlify/NetlifyConnectButton';

interface IntegrationCardProps {
  name: 'GitHub' | 'Netlify';
  description: string;
  icon: React.ReactNode;
  type: 'github' | 'netlify';
}

export function IntegrationCard({
  name,
  description,
  icon,
  type,
}: IntegrationCardProps) {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Query connection status based on type
  const githubConnection = api.github.getConnection.useQuery(undefined, {
    enabled: type === 'github',
  });

  const netlifyConnection = api.netlify.getConnection.useQuery(undefined, {
    enabled: type === 'netlify',
  });

  // Keep queries separate for type safety
  const isLoading =
    type === 'github'
      ? githubConnection.isLoading
      : netlifyConnection.isLoading;

  const utils = api.useUtils();

  // Disconnect mutation based on type
  const githubDisconnect = api.github.disconnect.useMutation({
    onSuccess: async () => {
      toast.success(`${name} disconnected`);
      setShowDisconnectDialog(false);

      // Invalidate queries
      await utils.github.getConnection.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to disconnect ${name}`, {
        description: error.message,
      });
    },
  });

  const netlifyDisconnect = api.netlify.disconnect.useMutation({
    onSuccess: async () => {
      toast.success(`${name} disconnected`);
      setShowDisconnectDialog(false);

      // Invalidate queries
      await utils.netlify.getConnection.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to disconnect ${name}`, {
        description: error.message,
      });
    },
  });

  const disconnectMutation =
    type === 'github' ? githubDisconnect : netlifyDisconnect;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
              {icon}
            </div>
            <div>
              <CardTitle>{name}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>

          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
              type === 'github' ? githubConnection.data : netlifyConnection.data
            ) ? (
            <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:text-green-400">
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">Not Connected</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {(
          type === 'github' ? githubConnection.data : netlifyConnection.data
        ) ? (
          <div className="space-y-4">
            {/* Account Info */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {type === 'github'
                      ? (githubConnection.data?.githubUsername?.[0]?.toUpperCase() ??
                        'G')
                      : (netlifyConnection.data?.netlifyEmail?.[0]?.toUpperCase() ??
                        'N')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {type === 'github'
                      ? `@${githubConnection.data?.githubUsername}`
                      : netlifyConnection.data?.netlifyEmail}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Connected{' '}
                    {type === 'github' && githubConnection.data?.connectedAt
                      ? formatDistanceToNow(
                          new Date(githubConnection.data.connectedAt),
                          {
                            addSuffix: true,
                          }
                        )
                      : netlifyConnection.data?.connectedAt
                        ? formatDistanceToNow(
                            new Date(netlifyConnection.data.connectedAt),
                            {
                              addSuffix: true,
                            }
                          )
                        : 'recently'}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDisconnectDialog(true)}
                disabled={disconnectMutation.isPending}
                className="flex-1"
              >
                <Unlink className="mr-2 h-4 w-4" />
                Disconnect
              </Button>

              {type === 'github' ? (
                <GitHubConnectButton variant="outline" className="flex-1" />
              ) : (
                <NetlifyConnectButton variant="outline" className="flex-1" />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {type === 'github'
                ? 'Connect your GitHub account to export projects to repositories'
                : 'Connect your Netlify account to deploy projects with one click'}
            </p>

            {type === 'github' ? (
              <GitHubConnectButton />
            ) : (
              <NetlifyConnectButton />
            )}
          </div>
        )}
      </CardContent>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog
        open={showDisconnectDialog}
        onOpenChange={setShowDisconnectDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove access to your{' '}
              {type === 'github' ? 'repositories' : 'sites'}.
              {type === 'github' && ' Your export history will be preserved.'}
              {type === 'netlify' &&
                ' Your deployment history will be preserved.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
