// Project-related types - using Prisma-generated types for consistency
import type { Project, File, Sandbox, Framework } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Project, File as ProjectFile, Sandbox, Framework };

// Extended types with relations
export type ProjectWithDetails = Project & {
  files: File[];
  sandboxes: Sandbox[];
};

// UI-specific types
export type ProjectCardData = {
  id: string;
  name: string;
  framework: Framework;
  lastModified: Date;
  thumbnailUrl?: string;
};
