import { auth } from '@clerk/nextjs/server';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * GitHub OAuth Connection Initiation Endpoint
 *
 * Generates GitHub OAuth URL and redirects user to GitHub for authorization.
 * This server-side approach avoids Clerk's step-up authentication requirement.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get return URL from query params
    const searchParams = request.nextUrl.searchParams;
    const returnUrl = searchParams.get('return_url') ?? '/editor';

    // Get GitHub OAuth credentials from environment
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/github/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    // Construct GitHub OAuth URL with required scopes
    const githubOAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubOAuthUrl.searchParams.set('client_id', clientId);
    githubOAuthUrl.searchParams.set('redirect_uri', redirectUri);
    githubOAuthUrl.searchParams.set(
      'scope',
      'public_repo read:user user:email'
    );
    githubOAuthUrl.searchParams.set(
      'state',
      Buffer.from(
        JSON.stringify({
          userId,
          returnUrl,
        })
      ).toString('base64')
    );

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
