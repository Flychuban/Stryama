import { type NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import * as Sentry from '@sentry/nextjs';
import { db } from '~/server/db';
import { validateOAuthState } from '@/lib/security/oauth';
import { checkOAuthRateLimit } from '@/lib/security/oauth-rate-limiter';

/**
 * GitHub OAuth token response type
 */
interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * GitHub OAuth Callback Endpoint
 *
 * Handles the OAuth callback from GitHub, exchanges the code for an access token,
 * and saves the connection to the database.
 * This server-side custom OAuth flow bypasses Clerk's step-up authentication requirements.
 *
 * Security features:
 * - Rate limiting (10 requests per 15 minutes per user)
 * - CSRF protection via state token validation (HMAC signature, nonce, expiration)
 * - Return URL re-validation (defense in depth)
 * - Error handling with user-friendly redirects
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle user denial
    if (error === 'access_denied') {
      const returnUrl = '/editor?github_error=denied';
      return NextResponse.redirect(new URL(returnUrl, request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/editor?github_error=invalid_callback', request.url)
      );
    }

    // Validate and decode state token (CSRF protection)
    const validatedState = validateOAuthState(state);

    if (!validatedState) {
      Sentry.captureMessage('Invalid OAuth state token', {
        level: 'warning',
        extra: { hasCode: !!code, hasState: !!state },
      });
      return NextResponse.redirect(
        new URL('/editor?github_error=invalid_state', request.url)
      );
    }

    const { userId, returnUrl } = validatedState;

    // Check rate limit (prevents callback abuse)
    const rateLimit = checkOAuthRateLimit(userId, 'callback');
    if (!rateLimit.allowed) {
      Sentry.captureMessage('OAuth callback rate limit exceeded', {
        level: 'warning',
        extra: { userId },
      });
      return NextResponse.redirect(
        new URL(
          `/editor?github_error=rate_limited&retry_after=${rateLimit.retryAfter}`,
          request.url
        )
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = (await tokenResponse.json()) as GitHubTokenResponse;

    if (tokenData.error || !tokenData.access_token) {
      Sentry.captureMessage('GitHub OAuth token exchange failed', {
        level: 'error',
        extra: {
          error: tokenData.error,
          errorDescription: tokenData.error_description,
        },
      });
      return NextResponse.redirect(
        new URL('/editor?github_error=token_exchange_failed', request.url)
      );
    }

    const accessToken: string = tokenData.access_token;

    // Get GitHub user info
    const octokit = new Octokit({ auth: accessToken });
    const { data: githubUser } = await octokit.users.getAuthenticated();

    // Save connection to database
    // Store the access token securely (should be encrypted in production)
    await db.gitHubConnection.upsert({
      where: { clerkUserId: userId },
      create: {
        clerkUserId: userId,
        githubUsername: githubUser.login,
        githubUserId: String(githubUser.id),
        accessToken,
      },
      update: {
        githubUsername: githubUser.login,
        githubUserId: String(githubUser.id),
        accessToken,
        lastSyncAt: new Date(),
      },
    });

    // Redirect to our internal callback page to trigger success message
    const callbackUrl = new URL('/github/callback', request.url);
    callbackUrl.searchParams.set('return_url', returnUrl);
    callbackUrl.searchParams.set('github_connected', 'true');

    return NextResponse.redirect(callbackUrl.toString());
  } catch (error) {
    console.error('[GitHub Callback] Error:', error);
    Sentry.captureException(error, {
      tags: { feature: 'github_oauth_callback' },
    });

    return NextResponse.redirect(
      new URL('/editor?github_error=internal_error', request.url)
    );
  }
}
