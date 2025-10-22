'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { ProjectGrid } from '@/components/dashboard/ProjectGrid';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { AppHeader } from '@/components/shared/AppHeader';
import { api } from '@/trpc/react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();

  // Fetch projects from backend
  const { data: projects, isLoading } = api.project.getAll.useQuery();

  // Mutations
  const utils = api.useUtils();

  const createProject = api.project.create.useMutation({
    onSuccess: (newProject) => {
      toast.success('Project created successfully!');
      void utils.project.getAll.invalidate();
      router.push(`/editor?id=${newProject.id}`);
    },
    onError: (error) => {
      toast.error('Failed to create project: ' + error.message);
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
    createProject.mutate({
      name: 'Untitled Project',
      description: 'A new project created with Stryama',
    });
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
      });
    }
  };

  const handleDeleteProject = (id: string): void => {
    deleteProject.mutate({ id });
  };

  // Transform projects to match the expected format
  const transformedProjects =
    projects?.map((project) => ({
      id: project.id,
      name: project.name,
      framework: 'React' as const, // Default framework
      lastModified: project.updatedAt,
      thumbnailUrl: undefined,
    })) ?? [];

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
    </div>
  );
}
