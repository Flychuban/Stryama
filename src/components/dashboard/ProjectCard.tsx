'use client';

// 1. External libraries
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Code2, Copy, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// 4. UI components
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Project = {
  id: string;
  name: string;
  lastModified: Date;
  thumbnailUrl?: string;
};

type ProjectCardProps = {
  project: Project;
  onOpen: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ProjectCard({
  project,
  onOpen,
  onDuplicate,
  onDelete,
}: ProjectCardProps) {
  const router = useRouter();
  const [showActions, setShowActions] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = (): void => {
    setShowDeleteDialog(false);
    onDelete(project.id);
  };

  return (
    <>
      <Card
        className="group relative h-[200px] w-full cursor-pointer overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-2 hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/10"
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={() => onOpen(project.id)}
      >
        {/* Glow effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Thumbnail */}
        <div className="relative h-[120px] overflow-hidden border-b border-border/50 bg-gradient-to-br from-primary/10 via-accent/5 to-primary/10 transition-colors group-hover:border-primary/30">
          {project.thumbnailUrl ? (
            <Image
              src={project.thumbnailUrl}
              alt={project.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="relative flex h-full items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <Code2 className="relative z-10 h-12 w-12 text-primary/30 transition-colors group-hover:text-primary/50" />
            </div>
          )}

          {/* Action Overlay */}
          <div
            className={`absolute inset-0 flex items-center justify-center gap-2 bg-gradient-to-t from-background/95 via-background/80 to-transparent transition-all duration-300 ${
              showActions ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <Button
              size="sm"
              className="shadow-lg transition-all hover:scale-105 hover:shadow-xl hover:shadow-primary/30"
              onClick={(e) => {
                e.stopPropagation();
                router.push('/editor');
              }}
            >
              Open
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-background/90 backdrop-blur-sm transition-all hover:scale-105 hover:bg-background"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(project.id);
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-background/90 backdrop-blur-sm transition-all hover:scale-105 hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Metadata */}
        <CardContent className="relative z-10 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold transition-all group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-accent group-hover:bg-clip-text group-hover:text-transparent">
                {project.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDistanceToNow(project.lastModified, { addSuffix: true })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{project.name}&rdquo;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
