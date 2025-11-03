/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import './src/env.js';

/** @type {import("next").NextConfig} */
const config = {
  // Production optimizations
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  // Workaround for Clerk + Next.js 15 build error with static error pages
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    optimizePackageImports: ['@clerk/nextjs'],
  },

  // Rewrites for preview proxy catch-all routing
  async rewrites() {
    return [
      {
        source: '/api/preview-proxy/:path*',
        destination: '/api/preview-proxy',
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        // Exclude preview proxy from CSP - it needs to pass through E2B's content unmodified
        source: '/((?!api/preview-proxy).*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.e2b.dev https://*.e2b.app", // Clerk JS SDK, Turnstile, and E2B sandboxes
              "style-src 'self' 'unsafe-inline' https://*.e2b.dev https://*.e2b.app", // Tailwind, CSS-in-JS, and E2B sandboxes
              "img-src 'self' data: blob: https: https://img.clerk.com", // Clerk avatar images
              "font-src 'self' data:",
              "connect-src 'self' https://api.anthropic.com https://api.e2b.dev https://*.e2b.app wss://*.e2b.app https://*.clerk.accounts.dev https://clerk.topical-mammoth-51.lcl.dev wss://*.clerk.accounts.dev",
              "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.e2b.dev https://*.e2b.app",
              "object-src 'none'",
              "base-uri 'self' https://*.e2b.dev https://*.e2b.app", // Allow base tag to point to E2B for proxied preview
              "form-action 'self'",
              "frame-ancestors 'self'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default config;
