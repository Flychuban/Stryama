import type { PrismaClient } from '@prisma/client';
import type {
  ProjectFile,
  ProjectContext,
  ProgrammingLanguage,
  FrameworkType,
} from '../types';

type GatherOptions = {
  readonly maxFiles?: number;
  readonly maxFileSize?: number; // in characters
};

const DEFAULT_OPTIONS: Required<GatherOptions> = {
  maxFiles: 30,
  maxFileSize: 5000,
};

/**
 * Simplified context gatherer for projects
 * Fetches recent files from database without overengineered logic
 */
export class ProjectContextGatherer {
  constructor(private db: PrismaClient) {}

  async gatherContext(
    projectId: string,
    options: GatherOptions = {}
  ): Promise<ProjectContext> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const project = await this.db.project.findUnique({
      where: { id: projectId },
      include: {
        files: {
          orderBy: { updatedAt: 'desc' },
          take: opts.maxFiles,
        },
      },
    });

    if (!project) {
      return {
        existingFiles: [],
        framework: undefined,
        dependencies: [],
      };
    }

    // Map database files to ProjectFile format
    const existingFiles: ProjectFile[] = project.files
      .map((file) => ({
        path: file.path,
        content: file.content,
        language: file.language as ProgrammingLanguage | undefined,
      }))
      .filter((file) => file.content.length <= opts.maxFileSize)
      .map((file) => {
        // Truncate if still too large
        if (file.content.length > opts.maxFileSize) {
          return {
            ...file,
            content:
              file.content.slice(0, opts.maxFileSize) + '\n// ... (truncated)',
          };
        }
        return file;
      });

    return {
      existingFiles,
      framework: project.framework as unknown as FrameworkType | undefined, // Use framework from database
      dependencies: [], // Not needed - package.json created by infrastructure
    };
  }
}
