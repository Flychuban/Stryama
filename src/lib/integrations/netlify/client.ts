/**
 * Netlify API Client - Singleton Pattern
 *
 * Provides a centralized, type-safe interface for interacting with the Netlify API
 * Mirrors the GitHub client.ts structure for consistency
 */

import { NETLIFY_CONFIG } from './config';
import {
  NetlifyAuthError,
  NetlifyError,
  NetlifySiteConflictError,
} from './errors';
import type { NetlifySite, NetlifyDeploy, NetlifyUser } from './types';

/**
 * Netlify API Client
 * Singleton pattern to reuse client instances for the same access token
 */
class NetlifyClient {
  /**
   * Cache of client instances by access token
   */
  private static instances = new Map<string, NetlifyClient>();

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(private accessToken: string) {}

  /**
   * Get or create a client instance for the given access token
   */
  static getClient(accessToken: string): NetlifyClient {
    if (!accessToken) {
      throw new NetlifyAuthError('Access token is required');
    }

    if (this.instances.has(accessToken)) {
      return this.instances.get(accessToken)!;
    }

    const client = new NetlifyClient(accessToken);
    this.instances.set(accessToken, client);
    return client;
  }

  /**
   * Make an authenticated request to the Netlify API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${NETLIFY_CONFIG.apiUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': NETLIFY_CONFIG.userAgent,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new NetlifyError(
          `Rate limit exceeded. Retry after: ${retryAfter ?? 'unknown'}`,
          { status: 429, retryAfter }
        );
      }

      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new NetlifyAuthError(
          error.message ??
            'Authentication failed. Please reconnect your Netlify account.',
          { status: response.status }
        );
      }

      // Handle validation errors (422) - including site name conflicts
      if (response.status === 422) {
        const errorMessage = error.message ?? '';

        // Log error details for debugging
        console.log('[Netlify Client] API Error:', {
          status: response.status,
          url,
          method: options.method ?? 'GET',
          message: errorMessage,
          fullError: error,
        });

        // Check for domain conflict indicators (more permissive matching)
        const isDomainConflict =
          /(already exists|already taken|not available|is unavailable|conflict|duplicate)/i.test(
            errorMessage
          );

        // For site update/create operations, assume 422 = domain conflict
        const isSiteOperation = url.includes('/sites/');

        if (isDomainConflict || isSiteOperation) {
          // Try to extract subdomain from error message
          const subdomainRegex =
            /(?:name|subdomain|site)\s+['"]?([\w-]+)['"]?/i;
          const match = subdomainRegex.exec(errorMessage);
          const subdomain = match?.[1] ?? '';

          throw new NetlifySiteConflictError(
            subdomain,
            undefined, // No suggestion - will be handled at service layer
            { status: 422, error }
          );
        }

        // Other 422 validation errors (e.g., invalid name format)
        throw new NetlifyError(`Validation error: ${errorMessage}`, {
          status: 422,
          error,
        });
      }

      // Generic error
      throw new NetlifyError(
        error.message ?? `HTTP ${response.status}: ${response.statusText}`,
        { status: response.status, error }
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Verify that the access token is valid
   */
  async verifyToken(): Promise<boolean> {
    try {
      await this.getUser();
      return true;
    } catch (error) {
      console.error('[Netlify Client] Token verification failed:', error);
      return false;
    }
  }

  /**
   * Get the authenticated user's information
   */
  async getUser(): Promise<NetlifyUser> {
    return this.request<NetlifyUser>('/user');
  }

  /**
   * List all sites for the authenticated user
   */
  async listSites(): Promise<NetlifySite[]> {
    return this.request<NetlifySite[]>('/sites');
  }

  /**
   * Get a specific site by ID
   */
  async getSite(siteId: string): Promise<NetlifySite> {
    return this.request<NetlifySite>(`/sites/${siteId}`);
  }

  /**
   * Create a new Netlify site
   * Note: Netlify auto-generates a unique subdomain (e.g., project-name-abc123.netlify.app)
   *
   * @param name - Optional site name (will be sanitized by Netlify)
   * @returns Created site information
   */
  async createSite(name?: string): Promise<NetlifySite> {
    const body: { name?: string } = {};
    if (name) {
      body.name = name;
    }

    return this.request<NetlifySite>('/sites', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Deploy a site by uploading a ZIP file
   *
   * @param siteId - Netlify site ID
   * @param zipBuffer - ZIP file as Buffer containing build artifacts
   * @returns Deployment information
   */
  async deploySite(siteId: string, zipBuffer: Buffer): Promise<NetlifyDeploy> {
    const url = `${NETLIFY_CONFIG.apiUrl}/sites/${siteId}/deploys`;

    // Convert Buffer to Uint8Array for proper BodyInit compatibility
    const body = new Uint8Array(zipBuffer);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/zip',
        'User-Agent': NETLIFY_CONFIG.userAgent,
      },
      body,
    });

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new NetlifyError(
        error.message ?? `Deploy failed: ${response.statusText}`,
        { status: response.status, error }
      );
    }

    return response.json() as Promise<NetlifyDeploy>;
  }

  /**
   * Get deployment status
   *
   * @param siteId - Netlify site ID
   * @param deployId - Deployment ID
   * @returns Deployment information with current state
   */
  async getDeploy(siteId: string, deployId: string): Promise<NetlifyDeploy> {
    return this.request<NetlifyDeploy>(`/sites/${siteId}/deploys/${deployId}`);
  }

  /**
   * Update an existing site (e.g., change name)
   *
   * @param siteId - Netlify site ID
   * @param updates - Partial site updates
   * @returns Updated site information
   */
  async updateSite(
    siteId: string,
    updates: Partial<NetlifySite>
  ): Promise<NetlifySite> {
    return this.request<NetlifySite>(`/sites/${siteId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Delete a site
   *
   * @param siteId - Netlify site ID
   */
  async deleteSite(siteId: string): Promise<void> {
    await this.request<void>(`/sites/${siteId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Clear cached client instance
   * Useful when access token is revoked or updated
   */
  static clearClient(accessToken: string): void {
    this.instances.delete(accessToken);
  }

  /**
   * Clear all cached client instances
   */
  static clearAllClients(): void {
    this.instances.clear();
  }
}

/**
 * Export the NetlifyClient class for use in services
 */
export const netlifyClient = NetlifyClient;
