'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

import { api } from '@/trpc/react';
import { usePromptHandoff } from '@/hooks/usePromptHandoff';

import { Button } from '@/components/ui/button';
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { AppHeader } from '@/components/shared/AppHeader';
import { AppFooter } from '@/components/shared/AppFooter';
import { CreateProjectDialog } from '@/components/dashboard/CreateProjectDialog';
import {
  LimitReachedDialog,
  type LimitType,
} from '@/components/shared/LimitReachedDialog';

export default function DashboardPage() {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [pendingPromptData, setPendingPromptData] = useState<{
    prompt: string;
  } | null>(null);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [limitDialogData, setLimitDialogData] = useState<{
    type: LimitType;
    currentUsage: number;
    limit: number;
    plan: 'FREE' | 'BUILDER' | 'PRO';
  } | null>(null);

  // Prevent duplicate execution in React 18 Strict Mode
  const hasInitiatedCreation = useRef(false);

  const { retrievePrompt, clearPrompt } = usePromptHandoff();

  // Fetch projects from backend
  const { data: projects, isLoading } = api.project.getAll.useQuery();

  // Fetch usage stats
  const { data: usageStats } = api.usage.getStats.useQuery();

  // Mutations
  const utils = api.useUtils();

  const createProject = api.project.create.useMutation({
    onSuccess: (newProject) => {
      toast.success('Project created successfully!');
      void utils.project.getAll.invalidate();
      setIsDialogOpen(false);

      // Check if this was an auto-creation from landing page
      if (isAutoCreating && pendingPromptData) {
        // Store the prompt for auto-start in editor
        sessionStorage.setItem('initialPrompt', pendingPromptData.prompt);

        // Clear the pending prompt from storage
        clearPrompt();

        // Redirect to editor with auto-start
        router.push(`/editor?id=${newProject.id}&autoStart=true`);
      } else {
        router.push(`/editor?id=${newProject.id}`);
      }
    },
    onError: (error) => {
      const errorMessage = error.message.toLowerCase();
      const isProjectLimit = errorMessage.includes('project limit');
      const isGenerationLimit = errorMessage.includes('generation limit');
      const isLimitError = isProjectLimit || isGenerationLimit;

      if (isLimitError && usageStats) {
        // Show limit dialog instead of just a toast
        setLimitDialogData({
          type: isProjectLimit ? 'project' : 'generation',
          currentUsage: isProjectLimit
            ? usageStats.projectsUsed
            : usageStats.generationsUsed,
          limit: isProjectLimit
            ? usageStats.projectsLimit
            : usageStats.generationsLimit,
          plan: usageStats.plan,
        });
        setShowLimitDialog(true);

        // Clear the pending prompt since we can't proceed
        if (pendingPromptData) {
          clearPrompt();
        }
      } else {
        // Show regular error toast for non-limit errors
        toast.error('Failed to create project: ' + error.message);
      }

      setIsAutoCreating(false);
      setPendingPromptData(null);
      // Reset the flag so user can retry
      hasInitiatedCreation.current = false;
    },
  });

  const deleteProject = api.project.delete.useMutation({
    onSuccess: () => {
      toast.success('Project deleted successfully!');
      void utils.project.getAll.invalidate();
    },
    onError: (error) => {
      toast.error('Failed to delete project: ' + error.message);
    },
  });

  const duplicateProject = api.project.create.useMutation({
    onSuccess: () => {
      toast.success('Project duplicated successfully!');
      void utils.project.getAll.invalidate();
    },
    onError: (error) => {
      toast.error('Failed to duplicate project: ' + error.message);
    },
  });

  const handleNewProject = (): void => {
    setIsDialogOpen(true);
  };

  const handleCreateProject = (data: { name: string }): void => {
    createProject.mutate(data);
  };

  const handleOpenProject = (id: string): void => {
    router.push(`/editor?id=${id}`);
  };

  const handleDuplicateProject = (id: string): void => {
    const projectToDuplicate = projects?.find((p) => p.id === id);
    if (projectToDuplicate) {
      duplicateProject.mutate({
        name: `${projectToDuplicate.name} (Copy)`,
      });
    }
  };

  const handleDeleteProject = (id: string): void => {
    deleteProject.mutate({ id });
  };

  // Generate a concise project name from prompt (max 50 chars)
  const generateProjectName = (promptText: string): string => {
    const words = promptText.trim().split(/\s+/).slice(0, 5);
    let name = words.join(' ');
    if (name.length > 50) {
      name = name.substring(0, 47) + '...';
    }
    return name || 'New Project';
  };

  // Check for pending prompt from landing page on mount
  useEffect(() => {
    // Prevent duplicate execution in React 18 Strict Mode
    if (hasInitiatedCreation.current) {
      return;
    }

    const storedData = retrievePrompt();

    if (storedData) {
      // Mark as initiated to prevent duplicate execution
      hasInitiatedCreation.current = true;

      setIsAutoCreating(true);
      setPendingPromptData(storedData);
      toast.info('Setting up your workspace...');

      // Create project with stored prompt
      createProject.mutate({
        name: generateProjectName(storedData.prompt),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Transform projects to match the expected format
  const transformedProjects =
    projects?.map((project) => ({
      id: project.id,
      name: project.name,
      lastModified: project.updatedAt,
      thumbnailUrl: undefined,
    })) ?? [];

  // Show loading overlay during auto-creation
  if (isAutoCreating) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <h2 className="text-2xl font-semibold">
                Creating your project...
              </h2>
              <p className="mt-2 text-muted-foreground">
                Setting up your workspace and getting ready to build
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 animate-gradient-shift opacity-40" />
        <div className="absolute right-0 top-0 h-[500px] w-[500px] animate-float rounded-full bg-primary/20 blur-[120px]" />
        <div
          className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/20 blur-[100px]"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <header className="sticky top-16 z-30 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-auto min-h-24 max-w-7xl flex-col items-start justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center sm:py-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-3xl font-bold text-transparent sm:text-4xl">
                My Projects
              </h1>
              {transformedProjects.length > 0 && (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {transformedProjects.length}
                </span>
              )}
              {usageStats && (
                <Link
                  href="/profile"
                  className="group flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm transition-all hover:bg-blue-100 hover:shadow-sm dark:border-blue-800 dark:bg-blue-950"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      {usageStats.generationsRemaining}
                    </span>

                    {/* Mini progress bar */}
                    <div className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900 sm:block">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300 dark:bg-blue-400"
                        style={{
                          width: `${Math.max(0, Math.min(100, (usageStats.generationsRemaining / usageStats.generationsLimit) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Warning icon */}
                  {usageStats.generationsRemaining < 10 && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  )}
                </Link>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Build amazing applications without writing code
            </p>
          </div>
          <Button
            onClick={handleNewProject}
            size="lg"
            disabled={createProject.isPending}
            className="group relative overflow-hidden shadow-lg transition-all hover:shadow-xl hover:shadow-primary/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-0 transition-opacity group-hover:opacity-100" />
            {createProject.isPending ? (
              <Loader2 className="relative z-10 mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Plus className="relative z-10 mr-2 h-5 w-5" />
            )}
            <span className="relative z-10">New Project</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        {!isLoading && transformedProjects.length === 0 ? (
          <EmptyState onCreateProject={handleNewProject} />
        ) : (
          <ProjectGrid
            projects={transformedProjects}
            onOpenProject={handleOpenProject}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
            isLoading={isLoading}
          />
        )}
      </main>

      <CreateProjectDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateProject={handleCreateProject}
        isCreating={createProject.isPending}
      />

      {limitDialogData && (
        <LimitReachedDialog
          open={showLimitDialog}
          onOpenChange={setShowLimitDialog}
          limitType={limitDialogData.type}
          currentUsage={limitDialogData.currentUsage}
          limit={limitDialogData.limit}
          plan={limitDialogData.plan}
        />
      )}

      <AppFooter />
    </div>
  );
}
