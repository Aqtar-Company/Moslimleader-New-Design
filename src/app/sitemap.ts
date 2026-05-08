import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';

const BASE = 'https://moslimleader.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/library`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/cart`, lastModified: new Date(), changeFrequency: 'always', priority: 0.3 },
  ];

  const productPages: MetadataRoute.Sitemap = staticProducts.map(p => ({
    url: `${BASE}/shop/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  try {
    const dbProducts = await prisma.product.findMany({
      where: { source: 'admin' },
      select: { slug: true, updatedAt: true },
    });
    for (const p of dbProducts) {
      productPages.push({
        url: `${BASE}/shop/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    const books = await prisma.book.findMany({
      where: { isPublished: true },
      select: { id: true, updatedAt: true },
    });
    for (const b of books) {
      productPages.push({
        url: `${BASE}/library/${b.id}`,
        lastModified: b.updatedAt,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  } catch {}

  return [...staticPages, ...productPages];
}
