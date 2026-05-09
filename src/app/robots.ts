import type { MetadataRoute } from 'next';

// Robots configuration. Public catalogue is fully crawlable; admin /
// account / cart / checkout / API routes are blocked because they're
// either user-state, write surfaces, or duplicate canonical paths.
// PayPal / auth callbacks should never appear in search.
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/auth',
          '/auth/',
          '/account',
          '/account/',
          '/cart',
          '/checkout',
          '/wishlist',
          '/invoice/',
          '/verify-email',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
