/**
 * Netlify Deploy Service
 *
 * Orchestrates the complete deployment process:
 * 1. Build static files from E2B sandbox
 * 2. Create/retrieve Netlify site
 * 3. Upload ZIP to Netlify
 * 4. Poll for deployment completion
 */

import type { Sandbox as E2BSandbox } from '@e2b/code-interpreter';
import { NETLIFY_CONFIG } from '../config';
import {
  NetlifyError,
  NetlifyDeployError,
  NetlifyDeployTimeoutError,
  NetlifySiteNotFoundError,
  NetlifySiteConflictError,
} from '../errors';
import type { DeployResult } from '../types';
import { netlifyClient } from '../client';
import { NetlifyBuildService } from './build';

/**
 * Deployment options
 */
export interface DeployOptions {
  /**
   * Netlify access token
   */
  accessToken: string;

  /**
   * Connected E2B sandbox instance
   */
  sandbox: E2BSandbox;

  /**
   * Project ID for tracking/logging
   */
  projectId: string;

  /**
   * Project name for site naming
   */
  projectName: string;

  /**
   * Existing site ID (for updates) or null to create new site
   */
  existingSiteId?: string | null;

  /**
   * Custom subdomain for new sites (optional)
   * If provided, will use this instead of auto-generated name
   */
  customSubdomain?: string | null;
}

/**
 * NetlifyDeployService - Handles full deployment lifecycle
 */
export class NetlifyDeployService {
  /**
   * Deploy a project to Netlify
   *
   * Complete workflow:
   * 1. Build project in E2B sandbox
   * 2. Create ZIP archive
   * 3. Create or use existing Netlify site
   * 4. Upload ZIP to Netlify
   * 5. Poll deployment status until complete
   *
   * @param options - Deployment options
   * @returns Deployment result with site URL and metadata
   */
  static async deployProject(options: DeployOptions): Promise<DeployResult> {
    const {
      accessToken,
      sandbox,
      projectId,
      projectName,
      existingSiteId,
      customSubdomain,
    } = options;

    console.log(
      `[Netlify Deploy] Starting deployment for project ${projectId}...`
    );
    console.log(
      `[Netlify Deploy] Mode: ${existingSiteId ? 'Update existing site' : 'Create new site'}`
    );

    const deployStartTime = Date.now();
    const client = netlifyClient.getClient(accessToken);

    try {
      // Step 1: Build project
      console.log('[Netlify Deploy] Step 1: Building project...');
      const buildStartTime = Date.now();
      const artifacts = await NetlifyBuildService.buildFromSandbox(
        sandbox,
        projectId
      );
      const buildTime = Date.now() - buildStartTime;

      // Step 2: Create ZIP archive
      console.log('[Netlify Deploy] Step 2: Creating ZIP archive...');
      const zipBuffer = await NetlifyBuildService.createZipArchive(artifacts);

      // Step 3: Get or create Netlify site
      console.log('[Netlify Deploy] Step 3: Getting/creating Netlify site...');
      let siteId: string;
      let siteName: string;
      let siteUrl: string;
      let adminUrl: string;

      if (existingSiteId) {
        // Use existing site
        try {
          const site = await client.getSite(existingSiteId);
          siteId = site.id;
          siteName = site.name;
          siteUrl = site.ssl_url || site.url;
          adminUrl = site.admin_url;
          console.log(
            `[Netlify Deploy] Using existing site: ${siteName} (${siteId})`
          );
        } catch (error) {
          console.error(
            `[Netlify Deploy] Failed to get site ${existingSiteId}:`,
            error
          );
          throw new NetlifySiteNotFoundError(existingSiteId, { error });
        }
      } else {
        // Create new site - use custom subdomain if provided, otherwise auto-generate
        const baseName = customSubdomain
          ? this.sanitizeSiteName(customSubdomain)
          : this.createUniqueSiteName(this.sanitizeSiteName(projectName));

        try {
          console.log(`[Netlify Deploy] Creating site with name: ${baseName}`);
          const site = await client.createSite(baseName);
          siteId = site.id;
          siteName = site.name;
          siteUrl = site.ssl_url || site.url;
          adminUrl = site.admin_url;
          console.log(
            `[Netlify Deploy] Created new site: ${siteName} (${siteId})`
          );
        } catch (error) {
          // Handle conflicts differently for custom vs auto-generated names
          if (error instanceof NetlifySiteConflictError) {
            if (customSubdomain) {
              // Custom subdomain taken - throw error without fallback
              console.error(
                `[Netlify Deploy] Custom subdomain '${baseName}' is already taken`
              );
              throw new NetlifySiteConflictError(
                baseName,
                undefined, // No suggestion for custom subdomains
                { error }
              );
            } else {
              // Auto-generated conflict (rare) - let Netlify generate random name
              console.warn(
                `[Netlify Deploy] Name conflict even with suffix: ${baseName}, retrying without name...`
              );
              const site = await client.createSite(); // No name parameter
              siteId = site.id;
              siteName = site.name;
              siteUrl = site.ssl_url || site.url;
              adminUrl = site.admin_url;
              console.log(
                `[Netlify Deploy] Created site with auto-generated name: ${siteName} (${siteId})`
              );
            }
          } else {
            // Re-throw other errors (auth, network, etc.)
            throw error;
          }
        }
      }

      // Step 4: Upload ZIP to Netlify
      console.log('[Netlify Deploy] Step 4: Uploading build to Netlify...');
      const uploadStartTime = Date.now();
      const deployment = await client.deploySite(siteId, zipBuffer);
      const uploadTime = Date.now() - uploadStartTime;
      console.log(
        `[Netlify Deploy] Upload completed in ${(uploadTime / 1000).toFixed(1)}s`
      );
      console.log(`[Netlify Deploy] Deployment ID: ${deployment.id}`);
      console.log(`[Netlify Deploy] Initial state: ${deployment.state}`);

      // Step 5: Poll deployment status until complete
      console.log('[Netlify Deploy] Step 5: Waiting for deployment...');
      const finalDeployment = await this.pollDeploymentStatus(
        client,
        siteId,
        deployment.id
      );

      const totalTime = Date.now() - deployStartTime;
      console.log(
        `[Netlify Deploy] ✅ Deployment completed in ${(totalTime / 1000).toFixed(1)}s`
      );

      // Return successful result
      return {
        success: true,
        siteId,
        siteName,
        siteUrl,
        deployUrl: finalDeployment.deploy_ssl_url || finalDeployment.deploy_url,
        adminUrl,
        deployId: deployment.id,
        filesDeployed: artifacts.fileCount,
        buildSize: artifacts.totalSize,
        buildTime,
      };
    } catch (error) {
      const totalTime = Date.now() - deployStartTime;
      console.error(
        `[Netlify Deploy] ❌ Deployment failed after ${(totalTime / 1000).toFixed(1)}s:`,
        error
      );

      // Re-throw ALL NetlifyError subclasses without wrapping
      // This preserves error type for router to properly classify
      if (error instanceof NetlifyError) {
        throw error;
      }

      // Wrap only unknown errors (database, network, etc.)
      throw new NetlifyDeployError(
        `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { error }
      );
    }
  }

  /**
   * Poll deployment status until it's ready or fails
   *
   * @param client - Netlify client instance
   * @param siteId - Site ID
   * @param deployId - Deployment ID
   * @returns Final deployment object when ready
   * @throws NetlifyDeployTimeoutError if timeout exceeded
   * @throws NetlifyDeployError if deployment fails
   */
  private static async pollDeploymentStatus(
    client: ReturnType<typeof netlifyClient.getClient>,
    siteId: string,
    deployId: string
  ) {
    const startTime = Date.now();
    const timeout = NETLIFY_CONFIG.deployment.defaultTimeout;
    const pollInterval = NETLIFY_CONFIG.deployment.pollInterval;

    let attempts = 0;

    while (true) {
      attempts++;
      const elapsed = Date.now() - startTime;

      // Check timeout
      if (elapsed > timeout) {
        throw new NetlifyDeployTimeoutError(timeout, {
          siteId,
          deployId,
          attempts,
        });
      }

      // Get deployment status
      const deployment = await client.getDeploy(siteId, deployId);

      console.log(
        `[Netlify Deploy] Poll attempt ${attempts}: state=${deployment.state} (${(elapsed / 1000).toFixed(1)}s elapsed)`
      );

      // Check if deployment is complete
      if (deployment.state === 'ready') {
        console.log(
          `[Netlify Deploy] ✅ Deployment ready after ${attempts} attempts`
        );
        return deployment;
      }

      // Check if deployment failed
      if (deployment.state === 'error') {
        const errorMsg =
          deployment.error_message ?? 'Deployment failed without error message';
        console.error(`[Netlify Deploy] ❌ Deployment error: ${errorMsg}`);
        throw new NetlifyDeployError(`Deployment failed: ${errorMsg}`, {
          siteId,
          deployId,
          state: deployment.state,
        });
      }

      // Continue polling for other states: 'building', 'processing', 'uploaded'
      console.log(
        `[Netlify Deploy] Deployment still ${deployment.state}, waiting ${pollInterval}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Sanitize site name for Netlify
   *
   * Netlify site names must be:
   * - Lowercase alphanumeric + hyphens
   * - No consecutive hyphens
   * - No leading/trailing hyphens
   *
   * @param projectName - Original project name
   * @returns Sanitized site name
   */
  private static sanitizeSiteName(projectName: string): string {
    return (
      projectName
        .toLowerCase()
        // Replace spaces and underscores with hyphens
        .replace(/[\s_]+/g, '-')
        // Remove non-alphanumeric characters except hyphens
        .replace(/[^a-z0-9-]/g, '')
        // Remove consecutive hyphens
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
        // Limit length to 63 characters (Netlify limit)
        .substring(0, 63) || 'netlify-site'
    ); // Fallback if name becomes empty
  }

  /**
   * Generate a unique suffix for site names to avoid conflicts
   *
   * Format: 6-character alphanumeric (lowercase)
   * Example: "my-portfolio" -> "my-portfolio-a1b2c3"
   *
   * Uniqueness approach:
   * - Use timestamp (last 4 digits of milliseconds) + 2 random chars
   * - This gives ~10 million combinations per second
   * - Collision probability: negligible for typical usage patterns
   *
   * @returns 6-character alphanumeric suffix
   */
  private static generateUniqueSuffix(): string {
    // Get last 4 digits of timestamp (cycles every ~16 seconds)
    const timestamp = Date.now() % 10000;

    // Generate 2 random alphanumeric characters
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const random = Array.from({ length: 2 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');

    // Combine timestamp + random (e.g., "7423ab")
    return timestamp.toString(36) + random;
  }

  /**
   * Create a unique site name by appending suffix
   *
   * @param baseName - Sanitized base name
   * @returns Site name with unique suffix, max 63 chars
   */
  private static createUniqueSiteName(baseName: string): string {
    const suffix = this.generateUniqueSuffix();
    const nameWithSuffix = `${baseName}-${suffix}`;

    // Netlify has 63 char limit; if too long, truncate base name
    if (nameWithSuffix.length > 63) {
      const maxBaseLength = 63 - suffix.length - 1; // -1 for hyphen
      return `${baseName.substring(0, maxBaseLength)}-${suffix}`;
    }

    return nameWithSuffix;
  }

  /**
   * Validate that a site exists and user has access
   *
   * @param accessToken - Netlify access token
   * @param siteId - Site ID to validate
   * @returns true if site exists and accessible
   */
  static async validateSiteAccess(
    accessToken: string,
    siteId: string
  ): Promise<boolean> {
    try {
      const client = netlifyClient.getClient(accessToken);
      await client.getSite(siteId);
      return true;
    } catch (error) {
      console.error(
        `[Netlify Deploy] Site validation failed for ${siteId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get list of user's Netlify sites
   *
   * @param accessToken - Netlify access token
   * @returns Array of site objects
   */
  static async listUserSites(accessToken: string) {
    const client = netlifyClient.getClient(accessToken);
    return client.listSites();
  }
}
