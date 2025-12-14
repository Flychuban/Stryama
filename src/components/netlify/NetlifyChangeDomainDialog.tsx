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
import { Info, Loader2 } from 'lucide-react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NetlifyChangeDomainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deployment: {
    id: string;
    siteId: string;
    siteName: string;
    siteUrl: string;
  };
}

export function NetlifyChangeDomainDialog({
  open,
  onOpenChange,
  deployment,
}: NetlifyChangeDomainDialogProps) {
  const [newSubdomain, setNewSubdomain] = useState('');
  const [subdomainError, setSubdomainError] = useState('');

  const updateMutation = api.netlify.updateSiteName.useMutation({
    onSuccess: (data) => {
      toast.success('Domain updated!', {
        description: `Now at ${data.siteUrl}`,
      });
      onOpenChange(false);
      setNewSubdomain('');
      setSubdomainError('');
    },
    onError: (error) => {
      if (
        error.message.includes('already exists') ||
        error.message.includes('already taken')
      ) {
        setSubdomainError('This subdomain is already taken');
      } else {
        toast.error('Update failed', { description: error.message });
      }
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase();
    setNewSubdomain(val);

    // Validation
    if (!val) {
      setSubdomainError('');
    } else if (!/^[a-z0-9-]+$/.test(val)) {
      setSubdomainError('Only lowercase letters, numbers, and hyphens');
    } else if (val.length > 63) {
      setSubdomainError('Max 63 characters');
    } else if (val.startsWith('-') || val.endsWith('-')) {
      setSubdomainError('Cannot start or end with hyphen');
    } else if (val.includes('--')) {
      setSubdomainError('Cannot have consecutive hyphens');
    } else {
      setSubdomainError('');
    }
  };

  const handleSubmit = () => {
    updateMutation.mutate({
      siteId: deployment.siteId,
      newSubdomain,
      deploymentId: deployment.id,
    });
  };

  // Reset state when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setNewSubdomain('');
      setSubdomainError('');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[425px] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Change Netlify Subdomain</DialogTitle>
          <DialogDescription>
            Update the subdomain for {deployment.siteName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current domain */}
          <div className="space-y-2">
            <Label>Current subdomain</Label>
            <div className="rounded-md bg-muted p-3">
              <code className="text-sm">{deployment.siteName}.netlify.app</code>
            </div>
          </div>

          {/* New subdomain */}
          <div className="space-y-2">
            <Label htmlFor="new-subdomain">New subdomain</Label>
            <div className="relative">
              <Input
                id="new-subdomain"
                value={newSubdomain}
                onChange={handleChange}
                placeholder="my-new-name"
                className={cn('pr-32', subdomainError && 'border-red-500')}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                .netlify.app
              </span>
            </div>
            {subdomainError && (
              <p className="text-xs text-red-500">{subdomainError}</p>
            )}
          </div>

          {/* Warning */}
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
            <div className="flex gap-2">
              <Info className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
              <div className="text-xs text-yellow-700 dark:text-yellow-300">
                <p className="font-medium">Important:</p>
                <ul className="mt-1 space-y-0.5">
                  <li>• The old URL will redirect to the new one</li>
                  <li>• Update any links you&apos;ve shared</li>
                  <li>• This change is immediate</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !newSubdomain || !!subdomainError || updateMutation.isPending
            }
            className="w-full sm:w-auto"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Domain'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
