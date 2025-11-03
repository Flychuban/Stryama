import { type NextRequest, NextResponse } from 'next/server';

/**
 * Preview Proxy API Route - Full Reverse Proxy for E2B Sandboxes
 *
 * This route acts as a reverse proxy for E2B sandbox content, allowing
 * it to be embedded in iframes by stripping blocking headers and rewriting URLs.
 *
 * Why this is needed:
 * - E2B's infrastructure adds X-Frame-Options that prevent iframe embedding
 * - We need to proxy ALL resources (HTML, JS, CSS, WebSocket) from E2B
 * - Rewrites resource URLs to go through this proxy
 *
 * How it works:
 * - GET /api/preview-proxy?url=https://5173-xxx.e2b.app -> proxies the full E2B site
 * - GET /api/preview-proxy/5173-xxx.e2b.app/src/main.tsx -> proxies specific assets
 *
 * Security:
 * - Only allows E2B domains (*.e2b.dev, *.e2b.app)
 * - Validates URL format
 * - Strips only iframe-blocking headers
 */

// Helper to extract E2B URL from path
function getE2BUrl(request: NextRequest): string | null {
  const { searchParams, pathname } = new URL(request.url);

  // Check if URL is provided as query parameter (initial load)
  const urlParam = searchParams.get('url');
  if (urlParam) {
    return urlParam;
  }

  // Extract from path: /api/preview-proxy/5173-xxx.e2b.app/src/main.tsx
  const pathMatch = /\/api\/preview-proxy\/(.+)/.exec(pathname);
  if (pathMatch) {
    const targetPath = pathMatch[1];
    // Reconstruct full URL
    return `https://${targetPath}`;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const targetUrl = getE2BUrl(request);

    // Validate URL is provided
    if (!targetUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter. Use ?url= or path-based proxy.' },
        { status: 400 }
      );
    }

    // Security: Only allow E2B domains (both .e2b.dev and .e2b.app)
    const url = new URL(targetUrl);
    const isE2BDomain =
      url.hostname.endsWith('.e2b.dev') || url.hostname.endsWith('.e2b.app');
    if (!isE2BDomain) {
      return NextResponse.json(
        { error: 'Invalid domain. Only E2B sandbox URLs are allowed.' },
        { status: 403 }
      );
    }

    // Fetch content from E2B
    const response = await fetch(targetUrl, {
      headers: {
        // Forward user agent to E2B
        'User-Agent': request.headers.get('user-agent') ?? 'Mozilla/5.0',
      },
      // Don't follow redirects automatically - handle them
      redirect: 'manual',
    });

    // Handle redirects
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        // If redirect is to another E2B URL, proxy it
        if (location.includes('.e2b.dev') || location.includes('.e2b.app')) {
          return NextResponse.redirect(
            new URL(
              `/api/preview-proxy?url=${encodeURIComponent(location)}`,
              request.url
            )
          );
        }
      }
    }

    // Clone headers and remove iframe-blocking ones
    const responseHeaders = new Headers(response.headers);

    // Remove headers that block iframe embedding
    responseHeaders.delete('x-frame-options');
    responseHeaders.delete('X-Frame-Options');

    // Remove ALL CSP headers - let the content run freely in iframe
    responseHeaders.delete('content-security-policy');
    responseHeaders.delete('Content-Security-Policy');

    // Add CORS headers to allow embedding
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

    // Check if response is HTML and rewrite URLs to go through proxy
    const contentType = responseHeaders.get('content-type');
    if (contentType?.includes('text/html')) {
      const html = await response.text();
      const e2bHost = url.hostname;

      // Rewrite URLs in HTML to go through our proxy so all resources load correctly
      const modifiedHtml = html
        // Rewrite absolute URLs: https://5173-xxx.e2b.app/src/main.tsx -> /api/preview-proxy/5173-xxx.e2b.app/src/main.tsx
        .replace(
          new RegExp(
            `https?://${e2bHost.replace(/\./g, '\\.')}(/[^"'\\s>]*)`,
            'g'
          ),
          `/api/preview-proxy/${e2bHost}$1`
        )
        // Rewrite root-relative URLs in src/href attributes: src="/src/main.tsx" -> src="/api/preview-proxy/host/src/main.tsx"
        .replace(
          /((?:src|href)=["'])\/(?!\/|api\/preview-proxy)/g,
          `$1/api/preview-proxy/${e2bHost}/`
        );

      return new NextResponse(modifiedHtml, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    // Return the proxied response with cleaned headers (non-HTML)
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Preview proxy error:', error);

    return NextResponse.json(
      {
        error: 'Failed to proxy preview',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
