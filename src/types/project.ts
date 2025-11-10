// Project-related types - using Prisma-generated types for consistency
import type { Project, File, Sandbox } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Project, File as ProjectFile, Sandbox };

// Extended types with relations
export type ProjectWithDetails = Project & {
  files: File[];
  sandboxes: Sandbox[];
};

// UI-specific types
export type ProjectCardData = {
  id: string;
  name: string;
  lastModified: Date;
  thumbnailUrl?: string;
};
