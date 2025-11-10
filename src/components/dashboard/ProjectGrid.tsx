import { ProjectCard } from './ProjectCard';

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
};

export function ProjectGrid({
  projects,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
}: ProjectGridProps) {
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
