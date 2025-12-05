/**
 * GitHub API Client (Octokit Wrapper)
 * Singleton pattern for managing Octokit instances per access token
 */

import { Octokit } from '@octokit/rest';
import { GITHUB_CONFIG } from './config';
import { GitHubAuthError, GitHubInvalidTokenError } from './errors';

class GitHubClient {
  private static instances = new Map<string, Octokit>();

  /**
   * Get or create an Octokit instance for the given access token
   */
  static getClient(accessToken: string): Octokit {
    if (!accessToken) {
      throw new GitHubAuthError('Access token is required');
    }

    // Return existing instance if available
    if (this.instances.has(accessToken)) {
      return this.instances.get(accessToken)!;
    }

    // Create new instance
    const octokit = new Octokit({
      auth: accessToken,
      userAgent: GITHUB_CONFIG.userAgent,
      baseUrl: GITHUB_CONFIG.apiUrl,
    });

    this.instances.set(accessToken, octokit);
    return octokit;
  }

  /**
   * Verify that a GitHub token is valid
   */
  static async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const octokit = this.getClient(accessToken);
      await octokit.users.getAuthenticated();
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Get authenticated user information
   */
  static async getAuthenticatedUser(accessToken: string): Promise<{
    id: number;
    username: string;
    email: string | null;
  }> {
    try {
      const octokit = this.getClient(accessToken);
      const { data: user } = await octokit.users.getAuthenticated();

      return {
        id: user.id,
        username: user.login,
        email: user.email,
      };
    } catch (error) {
      throw new GitHubInvalidTokenError(
        'Failed to get authenticated user',
        error
      );
    }
  }

  /**
   * Clear cached Octokit instance for a token
   * Useful when token expires or user disconnects
   */
  static clearClient(accessToken: string): void {
    this.instances.delete(accessToken);
  }

  /**
   * Clear all cached Octokit instances
   */
  static clearAllClients(): void {
    this.instances.clear();
  }
}

export const githubClient = GitHubClient;
