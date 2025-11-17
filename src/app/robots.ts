import { type MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stryama.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/editor',
          '/profile',
          '/sign-in',
          '/sign-up',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
