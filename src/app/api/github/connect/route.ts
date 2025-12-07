import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  validateReturnUrl,
  validateRedirectUri,
  createOAuthState,
} from '@/lib/security/oauth';
import { checkOAuthRateLimit } from '@/lib/security/oauth-rate-limiter';

/**
 * GitHub OAuth Connection Initiation Endpoint
 *
 * Generates GitHub OAuth URL and redirects user to GitHub for authorization.
 * This server-side approach avoids Clerk's step-up authentication requirement.
 *
 * Security features:
 * - Rate limiting (5 requests per 15 minutes per user)
 * - Return URL validation (prevents open redirect attacks)
 * - Redirect URI validation (ensures correct OAuth app configuration)
 * - CSRF-protected state tokens (HMAC-signed, nonce-based, time-limited)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check rate limit (prevents OAuth abuse)
    const rateLimit = checkOAuthRateLimit(userId, 'connect');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Please try again in ${rateLimit.retryAfter} seconds`,
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
          },
        }
      );
    }

    // Get and validate return URL (prevents open redirect attacks)
    const searchParams = request.nextUrl.searchParams;
    const rawReturnUrl = searchParams.get('return_url');
    const returnUrl = validateReturnUrl(rawReturnUrl);

    // Get GitHub OAuth credentials from environment
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/github/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    // Validate redirect URI (ensures correct configuration)
    if (!validateRedirectUri(redirectUri)) {
      console.error('[GitHub Connect] Invalid redirect URI:', redirectUri);
      return NextResponse.json(
        { error: 'Invalid OAuth configuration' },
        { status: 500 }
      );
    }

    // Create cryptographically secure state token
    // This prevents CSRF attacks with HMAC signing and nonce validation
    const state = await createOAuthState(userId, returnUrl);

    // Construct GitHub OAuth URL with required scopes
    const githubOAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubOAuthUrl.searchParams.set('client_id', clientId);
    githubOAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubOAuthUrl.searchParams.set(
      'scope',
      'public_repo read:user user:email'
    );
    githubOAuthUrl.searchParams.set('state', state);

    // Redirect to GitHub for authorization
    return NextResponse.redirect(githubOAuthUrl.toString());
  } catch (error) {
    console.error('[GitHub Connect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
