import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/opengraph-image(.*)', // Allow OG image for social media previews
  '/twitter-image(.*)', // Allow Twitter card images
  '/icon(.*)', // Allow favicon generation
  '/apple-icon(.*)', // Allow Apple touch icons
  '/robots.txt', // Allow robots.txt
  '/sitemap.xml', // Allow sitemap
]);

export default clerkMiddleware(async (auth, req) => {
  // Protect all routes except public ones
  if (!isPublicRoute(req)) {
    const isApiRoute =
      req.nextUrl.pathname.startsWith('/api') ||
      req.nextUrl.pathname.startsWith('/trpc');

    if (isApiRoute) {
      // For API routes, return JSON error instead of redirect
      try {
        await auth.protect();
      } catch {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
      }
    } else {
      // For page routes, use normal redirect behavior
      await auth.protect();
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
