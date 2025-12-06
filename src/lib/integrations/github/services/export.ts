/**
 * GitHub Export Service
 * Core logic for exporting files to GitHub repositories using the Tree API
 */

import type { Octokit } from '@octokit/rest';
import type { ExportableFile, ExportResult, GitHubTreeEntry } from '../types';
import { GitHubExportError, GitHubRateLimitError } from '../errors';
import { validateFilePath } from '@/lib/security/oauth';
import * as Sentry from '@sentry/nextjs';

export class GitHubExportService {
  /**
   * Export project files to GitHub repository
   * Uses GitHub's tree API for atomic multi-file commits
   *
   * @param octokit - Octokit instance with authentication
   * @param owner - Repository owner (username or organization)
   * @param repo - Repository name
   * @param branch - Branch to push to (default: 'main')
   * @param files - Array of files to export
   * @param commitMessage - Commit message
   * @returns Export result with commit SHA and URL
   */
  static async exportToRepository(
    octokit: Octokit,
    owner: string,
    repo: string,
    branch: string,
    files: ExportableFile[],
    commitMessage: string
  ): Promise<ExportResult> {
    try {
      // 1. Get latest commit SHA from branch
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`,
      });
      const latestCommitSha = ref.object.sha;

      // 2. Get base tree from latest commit
      const { data: commit } = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: latestCommitSha,
      });
      const baseTreeSha = commit.tree.sha;

      // 3. Create blobs for all files
      const tree: GitHubTreeEntry[] = await this.createBlobs(
        octokit,
        owner,
        repo,
        files
      );

      // 4. Create new tree
      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: baseTreeSha,
        tree,
      });

      // 5. Create commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: newTree.sha,
        parents: [latestCommitSha],
      });

      // 6. Update branch reference
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });

      return {
        success: true,
        commitSha: newCommit.sha,
        commitUrl: newCommit.html_url,
        filesExported: files.length,
      };
    } catch (error) {
      // Handle rate limiting
      if (this.isRateLimitError(error)) {
        const resetTime = this.getRateLimitResetTime(error);
        throw new GitHubRateLimitError(
          `GitHub API rate limit exceeded. Resets at ${resetTime.toLocaleTimeString()}`,
          resetTime,
          error
        );
      }

      // Capture error in Sentry
      Sentry.captureException(error, {
        tags: {
          feature: 'github_export',
          owner,
          repo,
          branch,
        },
        extra: {
          fileCount: files.length,
          commitMessage,
        },
      });

      throw new GitHubExportError('Failed to export files to GitHub', error);
    }
  }

  /**
   * Create blobs for files on GitHub
   * @private
   */
  private static async createBlobs(
    octokit: Octokit,
    owner: string,
    repo: string,
    files: ExportableFile[]
  ): Promise<GitHubTreeEntry[]> {
    const tree: GitHubTreeEntry[] = [];

    for (const file of files) {
      try {
        // Validate file path (prevents path traversal and malicious files)
        if (!validateFilePath(file.path)) {
          console.warn(
            `[GitHub Export] Skipping invalid file path: ${file.path}`
          );
          Sentry.captureMessage('Invalid file path in export', {
            level: 'warning',
            extra: { filePath: file.path },
          });
          continue; // Skip this file
        }

        // Create blob with base64 encoded content
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo,
          content: Buffer.from(file.content).toString('base64'),
          encoding: 'base64',
        });

        tree.push({
          path: file.path,
          mode: '100644', // Regular file
          type: 'blob',
          sha: blob.sha,
        });
      } catch (error) {
        // Log error but continue with other files
        console.error(
          `[GitHub Export] Failed to create blob for ${file.path}:`,
          error
        );
        Sentry.captureException(error, {
          tags: { feature: 'github_export_blob' },
          extra: { filePath: file.path },
        });
      }
    }

    return tree;
  }

  /**
   * Check if error is a rate limit error
   * @private
   */
  private static isRateLimitError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 403 &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'headers' in error.response &&
      typeof error.response.headers === 'object' &&
      error.response.headers !== null &&
      'x-ratelimit-remaining' in error.response.headers &&
      error.response.headers['x-ratelimit-remaining'] === '0'
    );
  }

  /**
   * Get rate limit reset time from error
   * @private
   */
  private static getRateLimitResetTime(error: unknown): Date {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'headers' in error.response &&
      typeof error.response.headers === 'object' &&
      error.response.headers !== null &&
      'x-ratelimit-reset' in error.response.headers
    ) {
      const resetTime = error.response.headers['x-ratelimit-reset'];
      if (typeof resetTime === 'string') {
        return new Date(parseInt(resetTime, 10) * 1000);
      }
    }
    // Default to 1 hour from now if we can't parse the reset time
    return new Date(Date.now() + 3600000);
  }
}
