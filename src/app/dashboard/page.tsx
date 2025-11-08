'use client';

// 1. External libraries
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { type Framework } from '@prisma/client';

// 2. Internal utilities
import { api } from '@/trpc/react';
import { usePromptHandoff } from '@/hooks/usePromptHandoff';
import Link from 'next/link';

// 4. UI components
import { Button } from '@/components/ui/button';

// 6. Local components
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { AppHeader } from '@/components/shared/AppHeader';
import { CreateProjectDialog } from '@/components/dashboard/CreateProjectDialog';

export default function DashboardPage() {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAutoCreating, setIsAutoCreating] = useState(false);
  const [pendingPromptData, setPendingPromptData] = useState<{
    prompt: string;
    framework: Framework;
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
      toast.error('Failed to create project: ' + error.message);
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

  const handleCreateProject = (data: {
    name: string;
    description?: string;
    framework: Framework;
  }): void => {
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
        description: projectToDuplicate.description ?? '',
        framework: projectToDuplicate.framework,
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
        description: storedData.prompt,
        framework: storedData.framework,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Transform projects to match the expected format
  const transformedProjects =
    projects?.map((project) => ({
      id: project.id,
      name: project.name,
      framework: project.framework,
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

      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="gradient-mesh absolute inset-0 animate-gradient-shift opacity-40" />
        <div className="absolute right-0 top-0 h-[500px] w-[500px] animate-float rounded-full bg-primary/20 blur-[120px]" />
        <div
          className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-accent/20 blur-[100px]"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Page Header */}
      <header className="sticky top-16 z-30 border-b border-border/40 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-24 max-w-7xl items-center justify-between px-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-4xl font-bold text-transparent">
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
                  className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm transition-colors hover:bg-blue-100"
                >
                  <span className="font-medium text-blue-900">
                    {usageStats.generationsRemaining} remaining
                  </span>
                  {usageStats.generationsRemaining < 10 && (
                    <span className="text-xs text-amber-600">⚠️</span>
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

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : transformedProjects.length === 0 ? (
          <EmptyState onCreateProject={handleNewProject} />
        ) : (
          <ProjectGrid
            projects={transformedProjects}
            onOpenProject={handleOpenProject}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
          />
        )}
      </main>

      <CreateProjectDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateProject={handleCreateProject}
        isCreating={createProject.isPending}
      />
    </div>
  );
}
