import { ProjectCard } from './ProjectCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Project = {
  id: string;
  name: string;
  lastModified: Date;
  thumbnailUrl?: string;
};

type ProjectGridProps = {
  projects: Project[];
  onOpenProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  isLoading?: boolean;
};

export function ProjectGrid({
  projects,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  isLoading = false,
}: ProjectGridProps) {
  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-[200px] overflow-hidden">
            <div className="h-[120px] animate-pulse bg-muted/50" />
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project, index) => (
        <div
          key={project.id}
          className="animate-fade-in"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <ProjectCard
            project={project}
            onOpen={onOpenProject}
            onDuplicate={onDuplicateProject}
            onDelete={onDeleteProject}
          />
        </div>
      ))}
    </div>
  );
}
