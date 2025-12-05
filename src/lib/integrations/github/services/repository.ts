/**
 * GitHub Repository Service
 * Handles repository creation, management, and querying
 */

import type { Octokit } from '@octokit/rest';
import type { GitHubRepository } from '../types';
import {
  GitHubRepositoryNotFoundError,
  GitHubRepositoryExistsError,
  GitHubConnectionError,
} from '../errors';
import * as Sentry from '@sentry/nextjs';

export class GitHubRepositoryService {
  /**
   * Create a new GitHub repository for the authenticated user
   *
   * @param octokit - Octokit instance with authentication
   * @param name - Repository name
   * @param isPrivate - Whether the repository should be private (default: false)
   * @param autoInit - Whether to initialize with README (default: true)
   * @returns Created repository information
   */
  static async createRepository(
    octokit: Octokit,
    name: string,
    isPrivate = false,
    autoInit = true
  ): Promise<GitHubRepository> {
    try {
      const { data: repo } = await octokit.repos.createForAuthenticatedUser({
        name,
        private: isPrivate,
        auto_init: autoInit,
        description: 'Generated with Stryama - AI Code Generator',
      });

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        url: repo.html_url,
        defaultBranch: repo.default_branch ?? 'main',
      };
    } catch (error) {
      // Check if repository already exists (HTTP 422)
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 422
      ) {
        throw new GitHubRepositoryExistsError(name, error);
      }

      Sentry.captureException(error, {
        tags: { feature: 'github_create_repository' },
        extra: { repositoryName: name, isPrivate },
      });

      throw new GitHubConnectionError(
        'Failed to create GitHub repository',
        error
      );
    }
  }

  /**
   * Check if a repository exists
   *
   * @param octokit - Octokit instance with authentication
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns True if repository exists, false otherwise
   */
  static async checkRepositoryExists(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<boolean> {
    try {
      await octokit.repos.get({ owner, repo });
      return true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 404
      ) {
        return false;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get a specific repository
   *
   * @param octokit - Octokit instance with authentication
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Repository information
   */
  static async getRepository(
    octokit: Octokit,
    owner: string,
    repo: string
  ): Promise<GitHubRepository> {
    try {
      const { data } = await octokit.repos.get({ owner, repo });

      return {
        id: data.id,
        name: data.name,
        fullName: data.full_name,
        owner: data.owner.login,
        private: data.private,
        url: data.html_url,
        defaultBranch: data.default_branch ?? 'main',
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'status' in error &&
        error.status === 404
      ) {
        throw new GitHubRepositoryNotFoundError(`${owner}/${repo}`, error);
      }

      throw new GitHubConnectionError('Failed to get repository', error);
    }
  }

  /**
   * List repositories for the authenticated user
   *
   * @param octokit - Octokit instance with authentication
   * @param page - Page number (default: 1)
   * @param perPage - Results per page (default: 100)
   * @returns Array of repository information
   */
  static async getUserRepositories(
    octokit: Octokit,
    page = 1,
    perPage = 100
  ): Promise<GitHubRepository[]> {
    try {
      const { data: repos } = await octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: perPage,
        page,
        affiliation: 'owner', // Only repos owned by the user
      });

      return repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        url: repo.html_url,
        defaultBranch: repo.default_branch ?? 'main',
      }));
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'github_list_repositories' },
        extra: { page, perPage },
      });

      throw new GitHubConnectionError('Failed to list repositories', error);
    }
  }
}
