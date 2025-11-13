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

  // Keep SDK as external package (don't bundle with webpack)
  serverExternalPackages: ['@anthropic-ai/claude-agent-sdk'],

  // Include CLI executable in Vercel deployment bundle
  outputFileTracingIncludes: {
    '/api/trpc/**/*': [
      './node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@*/node_modules/@anthropic-ai/claude-agent-sdk/cli.js',
      './node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@*/node_modules/@anthropic-ai/claude-agent-sdk/vendor/**/*',
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes except tRPC API
        source: '/((?!api/trpc).*)',
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
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.e2b.dev https://*.e2b.app https://js.stripe.com https://*.js.stripe.com https://maps.googleapis.com", // Clerk JS SDK, Turnstile, E2B sandboxes, and Stripe billing
              "style-src 'self' 'unsafe-inline' https://*.e2b.dev https://*.e2b.app", // Tailwind, CSS-in-JS, and E2B sandboxes
              "img-src 'self' data: blob: https: https://img.clerk.com https://*.stripe.com", // Clerk avatar images and Stripe payment icons
              "font-src 'self' data:",
              "connect-src 'self' https://api.anthropic.com https://api.e2b.dev https://*.e2b.app wss://*.e2b.app https://*.clerk.accounts.dev https://clerk.topical-mammoth-51.lcl.dev wss://*.clerk.accounts.dev https://api.stripe.com https://maps.googleapis.com",
              "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com https://*.e2b.dev https://*.e2b.app https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self' https://*.e2b.dev https://*.e2b.app", // Allow E2B sandbox URLs in iframe embeds
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
