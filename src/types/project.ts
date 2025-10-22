// Project-related types
export type Project = {
  id: string;
  name: string;
  description: string | null;
  clerkUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectWithDetails = Project & {
  files: ProjectFile[];
  sandboxes: Sandbox[];
};

export type ProjectFile = {
  id: string;
  projectId: string;
  path: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Sandbox = {
  id: string;
  projectId: string;
  sandboxId: string;
  url: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectCardData = {
  id: string;
  name: string;
  framework: string;
  lastModified: Date;
  thumbnailUrl?: string;
};
