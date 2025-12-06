/**
 * GitHub Integration TypeScript Types
 */

import type { File } from '@prisma/client';

/**
 * GitHub repository information
 */
export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  url: string;
  defaultBranch: string;
}

/**
 * GitHub user information
 */
export interface GitHubUser {
  id: number;
  username: string;
  email?: string;
  avatarUrl?: string;
}

/**
 * Result of exporting files to GitHub
 */
export interface ExportResult {
  success: boolean;
  commitSha: string;
  commitUrl?: string;
  filesExported: number;
}

/**
 * GitHub tree entry for creating commits
 */
export interface GitHubTreeEntry {
  path: string;
  mode: '100644' | '100755' | '040000' | '160000' | '120000';
  type: 'blob' | 'tree' | 'commit';
  sha?: string;
  content?: string;
}

/**
 * File to be exported to GitHub
 */
export type ExportableFile = Pick<File, 'path' | 'content'>;

/**
 * Options for creating a new GitHub repository
 */
export interface CreateRepositoryOptions {
  name: string;
  description?: string;
  private?: boolean;
  autoInit?: boolean;
}

/**
 * Options for exporting files to GitHub
 */
export interface ExportOptions {
  owner: string;
  repo: string;
  branch?: string;
  commitMessage: string;
  files: ExportableFile[];
}
