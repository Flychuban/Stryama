import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { ClerkProvider } from '@clerk/nextjs';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TRPCReactProvider } from '@/trpc/react';
import {
  StructuredData,
  getOrganizationSchema,
  getSoftwareApplicationSchema,
  getWebSiteSchema,
} from '@/lib/seo/structured-data';
import '../styles/globals.css';

export const dynamic = 'force-dynamic';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stryama.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Stryama - AI-Powered App Builder | Build Apps in Minutes',
    template: '%s | Stryama',
  },
  description:
    'Build working React apps in under 2 minutes with AI. No coding required. Just describe your idea and get production-ready code. Powered by Claude AI.',
  keywords: [
    'AI app builder',
    'no-code app generator',
    'Claude AI',
    'React app builder',
    'text to app',
    'AI web development',
    'prototype builder',
    'AI code generator',
    'build apps with AI',
    'no-code development',
  ],
  authors: [{ name: 'Stryama' }],
  creator: 'Stryama',
  publisher: 'Stryama',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    title: 'Stryama - AI-Powered App Builder | Build Apps in Minutes',
    description:
      'Build working React apps in under 2 minutes with AI. No coding required. Just describe your idea and get production-ready code. Powered by Claude AI.',
    siteName: 'Stryama',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Stryama - AI-Powered App Builder',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stryama - AI-Powered App Builder | Build Apps in Minutes',
    description:
      'Build working React apps in under 2 minutes with AI. No coding required. Powered by Claude AI.',
    images: ['/og-image.png'],
    creator: '@stryama',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add verification codes when available
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      dynamic
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html
        lang="en"
        className={`${GeistSans.variable}`}
        suppressHydrationWarning
      >
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {/* Structured Data for SEO - JSON-LD scripts */}
            <StructuredData data={getOrganizationSchema()} />
            <StructuredData data={getSoftwareApplicationSchema()} />
            <StructuredData data={getWebSiteSchema()} />

            <TRPCReactProvider>
              {children}
              <Toaster />
            </TRPCReactProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
