import {
  type Organization,
  type WithContext,
  type SoftwareApplication,
  type WebSite,
} from 'schema-dts';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://stryama.app';

/**
 * Organization schema for Stryama
 * Helps search engines understand the company/organization behind the product
 */
export function getOrganizationSchema(): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Stryama',
    url: siteUrl,
    logo: `${siteUrl}/logo/stryama-logo.png`,
    description:
      'AI-powered app builder that turns ideas into production-ready React apps in minutes',
    sameAs: [
      // Add social media URLs when available
      // 'https://twitter.com/stryama',
      // 'https://github.com/stryama',
    ],
  };
}

/**
 * SoftwareApplication schema for Stryama product
 * Helps search engines understand the software/product details
 */
export function getSoftwareApplicationSchema(): WithContext<SoftwareApplication> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Stryama',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web Browser',
    description:
      'Build working React apps in under 2 minutes with AI. No coding required. Just describe your idea and get production-ready code. Powered by Claude AI.',
    url: siteUrl,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free tier with 15 AI generations per month',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '100',
      bestRating: '5',
      worstRating: '1',
    },
    featureList: [
      'AI-powered app generation',
      'Natural language prompts',
      'Real-time code preview',
      'Production-ready React code',
      'Export to GitHub',
      'No coding required',
      'Claude AI integration',
    ],
  };
}

/**
 * WebSite schema
 * Basic website information for search engines
 * Note: potentialAction (search) removed until search page is implemented
 */
export function getWebSiteSchema(): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Stryama',
    url: siteUrl,
    description:
      'AI-Powered App Builder - Build apps in minutes with no coding required',
  };
}

/**
 * Renders JSON-LD structured data as a script tag
 */
export function StructuredData({
  data,
}: {
  data: WithContext<Organization | SoftwareApplication | WebSite>;
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
