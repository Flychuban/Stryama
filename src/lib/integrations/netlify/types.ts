/**
 * Netlify Integration Type Definitions
 *
 * TypeScript interfaces for Netlify API responses and deployment data structures
 */

/**
 * Netlify site information
 */
export interface NetlifySite {
  id: string;
  name: string;
  url: string;
  admin_url: string;
  ssl_url: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  state: 'current' | 'deleted';
  screenshot_url?: string;
  custom_domain?: string;
}

/**
 * Netlify deployment information
 */
export interface NetlifyDeploy {
  id: string;
  site_id: string;
  name: string;
  state: 'ready' | 'building' | 'processing' | 'error' | 'uploaded';
  url: string;
  ssl_url: string;
  admin_url: string;
  deploy_url: string;
  deploy_ssl_url: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  error_message?: string;
  required_functions?: string[];
  build_id?: string;
}

/**
 * Netlify user information
 */
export interface NetlifyUser {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
}

/**
 * Build artifacts collected from E2B sandbox
 */
export interface BuildArtifacts {
  /**
   * Map of relative file paths to file contents
   */
  files: Map<string, string>;

  /**
   * Total size of all files in bytes
   */
  totalSize: number;

  /**
   * Number of files in the build
   */
  fileCount: number;
}

/**
 * Deployment result returned to the client
 */
export interface DeployResult {
  /**
   * Whether the deployment was successful
   */
  success: boolean;

  /**
   * Netlify site ID
   */
  siteId: string;

  /**
   * Site name (subdomain)
   */
  siteName: string;

  /**
   * Public URL of the deployed site
   */
  siteUrl: string;

  /**
   * Deployment-specific URL
   */
  deployUrl?: string;

  /**
   * Netlify deployment ID
   */
  deployId?: string;

  /**
   * Number of files deployed
   */
  filesDeployed: number;

  /**
   * Total build size in bytes
   */
  buildSize: number;

  /**
   * Build time in milliseconds
   */
  buildTime?: number;

  /**
   * Error message if deployment failed
   */
  errorMessage?: string;
}

/**
 * Framework type for build detection
 */
export type Framework = 'vite' | 'nextjs' | 'react' | 'static';

/**
 * Build configuration for different frameworks
 */
export interface FrameworkBuildConfig {
  /**
   * Build command to execute
   */
  command: string;

  /**
   * Output directory containing build artifacts
   */
  outputDir: string;

  /**
   * Framework name for logging
   */
  name: string;
}
