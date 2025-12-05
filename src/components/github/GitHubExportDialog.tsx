'use client';

import { useState } from 'react';
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
import { Github, Loader2 } from 'lucide-react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { GitHubConnectButton } from './GitHubConnectButton';

interface GitHubExportDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GitHubExportDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: GitHubExportDialogProps) {
  const [exportMode, setExportMode] = useState<'new' | 'existing'>('new');
  const [repoName, setRepoName] = useState(
    projectName.toLowerCase().replace(/\s+/g, '-')
  );
  const [selectedRepo, setSelectedRepo] = useState<string>('');

  const { data: connection, isLoading: connectionLoading } =
    api.github.getConnection.useQuery(undefined, {
      enabled: open,
    });

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
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!connection) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Connect GitHub
            </DialogTitle>
            <DialogDescription>
              Connect your GitHub account to export projects directly to your
              repositories.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4">
              <h4 className="mb-2 font-medium">Why connect GitHub?</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Export code to your repositories</li>
                <li>• Keep your projects synced</li>
                <li>• Full version control</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border/50 bg-background p-4">
              <h4 className="mb-2 text-sm font-medium">How to connect:</h4>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>1. Click the button below</li>
                <li>2. Authorize Stryama on GitHub</li>
                <li>3. You&apos;ll be redirected back automatically</li>
              </ol>
            </div>

            <GitHubConnectButton className="w-full" />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Export to GitHub
          </DialogTitle>
          <DialogDescription>
            Push your code to a GitHub repository as{' '}
            <span className="font-medium">{connection.githubUsername}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup
            value={exportMode}
            onValueChange={(v) => setExportMode(v as 'new' | 'existing')}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new" className="cursor-pointer font-normal">
                Create new repository
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existing" id="existing" />
              <Label htmlFor="existing" className="cursor-pointer font-normal">
                Push to existing repository
              </Label>
            </div>
          </RadioGroup>

          {exportMode === 'new' ? (
            <div className="space-y-2">
              <Label htmlFor="repoName">Repository name</Label>
              <Input
                id="repoName"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="my-awesome-app"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Will be created as public repository
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="existingRepo">Select repository</Label>
              {repositoriesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : repositories && repositories.length > 0 ? (
                <select
                  id="existingRepo"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={exportMutation.isPending}
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
          >
            {exportMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Export to GitHub
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
