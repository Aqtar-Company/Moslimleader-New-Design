import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // re-generate hourly

// Dynamic sitemap that lists every public page Google should crawl.
// Built fresh on each request so newly added books / products /
// staticly-defined items show up automatically.
//
// Excluded: admin/*, auth/*, account, cart, checkout, invoice/* —
// none of these should appear in search results (private + actionable
// flows + per-user state).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://moslimleader.com';
  const now = new Date();

  // ── Static high-priority pages ──
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`,         lastModified: now, changeFrequency: 'daily',  priority: 1.0 },
    { url: `${baseUrl}/shop`,     lastModified: now, changeFrequency: 'daily',  priority: 0.9 },
    { url: `${baseUrl}/library`,  lastModified: now, changeFrequency: 'daily',  priority: 0.9 },
    { url: `${baseUrl}/about`,    lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/policy`,      lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${baseUrl}/delete-data`, lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${baseUrl}/contact`,     lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/auth`,        lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];

  // ── Products (DB + static fallback) ──
  let dbProducts: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    dbProducts = await prisma.product.findMany({
      select: { slug: true, updatedAt: true },
      where: { inStock: true },
    });
  } catch {
    // DB unavailable — fall back to static products only.
  }
  const dbSlugs = new Set(dbProducts.map(p => p.slug));
  const staticProductPages: MetadataRoute.Sitemap = staticProducts
    .filter(p => !dbSlugs.has(p.slug)) // de-dupe — DB row is canonical
    .map(p => ({
      url: `${baseUrl}/shop/${p.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  const dbProductPages: MetadataRoute.Sitemap = dbProducts.map(p => ({
    url: `${baseUrl}/shop/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // ── Books (digital library) ──
  let books: Array<{ id: string; updatedAt: Date }> = [];
  try {
    books = await prisma.book.findMany({
      select: { id: true, updatedAt: true },
      where: { isPublished: true },
    });
  } catch { /* tolerate */ }
  const bookPages: MetadataRoute.Sitemap = books.map(b => ({
    url: `${baseUrl}/library/${b.id}`,
    lastModified: b.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // ── Series (digital library bundles) ──
  let seriesList: Array<{ id: string; updatedAt: Date }> = [];
  try {
    seriesList = await prisma.bookSeries.findMany({
      select: { id: true, updatedAt: true },
    });
  } catch { /* tolerate */ }
  const seriesPages: MetadataRoute.Sitemap = seriesList.map(s => ({
    url: `${baseUrl}/library/series/${s.id}/buy`,
    lastModified: s.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...dbProductPages,
    ...staticProductPages,
    ...bookPages,
    ...seriesPages,
  ];
}
