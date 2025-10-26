import type { PrismaClient } from '@prisma/client';
import type {
  ProjectFile,
  ProjectContext,
  FrameworkType,
  ProgrammingLanguage,
} from '../types';

type GatherOptions = {
  readonly includeAllFiles?: boolean;
  readonly maxFiles?: number;
  readonly maxFileSize?: number; // in characters
  readonly priorityPatterns?: readonly string[];
};

const DEFAULT_OPTIONS: Required<GatherOptions> = {
  includeAllFiles: false,
  maxFiles: 10,
  maxFileSize: 5000,
  priorityPatterns: [
    'page.tsx',
    'layout.tsx',
    'route.ts',
    'schema.prisma',
    'tailwind.config',
  ],
};

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

    const allFiles: ProjectFile[] = project.files.map((file) => ({
      path: file.path,
      content: file.content,
      language: file.language as ProgrammingLanguage | undefined,
    }));

    const selectedFiles = this.selectRelevantFiles(allFiles, opts);

    const framework = this.detectFramework(allFiles);

    const dependencies = this.extractDependencies(allFiles);

    return {
      existingFiles: selectedFiles,
      framework,
      dependencies,
    };
  }

  private selectRelevantFiles(
    files: ProjectFile[],
    options: Required<GatherOptions>
  ): ProjectFile[] {
    if (options.includeAllFiles) {
      return files.slice(0, options.maxFiles);
    }

    const priorityFiles: ProjectFile[] = [];
    const otherFiles: ProjectFile[] = [];

    for (const file of files) {
      const isPriority = options.priorityPatterns.some((pattern) =>
        file.path.includes(pattern)
      );

      if (isPriority) {
        priorityFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    }

    const selected = [...priorityFiles, ...otherFiles].slice(
      0,
      options.maxFiles
    );

    return selected
      .filter((file) => file.content.length <= options.maxFileSize)
      .map((file) => {
        if (file.content.length > options.maxFileSize) {
          return {
            ...file,
            content:
              file.content.slice(0, options.maxFileSize) +
              '\n// ... (truncated)',
          };
        }
        return file;
      });
  }

  private detectFramework(files: ProjectFile[]): FrameworkType | undefined {
    const hasNextConfig = files.some((f) => f.path.includes('next.config'));
    const hasAppDir = files.some((f) => f.path.startsWith('app/'));

    if (hasNextConfig || hasAppDir) {
      return 'nextjs' as FrameworkType;
    }

    const hasReactIndex = files.some(
      (f) => f.path.includes('index') && f.content.includes('ReactDOM')
    );

    if (hasReactIndex) {
      return 'react' as FrameworkType;
    }

    return undefined;
  }

  private extractDependencies(files: ProjectFile[]): string[] {
    const packageJson = files.find((f) => f.path === 'package.json');

    if (!packageJson) {
      return [];
    }

    try {
      const pkg = JSON.parse(packageJson.content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const deps = [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ];

      return deps;
    } catch {
      return [];
    }
  }

  static formatContextForPrompt(context: ProjectContext): string {
    if (!context.existingFiles || context.existingFiles.length === 0) {
      return 'New project (no existing files)';
    }

    const fileList = context.existingFiles
      .map(
        (file) =>
          `\n### File: ${file.path}\n\`\`\`${file.language ?? 'text'}\n${file.content}\n\`\`\``
      )
      .join('\n');

    const framework = context.framework
      ? `\nFramework: ${context.framework}`
      : '';
    const deps =
      context.dependencies && context.dependencies.length > 0
        ? `\nDependencies: ${context.dependencies.join(', ')}`
        : '';

    return `## Existing Project Context${framework}${deps}\n${fileList}`;
  }
}
