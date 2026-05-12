import Link from 'next/link';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { applyOverride, loadStaticOverrides } from '@/lib/product-overrides';
import RelatedProductPrice from './RelatedProductPrice';
import type { Product } from '@/types';

// Related products — same-category items shown at the bottom of every
// product detail page. Pure SEO win: links the products together for
// crawlers + reduces bounce rate by giving the buyer somewhere
// natural to keep browsing.
//
// Strategy: prefer same-category from DB (live prices), fall back to
// static products if DB has < 4 in the category. De-dupes against
// the current product. Caps at 4 cards so the layout stays clean on
// mobile.
async function getRelated({
  category,
  excludeSlug,
  limit = 4,
}: {
  category: string;
  excludeSlug: string;
  limit?: number;
}): Promise<Product[]> {
  let dbProducts: Product[] = [];
  try {
    const rows = await prisma.product.findMany({
      where: {
        category,
        slug: { not: excludeSlug },
        inStock: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit * 2, // fetch extra in case some are static-sourced and need merging
    });
    if (rows.length > 0) {
      const overrides = await loadStaticOverrides();
      // applyOverride returns null when the override marks the product
      // as deleted/hidden — filter those out so they don't render as
      // empty cards.
      dbProducts = rows
        .map(r => {
          if (r.source === 'static') {
            return applyOverride(r as unknown as Product, overrides[r.id]);
          }
          return r as unknown as Product;
        })
        .filter((p): p is Product => p !== null);
    }
  } catch {
    /* DB unavailable — fall through to static */
  }

  if (dbProducts.length >= limit) {
    return dbProducts.slice(0, limit);
  }

  // Backfill with static products if DB came up short.
  const haveSlugs = new Set([excludeSlug, ...dbProducts.map(p => p.slug)]);
  const fillers = staticProducts
    .filter(p => p.category === category && !haveSlugs.has(p.slug))
    .slice(0, limit - dbProducts.length);

  return [...dbProducts, ...fillers].slice(0, limit);
}

export default async function RelatedProducts({
  category,
  excludeSlug,
}: {
  category: string;
  excludeSlug: string;
}) {
  const related = await getRelated({ category, excludeSlug });
  if (related.length === 0) return null;

  return (
    <section
      className="mt-12 pt-8 border-t border-gray-200"
      aria-labelledby="related-products-heading"
    >
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <h2 id="related-products-heading" className="text-lg sm:text-xl font-black text-gray-900">
          منتجات ذات صلة
        </h2>
        <Link
          href={`/?category=${encodeURIComponent(category)}`}
          className="text-xs font-bold text-blue-700 hover:underline"
        >
          عرض الكل في {category} ←
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {related.map(p => {
          const img = Array.isArray(p.images) && p.images[0] ? (p.images[0] as string) : null;
          return (
            <Link
              key={p.id}
              href={`/shop/${p.slug}`}
              className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition"
            >
              <div className="relative aspect-square bg-gray-100">
                {img ? (
                  <Image
                    src={img}
                    alt={`${p.name} — ${p.category}`}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    loading="lazy"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">📦</div>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-bold text-gray-900 line-clamp-2 leading-tight">{p.name}</p>
                <p className="text-[11px] text-gray-500 mt-1">{p.category}</p>
                <RelatedProductPrice price={p.price} priceUsd={p.priceUsd ?? undefined} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
