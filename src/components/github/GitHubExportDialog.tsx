'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Github, Loader2, CheckCircle2, Info } from 'lucide-react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { GitHubConnectButton } from './GitHubConnectButton';
import { cn } from '@/lib/utils';

interface GitHubExportDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConnectionSuccess?: boolean;
}

export function GitHubExportDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  initialConnectionSuccess,
}: GitHubExportDialogProps) {
  const [exportMode, setExportMode] = useState<'new' | 'existing'>('new');
  const [repoName, setRepoName] = useState(
    projectName.toLowerCase().replace(/\s+/g, '-')
  );
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  const { data: connection, isLoading: connectionLoading } =
    api.github.getConnection.useQuery(undefined, {
      enabled: open,
    });

  // Handle success banner display when connection succeeds
  useEffect(() => {
    if (initialConnectionSuccess && open && connection) {
      setShowSuccessBanner(true);

      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setShowSuccessBanner(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [initialConnectionSuccess, open, connection]);

  const { data: repositories, isLoading: repositoriesLoading } =
    api.github.listRepositories.useQuery(
      { page: 1, perPage: 100 },
      { enabled: exportMode === 'existing' && !!connection }
    );

  const exportMutation = api.github.exportProject.useMutation({
    onSuccess: (data) => {
      toast.success('Export successful!', {
        description: 'Your code has been pushed to GitHub.',
        action: {
          label: 'View on GitHub',
          onClick: () => window.open(data.repoUrl, '_blank'),
        },
      });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Export failed', {
        description: error.message,
      });
    },
  });

  const handleExport = () => {
    if (!connection) return;

    if (exportMode === 'new') {
      if (!repoName.trim()) {
        toast.error('Please enter a repository name');
        return;
      }

      exportMutation.mutate({
        projectId,
        repoOwner: connection.githubUsername,
        repoName: repoName.trim(),
        createNewRepo: true,
        isPrivate: false,
      });
    } else {
      if (!selectedRepo) {
        toast.error('Please select a repository');
        return;
      }

      const [owner, name] = selectedRepo.split('/');
      if (!owner || !name) {
        toast.error('Invalid repository selection');
        return;
      }

      exportMutation.mutate({
        projectId,
        repoOwner: owner,
        repoName: name,
        createNewRepo: false,
      });
    }
  };

  if (connectionLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[425px] sm:max-w-[525px]">
          <div className="flex flex-col items-center justify-center gap-3 py-8 sm:gap-4 sm:py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary sm:h-10 sm:w-10" />
            <div className="space-y-1 text-center sm:space-y-2">
              <p className="text-sm font-medium sm:text-base">
                Checking GitHub connection...
              </p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                This will only take a moment
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!connection) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[425px] p-4 sm:max-w-[525px] sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Github className="h-5 w-5 sm:h-6 sm:w-6" />
              Connect GitHub
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Connect your GitHub account to export projects directly to your
              repositories.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 sm:space-y-4 sm:py-4">
            {/* Benefits card with gradient */}
            <div className="rounded-lg border border-border/50 bg-gradient-to-br from-primary/5 to-primary/10 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 sm:p-2.5">
                  <Github className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="mb-2 text-sm font-semibold sm:text-base">
                    Why connect GitHub?
                  </h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground sm:text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span>Export code to your repositories</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span>Keep your projects synced</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span>Full version control</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick setup steps */}
            <div className="rounded-lg border border-border/30 bg-muted/30 p-3 sm:p-4">
              <h4 className="mb-2 text-xs font-medium sm:text-sm">
                Quick setup (3 steps):
              </h4>
              <ol className="space-y-1 text-xs text-muted-foreground sm:text-sm">
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">1.</span>
                  <span>Click &quot;Connect GitHub&quot; below</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">2.</span>
                  <span>Authorize Stryama on GitHub</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">3.</span>
                  <span>Return here automatically</span>
                </li>
              </ol>
            </div>

            <GitHubConnectButton
              className="h-11 w-full sm:h-10"
              size="default"
            />
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-[525px] overflow-y-auto p-4 sm:max-w-[600px] sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Github className="h-5 w-5 sm:h-6 sm:w-6" />
            Export to GitHub
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Push your code to a GitHub repository as{' '}
            <span className="font-medium text-foreground">
              {connection.githubUsername}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Success banner - shown after OAuth return */}
        {showSuccessBanner && (
          <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-3 duration-300 animate-in slide-in-from-top-2 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Successfully connected to GitHub!
                </p>
                <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                  Choose how you&apos;d like to export your project below.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 py-3 sm:space-y-5 sm:py-4">
          {/* Card-style export options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Choose export method</Label>
            <RadioGroup
              value={exportMode}
              onValueChange={(v) => setExportMode(v as 'new' | 'existing')}
              className="space-y-2 sm:space-y-3"
            >
              {/* New repository card */}
              <div
                className={cn(
                  'relative cursor-pointer rounded-lg border-2 p-3 transition-all sm:p-4',
                  exportMode === 'new'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border/80 hover:bg-muted/50'
                )}
                onClick={() => setExportMode('new')}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="new" id="new" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="new"
                      className="cursor-pointer text-sm font-medium sm:text-base"
                    >
                      Create new repository
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      Start fresh with a new public repository
                    </p>
                  </div>
                  {exportMode === 'new' && (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                  )}
                </div>
              </div>

              {/* Existing repository card */}
              <div
                className={cn(
                  'relative cursor-pointer rounded-lg border-2 p-3 transition-all sm:p-4',
                  exportMode === 'existing'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border/80 hover:bg-muted/50'
                )}
                onClick={() => setExportMode('existing')}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value="existing"
                    id="existing"
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="existing"
                      className="cursor-pointer text-sm font-medium sm:text-base"
                    >
                      Push to existing repository
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      Update code in one of your existing repos
                    </p>
                  </div>
                  {exportMode === 'existing' && (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Form inputs - mobile optimized */}
          {exportMode === 'new' ? (
            <div className="space-y-2">
              <Label htmlFor="repoName" className="text-sm sm:text-base">
                Repository name
              </Label>
              <Input
                id="repoName"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="my-awesome-app"
                className="h-11 font-mono text-base sm:h-10 sm:text-sm"
              />
              <div className="flex items-start gap-2 rounded-md bg-muted/50 p-2 sm:p-3">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Repository will be created as <strong>public</strong> under
                  your GitHub account
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="existingRepo" className="text-sm sm:text-base">
                Select repository
              </Label>
              {repositoriesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : repositories && repositories.length > 0 ? (
                <select
                  id="existingRepo"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
                  value={selectedRepo}
                  onChange={(e) => setSelectedRepo(e.target.value)}
                >
                  <option value="">Select a repository...</option>
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.fullName}>
                      {repo.fullName} {repo.private ? '(Private)' : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No repositories found. Create a new one instead.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={exportMutation.isPending}
            className="h-11 w-full sm:h-10 sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={
              exportMutation.isPending ||
              (exportMode === 'new' && !repoName.trim()) ||
              (exportMode === 'existing' && !selectedRepo)
            }
            className="h-11 w-full sm:h-10 sm:w-auto"
          >
            {exportMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {exportMutation.isPending ? 'Exporting...' : 'Export to GitHub'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
