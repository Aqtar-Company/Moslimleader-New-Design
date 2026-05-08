import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/auth/', '/account/', '/verify-email/'],
      },
    ],
    sitemap: 'https://moslimleader.com/sitemap.xml',
  };
}
