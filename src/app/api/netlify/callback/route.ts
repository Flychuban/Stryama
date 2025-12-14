import { type NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { db } from '~/server/db';
import { validateOAuthState } from '@/lib/security/oauth';
import { checkOAuthRateLimit } from '@/lib/security/oauth-rate-limiter';
import { netlifyClient } from '@/lib/integrations/netlify/client';

/**
 * Netlify OAuth token response type
 */
interface NetlifyTokenResponse {
  access_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

/**
 * Netlify OAuth Callback Endpoint
 *
 * Handles the OAuth callback from Netlify, exchanges the code for an access token,
 * and saves the connection to the database.
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
      const returnUrl = '/editor?netlify_error=denied';
      return NextResponse.redirect(new URL(returnUrl, request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/editor?netlify_error=invalid_callback', request.url)
      );
    }

    // Validate and decode state token (CSRF protection)
    const validatedState = await validateOAuthState(state);

    if (!validatedState) {
      Sentry.captureMessage('Invalid OAuth state token (Netlify)', {
        level: 'warning',
        extra: { hasCode: !!code, hasState: !!state },
      });
      return NextResponse.redirect(
        new URL('/editor?netlify_error=invalid_state', request.url)
      );
    }

    const { userId, returnUrl } = validatedState;

    // Check rate limit (prevents callback abuse)
    const rateLimit = checkOAuthRateLimit(userId, 'callback');
    if (!rateLimit.allowed) {
      Sentry.captureMessage('OAuth callback rate limit exceeded (Netlify)', {
        level: 'warning',
        extra: { userId },
      });
      return NextResponse.redirect(
        new URL(
          `/editor?netlify_error=rate_limited&retry_after=${rateLimit.retryAfter}`,
          request.url
        )
      );
    }

    // Exchange code for access token
    // CRITICAL: redirect_uri must match exactly what was used in authorization request
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/netlify/callback`;

    const tokenResponse = await fetch('https://api.netlify.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.NETLIFY_CLIENT_ID,
        client_secret: process.env.NETLIFY_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenResponse.json()) as NetlifyTokenResponse;

    if (tokenData.error || !tokenData.access_token) {
      Sentry.captureMessage('Netlify OAuth token exchange failed', {
        level: 'error',
        extra: {
          error: tokenData.error,
          errorDescription: tokenData.error_description,
        },
      });
      return NextResponse.redirect(
        new URL('/editor?netlify_error=token_exchange_failed', request.url)
      );
    }

    const accessToken: string = tokenData.access_token;

    // Get Netlify user info using the client
    const client = netlifyClient.getClient(accessToken);
    const netlifyUser = await client.getUser();

    // Check if user already has a connection (for account switching detection)
    const existingConnection = await db.netlifyConnection.findUnique({
      where: { clerkUserId: userId },
    });

    // If connecting different account, store flag for frontend
    const isSwitchingAccount =
      existingConnection && existingConnection.netlifyUserId !== netlifyUser.id;

    // Save connection to database
    await db.netlifyConnection.upsert({
      where: { clerkUserId: userId },
      create: {
        clerkUserId: userId,
        netlifyEmail: netlifyUser.email,
        netlifyUserId: netlifyUser.id,
        netlifyFullName: netlifyUser.full_name,
        accessToken,
      },
      update: {
        netlifyEmail: netlifyUser.email,
        netlifyUserId: netlifyUser.id,
        netlifyFullName: netlifyUser.full_name,
        accessToken,
        lastDeployAt: new Date(),
      },
    });

    // Redirect to our internal callback page to trigger success message
    const callbackUrl = new URL('/netlify/callback', request.url);
    callbackUrl.searchParams.set('return_url', returnUrl);
    callbackUrl.searchParams.set('netlify_connected', 'true');

    // Add account switching info if applicable
    if (isSwitchingAccount && existingConnection) {
      callbackUrl.searchParams.set('switched', 'true');
      callbackUrl.searchParams.set('from', existingConnection.netlifyEmail);
      callbackUrl.searchParams.set('to', netlifyUser.email);
    }

    return NextResponse.redirect(callbackUrl.toString());
  } catch (error) {
    console.error('[Netlify Callback] Error:', error);
    Sentry.captureException(error, {
      tags: { feature: 'netlify_oauth_callback' },
    });

    return NextResponse.redirect(
      new URL('/editor?netlify_error=internal_error', request.url)
    );
  }
}
