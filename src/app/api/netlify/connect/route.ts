import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';
import {
  validateReturnUrl,
  validateRedirectUri,
  createOAuthState,
} from '@/lib/security/oauth';
import { checkOAuthRateLimit } from '@/lib/security/oauth-rate-limiter';

/**
 * Netlify OAuth Connection Initiation Endpoint
 *
 * Generates Netlify OAuth URL and redirects user to Netlify for authorization.
 * This server-side approach provides custom OAuth flow for Netlify deployment feature.
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

    // Get Netlify OAuth credentials from environment
    const clientId = process.env.NETLIFY_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/netlify/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Netlify OAuth not configured' },
        { status: 500 }
      );
    }

    // Validate redirect URI (ensures correct configuration)
    if (!validateRedirectUri(redirectUri)) {
      console.error('[Netlify Connect] Invalid redirect URI:', redirectUri);
      return NextResponse.json(
        { error: 'Invalid OAuth configuration' },
        { status: 500 }
      );
    }

    // Create cryptographically secure state token
    // This prevents CSRF attacks with HMAC signing and nonce validation
    const state = await createOAuthState(userId, returnUrl);

    // Construct Netlify OAuth URL
    // Netlify uses standard OAuth 2.0 authorization code flow
    const netlifyOAuthUrl = new URL('https://app.netlify.com/authorize');
    netlifyOAuthUrl.searchParams.set('client_id', clientId);
    netlifyOAuthUrl.searchParams.set('redirect_uri', redirectUri);
    netlifyOAuthUrl.searchParams.set('response_type', 'code');
    netlifyOAuthUrl.searchParams.set('state', state);

    // Redirect to Netlify for authorization
    return NextResponse.redirect(netlifyOAuthUrl.toString());
  } catch (error) {
    console.error('[Netlify Connect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
