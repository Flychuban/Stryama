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
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 w-9" />
              </div>
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
