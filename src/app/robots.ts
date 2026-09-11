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
        allow: [
          '/',
          // The per-post share card used to live under /api/, and Facebook's scraper
          // honours robots.txt — a blanket /api/ disallow told it not to fetch the
          // preview image of any post. The card has moved to
          // /tareeq/<id>/opengraph-image, but links already shared point at the old URL,
          // which Facebook cached, so it has to stay reachable.
          '/api/tareeq/',
        ],
        disallow: [
          '/admin',
          '/admin/',
          '/api/',
          '/login',
          '/login/',
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
