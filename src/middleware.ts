import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/github/callback(.*)',
  '/opengraph-image(.*)',
  '/twitter-image(.*)',
  '/icon(.*)',
  '/apple-icon(.*)',
  '/robots.txt',
  '/sitemap.xml',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    const isApiRoute =
      req.nextUrl.pathname.startsWith('/api') ||
      req.nextUrl.pathname.startsWith('/trpc');

    if (isApiRoute) {
      try {
        await auth.protect();
      } catch {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }
    } else {
      await auth.protect();
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
