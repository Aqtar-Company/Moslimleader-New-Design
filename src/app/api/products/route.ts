export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import {
  publicProductCache,
  setPublicProductCache,
  invalidatePublicProductsCache,
} from '@/lib/product-cache';

export { invalidatePublicProductsCache };

// Fields needed for ProductCard — excludes heavy LongText description fields
const PRODUCT_SELECT = {
  id: true, slug: true, name: true, nameEn: true,
  shortDescription: true, shortDescriptionEn: true,
  price: true, priceUsd: true, category: true, subcategory: true,
  variants: true, images: true, inStock: true, featured: true,
  weight: true, regionalPricing: true, source: true, tags: true,
  videoUrl: true, videos: true, createdAt: true, updatedAt: true,
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const search = searchParams.get('q');

    // Serve from cache when no filters (most common case: home page loads all products)
    const noFilters = !category && !featured && !search;

    let allProducts: unknown[];

    if (noFilters && publicProductCache && Date.now() < publicProductCache.expiresAt) {
      allProducts = publicProductCache.data;
    } else {
      // Run both DB queries in parallel
      const [overrideSetting, dbProducts] = await Promise.all([
        prisma.setting.findUnique({ where: { key: 'product-overrides' } }),
        prisma.product.findMany({
          where: { source: 'admin' },
          orderBy: { createdAt: 'desc' },
          select: PRODUCT_SELECT,
        }),
      ]);

      const overrides: Record<string, Record<string, unknown>> =
        (overrideSetting?.value as Record<string, Record<string, unknown>>) ?? {};

      // Static products with overrides applied
      const staticWithOverrides = staticProducts.map(p => {
        const override = overrides[p.id] ?? {};
        const merged = { ...p, ...override };
        const regional = (merged as { regionalPricing?: { price_usd_manual?: number; price_egp_manual?: number } }).regionalPricing;
        const hasExplicitPriceUsd = override.priceUsd !== undefined && (override.priceUsd as number) > 0;
        if (!hasExplicitPriceUsd && (!merged.priceUsd || (merged.priceUsd as number) === 0) && regional?.price_usd_manual) {
          (merged as Record<string, unknown>).priceUsd = regional.price_usd_manual;
        }
        const hasExplicitPrice = override.price !== undefined && (override.price as number) > 0;
        if (!hasExplicitPrice && regional?.price_egp_manual && regional.price_egp_manual > 0) {
          (merged as Record<string, unknown>).price = regional.price_egp_manual;
        }
        return merged;
      });

      allProducts = [...staticWithOverrides, ...dbProducts];

      // Cache the unfiltered list for 60 seconds
      if (noFilters) setPublicProductCache(allProducts);
    }

    // Apply filters in-memory
    let result = allProducts;
    if (category) result = result.filter((p: unknown) => (p as { category: string }).category === category);
    if (featured === 'true') result = result.filter((p: unknown) => (p as { featured?: boolean }).featured);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p: unknown) => {
        const prod = p as { name: string; nameEn?: string };
        return prod.name.toLowerCase().includes(q) || (prod.nameEn ?? '').toLowerCase().includes(q);
      });
    }

    return NextResponse.json({ products: result });
  } catch (err) {
    console.error('[products GET]', err);
    return NextResponse.json({ products: staticProducts, source: 'static-fallback' });
  }
}

// Admin: create product
export async function POST(req: NextRequest) {
  try {
    const { getAuthUser } = await import('@/lib/jwt');
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const data = await req.json();
    const product = await prisma.product.create({
      data: { ...data, source: 'admin' },
    });
    invalidatePublicProductsCache();
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('[products POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
