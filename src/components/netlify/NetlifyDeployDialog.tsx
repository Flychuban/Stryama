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
import { Cloud, Loader2, CheckCircle2, Info, ExternalLink } from 'lucide-react';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import { NetlifyConnectButton } from './NetlifyConnectButton';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NetlifyDeployDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConnectionSuccess?: boolean;
}

export function NetlifyDeployDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
  initialConnectionSuccess,
}: NetlifyDeployDialogProps) {
  const [deployMode, setDeployMode] = useState<'new' | 'existing'>('new');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [customSubdomain, setCustomSubdomain] = useState<string>('');
  const [subdomainError, setSubdomainError] = useState<string>('');
  const [deploymentSuccess, setDeploymentSuccess] = useState<{
    siteUrl: string;
    deployUrl: string;
    adminUrl: string;
    siteName: string;
    filesDeployed?: number;
  } | null>(null);

  const utils = api.useUtils();

  const { data: connection, isLoading: connectionLoading } =
    api.netlify.getConnection.useQuery(undefined, {
      enabled: open,
    });

  // Query recent deployments for smart defaults
  const { data: recentDeployments } =
    api.netlify.getProjectDeployments.useQuery(
      { projectId },
      { enabled: open && !!projectId }
    );

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

  // Smart defaults: Auto-select existing site if previous deployment exists
  useEffect(() => {
    if (open && recentDeployments?.length) {
      const lastSuccessful = recentDeployments.find(
        (d: { status: string }) => d.status === 'COMPLETED'
      );
      if (lastSuccessful) {
        setDeployMode('existing');
        setSelectedSiteId(lastSuccessful.siteId);
      }
    } else if (open) {
      // Reset to defaults when opening without previous deployments
      setDeployMode('new');
      setSelectedSiteId('');
    }
  }, [open, recentDeployments]);

  // Reset deployment success state when dialog closes
  useEffect(() => {
    if (!open) {
      setDeploymentSuccess(null);
      setCustomSubdomain('');
      setSubdomainError('');
    }
  }, [open]);

  const { data: sites, isLoading: sitesLoading } =
    api.netlify.listSites.useQuery(undefined, {
      enabled: deployMode === 'existing' && !!connection,
    });

  const deployMutation = api.netlify.deployProject.useMutation({
    onSuccess: async (data) => {
      setDeploymentSuccess({
        siteUrl: data.siteUrl,
        deployUrl: data.deployUrl ?? data.siteUrl,
        adminUrl: data.adminUrl,
        siteName: data.siteName,
        filesDeployed: data.filesDeployed,
      });
      toast.success('Deployment successful!', {
        description: 'Your site is now live on Netlify.',
      });

      // Invalidate queries to refresh UI
      await utils.netlify.getProjectDeployments.invalidate({ projectId });
      await utils.netlify.getConnection.invalidate();
      await utils.netlify.listSites.invalidate();
    },
    onError: (error) => {
      // Primary: Check TRPC error code
      if (error.data?.code === 'CONFLICT') {
        setSubdomainError(
          'This subdomain is already taken. Please choose another.'
        );
        return; // Don't show toast for domain conflicts
      }

      // Fallback: Check message string
      if (
        error.message.includes('already exists') ||
        error.message.includes('already taken') ||
        error.message.toLowerCase().includes('conflict')
      ) {
        setSubdomainError(
          'This subdomain is already taken. Please choose another.'
        );
        return;
      }

      // All other errors show toast
      toast.error('Deployment failed', {
        description: error.message,
      });
    },
  });

  const handleDeploy = () => {
    if (!connection) return;

    if (deployMode === 'existing' && !selectedSiteId) {
      toast.error('Please select a site');
      return;
    }

    // Check for subdomain validation errors
    if (deployMode === 'new' && customSubdomain && subdomainError) {
      toast.error('Please fix subdomain errors before deploying');
      return;
    }

    deployMutation.mutate({
      projectId,
      projectName,
      existingSiteId: deployMode === 'existing' ? selectedSiteId : null,
      customSubdomain:
        deployMode === 'new' && customSubdomain ? customSubdomain : null,
    });
  };

  if (connectionLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[425px] sm:max-w-[525px]">
          <div className="flex flex-col items-center justify-center gap-3 py-8 sm:gap-4 sm:py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary sm:h-10 sm:w-10" />
            <div className="space-y-1 text-center sm:space-y-2">
              <p className="text-sm font-medium sm:text-base">
                Checking Netlify connection...
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

  // Success view - shown after successful deployment
  if (deploymentSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[525px] p-4 sm:max-w-[600px] sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              Deployment Successful!
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Your project is now live on Netlify
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Success animation banner */}
            <div className="rounded-lg border-2 border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-500/5 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-green-500/10 p-2 sm:p-2.5">
                  <Cloud className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="mb-1 text-sm font-semibold text-green-900 dark:text-green-100">
                    {deploymentSuccess.siteName}
                  </h4>
                  <p className="mb-3 text-xs text-green-700 dark:text-green-300">
                    {deploymentSuccess.filesDeployed ?? 0} files deployed
                    successfully
                  </p>

                  {/* URLs section */}
                  <div className="space-y-2">
                    <div className="rounded-md bg-background/50 p-2.5">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Site URL
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 overflow-hidden text-ellipsis text-xs sm:text-sm">
                          {deploymentSuccess.siteUrl}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0 px-2"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              deploymentSuccess.siteUrl
                            );
                            toast.success('URL copied to clipboard!');
                          }}
                        >
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => window.open(deploymentSuccess.siteUrl, '_blank')}
                className="h-11 flex-1 gap-2 sm:h-10"
              >
                <ExternalLink className="h-4 w-4" />
                View Live Site
              </Button>
              <Button
                onClick={() =>
                  window.open(deploymentSuccess.adminUrl, '_blank')
                }
                variant="outline"
                className="h-11 flex-1 gap-2 sm:h-10"
              >
                <ExternalLink className="h-4 w-4" />
                View in Netlify Dashboard
              </Button>
            </div>

            {/* Info box */}
            <div className="rounded-lg border border-border/30 bg-muted/30 p-3 sm:p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-primary" />
                What&apos;s next?
              </h4>
              <ul className="space-y-1 text-xs text-muted-foreground sm:text-sm">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Share your live URL with anyone</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Deploy again to update your site</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Manage deployments in your Netlify dashboard</span>
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => {
                setDeploymentSuccess(null);
              }}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              Deploy Again
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="h-11 w-full sm:h-10 sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
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
              <Cloud className="h-5 w-5 sm:h-6 sm:w-6" />
              Connect Netlify
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Connect your Netlify account to deploy projects with one click.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 sm:space-y-4 sm:py-4">
            {/* Benefits card with gradient */}
            <div className="rounded-lg border border-border/50 bg-gradient-to-br from-primary/5 to-primary/10 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 sm:p-2.5">
                  <Cloud className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="mb-2 text-sm font-semibold sm:text-base">
                    Why connect Netlify?
                  </h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground sm:text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span>One-click deployment to production</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span>Free tier: 100GB bandwidth/month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span>Auto SSL + custom subdomains</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                      <span>Deploy to your own account</span>
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
                  <span>Click &quot;Connect Netlify&quot; below</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">2.</span>
                  <span>Authorize Stryama on Netlify</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-medium text-foreground">3.</span>
                  <span>Return here automatically</span>
                </li>
              </ol>
            </div>

            <NetlifyConnectButton
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
            <Cloud className="h-5 w-5 sm:h-6 sm:w-6" />
            Deploy to Netlify
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Deploy your project to production as{' '}
            <span className="font-medium text-foreground">
              {connection.netlifyEmail}
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
                  Successfully connected to Netlify!
                </p>
                <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                  Choose how you&apos;d like to deploy your project below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Smart defaults info banner */}
        {recentDeployments &&
          recentDeployments.length > 0 &&
          deployMode === 'existing' &&
          selectedSiteId && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 duration-300 animate-in fade-in-50 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <Info className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Updating existing site
                  </p>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                    Changes will deploy to:{' '}
                    <strong>
                      {
                        sites?.find(
                          (s: { id: string }) => s.id === selectedSiteId
                        )?.name
                      }
                    </strong>
                  </p>
                </div>
              </div>
            </div>
          )}

        <div className="space-y-4 py-3 sm:space-y-5 sm:py-4">
          {/* Card-style deploy options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Choose deployment method
            </Label>
            <RadioGroup
              value={deployMode}
              onValueChange={(v) => setDeployMode(v as 'new' | 'existing')}
              className="space-y-2 sm:space-y-3"
            >
              {/* New site card */}
              <div
                className={cn(
                  'relative cursor-pointer rounded-lg border-2 p-3 transition-all sm:p-4',
                  deployMode === 'new'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border/80 hover:bg-muted/50'
                )}
                onClick={() => setDeployMode('new')}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="new" id="new" className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <Label
                      htmlFor="new"
                      className="cursor-pointer text-sm font-medium sm:text-base"
                    >
                      Create new site
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      Deploy to a new auto-generated subdomain (e.g.,
                      project-name-abc123.netlify.app)
                    </p>
                  </div>
                  {deployMode === 'new' && (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                  )}
                </div>
              </div>

              {/* Existing site card */}
              <div
                className={cn(
                  'relative cursor-pointer rounded-lg border-2 p-3 transition-all sm:p-4',
                  deployMode === 'existing'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border/80 hover:bg-muted/50'
                )}
                onClick={() => setDeployMode('existing')}
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
                      Update existing site
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                      Deploy to one of your existing Netlify sites
                    </p>
                  </div>
                  {deployMode === 'existing' && (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
                  )}
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Custom subdomain input for new sites */}
          {deployMode === 'new' && (
            <div className="space-y-2 duration-300 animate-in fade-in-50 slide-in-from-top-1">
              <Label htmlFor="subdomain" className="text-sm font-medium">
                Custom subdomain (optional)
              </Label>
              <div className="relative">
                <Input
                  id="subdomain"
                  type="text"
                  value={customSubdomain}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase();
                    setCustomSubdomain(val);

                    // Client-side validation
                    if (!val) {
                      setSubdomainError('');
                    } else if (!/^[a-z0-9-]+$/.test(val)) {
                      setSubdomainError(
                        'Only lowercase letters, numbers, and hyphens'
                      );
                    } else if (val.length > 63) {
                      setSubdomainError('Max 63 characters');
                    } else if (val.startsWith('-') || val.endsWith('-')) {
                      setSubdomainError('Cannot start or end with hyphen');
                    } else if (val.includes('--')) {
                      setSubdomainError('Cannot have consecutive hyphens');
                    } else {
                      setSubdomainError('');
                    }
                  }}
                  placeholder="my-awesome-site"
                  className={cn(
                    'h-11 pr-32',
                    subdomainError &&
                      'border-red-500 focus-visible:ring-red-500'
                  )}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  .netlify.app
                </div>
              </div>
              {subdomainError && (
                <p className="text-xs text-red-500">{subdomainError}</p>
              )}
              {!subdomainError && customSubdomain && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Your site will be:{' '}
                  <strong>{customSubdomain}.netlify.app</strong>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Leave empty for auto-generated subdomain
              </p>

              {/* Domain conflict error banner */}
              {subdomainError && customSubdomain && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 duration-300 animate-in fade-in-50">
                  <div className="flex items-start gap-2">
                    <Info className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-red-900 dark:text-red-100">
                        Subdomain unavailable
                      </p>
                      <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                        {subdomainError}
                      </p>
                      <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                        Please choose a different subdomain or leave blank for
                        auto-generation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Existing site selector */}
          {deployMode === 'existing' && (
            <div className="space-y-2 duration-300 animate-in fade-in-50 slide-in-from-top-1">
              <Label htmlFor="site-select" className="text-sm font-medium">
                Select site
              </Label>
              {sitesLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your Netlify sites...
                </div>
              ) : sites && sites.length > 0 ? (
                <Select
                  value={selectedSiteId}
                  onValueChange={setSelectedSiteId}
                >
                  <SelectTrigger id="site-select" className="h-11 w-full">
                    <SelectValue placeholder="Choose a site to update..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{site.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({new URL(site.url).hostname})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  <p>No existing sites found.</p>
                  <p className="mt-1 text-xs">
                    Choose &quot;Create new site&quot; to deploy.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info banner */}
          <div className="flex gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-3 sm:p-4">
            <Info className="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                What happens during deployment?
              </p>
              <ul className="space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                <li>• Build your project in the preview environment</li>
                <li>• Create optimized production build</li>
                <li>• Upload to Netlify (may take 1-2 minutes)</li>
                <li>• Your site will be live immediately after</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={deployMutation.isPending}
            className="h-11 w-full sm:h-10 sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeploy}
            disabled={deployMutation.isPending}
            className="h-11 w-full gap-2 sm:h-10 sm:w-auto"
          >
            {deployMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4" />
                Deploy to Netlify
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
