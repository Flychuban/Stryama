/**
 * OAuth Security Utilities
 *
 * Centralized security functions for GitHub OAuth flow to prevent:
 * - Open redirect vulnerabilities
 * - CSRF attacks
 * - Invalid redirect URIs
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Allowed return URLs for OAuth redirect
 * Only relative paths within the application are allowed
 */
const ALLOWED_RETURN_PATHS = [
  '/editor',
  '/dashboard',
  '/projects',
  '/settings',
] as const;

/**
 * Allowed redirect URIs for OAuth callback
 * Must match GitHub OAuth App configuration
 */
const ALLOWED_REDIRECT_URIS = [
  'http://localhost:3000/api/github/callback',
  'https://stryama.app/api/github/callback',
  `${process.env.NEXT_PUBLIC_APP_URL}/api/github/callback`,
] as const;

/**
 * Validates return URL to prevent open redirect attacks
 *
 * @param url - The return URL to validate
 * @returns Validated URL or default safe path
 *
 * Security checks:
 * 1. Must be relative path only (no external redirects)
 * 2. Must start with one of the allowed paths
 * 3. No protocol or domain allowed
 */
export function validateReturnUrl(url: string | null): string {
  const defaultPath = '/editor';

  if (!url) {
    return defaultPath;
  }

  try {
    // Reject absolute URLs (http://, https://, //)
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('//')
    ) {
      console.warn('[OAuth Security] Rejected absolute URL in returnUrl:', url);
      return defaultPath;
    }

    // Must start with /
    if (!url.startsWith('/')) {
      console.warn('[OAuth Security] Rejected non-path returnUrl:', url);
      return defaultPath;
    }

    // Extract the base path (before query parameters)
    const basePath = url.split('?')[0] ?? '/';

    // Check if it starts with any allowed path
    const isAllowed = ALLOWED_RETURN_PATHS.some((allowedPath) =>
      basePath.startsWith(allowedPath)
    );

    if (!isAllowed) {
      console.warn(
        '[OAuth Security] Rejected disallowed returnUrl path:',
        basePath
      );
      return defaultPath;
    }

    return url;
  } catch (error) {
    console.error('[OAuth Security] Error validating returnUrl:', error);
    return defaultPath;
  }
}

/**
 * Validates redirect URI to ensure it matches allowed values
 *
 * @param redirectUri - The redirect URI to validate
 * @returns true if valid, false otherwise
 */
export function validateRedirectUri(redirectUri: string): boolean {
  return ALLOWED_REDIRECT_URIS.includes(
    redirectUri as (typeof ALLOWED_REDIRECT_URIS)[number]
  );
}

/**
 * OAuth state token interface
 */
interface OAuthState {
  userId: string;
  returnUrl: string;
  nonce: string;
  exp: number; // Expiration timestamp
}

/**
 * OAuth state storage (in-memory for MVP)
 *
 * PRODUCTION NOTE: For multi-instance deployments, replace with Redis
 * This is similar to the rate limiter pattern - acceptable for MVP
 *
 * DEVELOPMENT NOTE: Using globalThis to persist across Next.js hot reloads
 * Without this, the Map would be reset during development, causing OAuth to fail
 */
const getStateStore = () => {
  const globalKey = Symbol.for('stryama.oauth.stateStore');

  if (!(globalThis as Record<symbol, unknown>)[globalKey]) {
    (globalThis as Record<symbol, unknown>)[globalKey] = new Map<
      string,
      { userId: string; createdAt: number; exp: number }
    >();
  }

  return (globalThis as Record<symbol, unknown>)[globalKey] as Map<
    string,
    { userId: string; createdAt: number; exp: number }
  >;
};

const stateStore = getStateStore();

// Clean up expired states every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of stateStore.entries()) {
    if (data.exp < now) {
      stateStore.delete(nonce);
    }
  }
}, 900000); // 15 minutes

/**
 * Creates a cryptographically secure OAuth state token
 *
 * The state token is signed with HMAC to prevent forgery and includes:
 * - userId: The authenticated user's ID
 * - returnUrl: Where to redirect after OAuth (validated)
 * - nonce: Random value to prevent replay attacks
 * - exp: Expiration timestamp (10 minutes)
 *
 * @param userId - The authenticated user's ID
 * @param returnUrl - The validated return URL
 * @returns Base64-encoded signed state token
 */
export function createOAuthState(userId: string, returnUrl: string): string {
  const nonce = randomBytes(32).toString('hex');
  const exp = Date.now() + 600000; // 10 minutes

  const stateData: OAuthState = {
    userId,
    returnUrl,
    nonce,
    exp,
  };

  // Store nonce in memory to prevent replay
  stateStore.set(nonce, {
    userId,
    createdAt: Date.now(),
    exp,
  });

  // Sign the state with HMAC
  const stateJson = JSON.stringify(stateData);
  const secret = getOAuthSecret();
  const signature = createHmac('sha256', secret)
    .update(stateJson)
    .digest('hex');

  // Combine data and signature
  const signedState = {
    data: stateData,
    sig: signature,
  };

  return Buffer.from(JSON.stringify(signedState)).toString('base64');
}

/**
 * Validates and decodes an OAuth state token
 *
 * Security checks:
 * 1. Base64 decoding
 * 2. HMAC signature verification (constant-time comparison)
 * 3. Expiration check
 * 4. Nonce validation (prevents replay attacks)
 * 5. returnUrl re-validation
 *
 * @param stateToken - The base64-encoded state token
 * @returns Validated state data or null if invalid
 */
export function validateOAuthState(stateToken: string): OAuthState | null {
  try {
    // Decode base64
    const decoded = JSON.parse(
      Buffer.from(stateToken, 'base64').toString()
    ) as { data: OAuthState; sig: string };

    const { data, sig } = decoded;

    // Verify HMAC signature (prevents tampering)
    const secret = getOAuthSecret();
    const expectedSig = createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex');

    // Use timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(sig, 'hex');
    const expectedSigBuffer = Buffer.from(expectedSig, 'hex');

    if (
      sigBuffer.length !== expectedSigBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedSigBuffer)
    ) {
      console.warn('[OAuth Security] Invalid state signature');
      return null;
    }

    // Check expiration
    if (Date.now() > data.exp) {
      console.warn('[OAuth Security] State token expired');
      // Clean up expired nonce
      stateStore.delete(data.nonce);
      return null;
    }

    // Verify nonce hasn't been used (prevents replay attacks)
    const storedData = stateStore.get(data.nonce);
    if (!storedData) {
      console.warn(
        '[OAuth Security] Nonce not found in store - possible server restart or hot reload'
      );
      console.warn('[OAuth Security] Store size:', stateStore.size);
      console.warn(
        '[OAuth Security] Requested nonce:',
        data.nonce.substring(0, 16) + '...'
      );
      return null;
    }

    if (storedData.userId !== data.userId) {
      console.warn('[OAuth Security] Nonce userId mismatch');
      console.warn('[OAuth Security] Expected userId:', data.userId);
      console.warn('[OAuth Security] Stored userId:', storedData.userId);
      return null;
    }

    // Delete nonce to prevent reuse
    stateStore.delete(data.nonce);

    // Re-validate returnUrl (defense in depth)
    data.returnUrl = validateReturnUrl(data.returnUrl);

    return data;
  } catch (error) {
    console.error('[OAuth Security] Error validating state:', error);
    return null;
  }
}

/**
 * Gets the OAuth state secret from environment
 * Falls back to a default for development (not recommended for production)
 */
function getOAuthSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'OAUTH_STATE_SECRET must be set in production environment'
      );
    }

    // Development fallback (not secure, but prevents errors in local dev)
    console.warn(
      '[OAuth Security] Using default OAuth secret in development. Set OAUTH_STATE_SECRET in production!'
    );
    return 'dev-oauth-secret-change-in-production';
  }

  return secret;
}

/**
 * Repository name validation regex
 * Matches GitHub's naming rules:
 * - Alphanumeric, hyphens, underscores, and dots only
 * - Cannot start with . or -
 * - Cannot contain consecutive dots (..)
 */
export const GITHUB_REPO_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Reserved repository names (Windows reserved names)
 */
export const RESERVED_REPO_NAMES = [
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
] as const;

/**
 * Validates a repository name according to GitHub's rules
 *
 * @param name - Repository name to validate
 * @returns true if valid, false otherwise
 */
export function validateRepositoryName(name: string): boolean {
  // Basic checks
  if (!name || name.length === 0 || name.length > 100) {
    return false;
  }

  // Check regex pattern
  if (!GITHUB_REPO_NAME_REGEX.test(name)) {
    return false;
  }

  // Cannot contain consecutive dots
  if (name.includes('..')) {
    return false;
  }

  // Cannot start with . or -
  if (name.startsWith('.') || name.startsWith('-')) {
    return false;
  }

  // Check reserved names
  if (
    RESERVED_REPO_NAMES.includes(
      name.toUpperCase() as (typeof RESERVED_REPO_NAMES)[number]
    )
  ) {
    return false;
  }

  return true;
}

/**
 * File path validation for GitHub exports
 * Prevents path traversal and malicious file creation
 *
 * @param path - File path to validate
 * @returns true if valid, false otherwise
 */
export function validateFilePath(path: string): boolean {
  // Reject empty paths
  if (!path || path.length === 0) {
    return false;
  }

  // Reject path traversal
  if (path.includes('..') || path.startsWith('/')) {
    return false;
  }

  // Reject dangerous paths
  const dangerousPaths = [
    '.git/',
    '.github/workflows/',
    '.ssh/',
    '.env',
    'node_modules/',
  ];

  if (dangerousPaths.some((dangerous) => path.startsWith(dangerous))) {
    return false;
  }

  // Must be printable ASCII (reject unusual characters)
  if (!/^[\x20-\x7E/]+$/.test(path)) {
    return false;
  }

  return true;
}
