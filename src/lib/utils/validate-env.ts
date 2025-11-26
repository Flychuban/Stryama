/**
 * Environment Variable Validation
 *
 * Validates that all required environment variables are present on startup.
 * This helps catch configuration issues early before they cause runtime errors.
 */

/**
 * Required environment variables for the application to function
 * These MUST be present or the app will not start
 */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'ANTHROPIC_API_KEY',
  'E2B_API_KEY',
] as const;

/**
 * Optional but recommended environment variables
 * The app will work without these, but with degraded functionality
 */
const RECOMMENDED_ENV_VARS = ['NEXT_PUBLIC_APP_URL', 'ADMIN_USER_IDS'] as const;

/**
 * Validate that all required environment variables are present
 * @throws Error if any required environment variables are missing
 */
export function validateEnvironment(): void {
  // Only validate on server-side and skip during build
  if (
    typeof window !== 'undefined' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return;
  }

  const missing: string[] = [];
  const recommended: string[] = [];

  // Check required variables
  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Check recommended variables (warnings only)
  for (const key of RECOMMENDED_ENV_VARS) {
    if (!process.env[key]) {
      recommended.push(key);
    }
  }

  // Fail if required variables are missing
  if (missing.length > 0) {
    const message = [
      '❌ Missing required environment variables:',
      ...missing.map((key) => `  - ${key}`),
      '',
      'Please check your .env file and ensure all required variables are set.',
      'See .env.example for reference.',
    ].join('\n');

    console.error(message);
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // Warn about recommended variables
  if (recommended.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn(
      '⚠️  Missing recommended environment variables:',
      recommended.join(', ')
    );
    console.warn('   The app will work, but some features may be degraded.');
  }

  // Success message
  if (process.env.NODE_ENV === 'development') {
    console.log('✓ Environment variables validated successfully');
  }
}
