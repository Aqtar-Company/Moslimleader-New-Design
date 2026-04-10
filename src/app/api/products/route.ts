export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const search = searchParams.get('q');

    // Get overrides for static products
    const overrideSetting = await prisma.setting.findUnique({ where: { key: 'product-overrides' } });
    const overrides: Record<string, Record<string, unknown>> = (overrideSetting?.value as Record<string, Record<string, unknown>>) ?? {};

    // Static products with overrides applied
    const staticWithOverrides = staticProducts.map(p => {
      const override = overrides[p.id] ?? {};
      const merged = { ...p, ...override };
      // Resolve priceUsd: prefer explicit priceUsd > regionalPricing.price_usd_manual
      const regional = (merged as { regionalPricing?: { price_usd_manual?: number; price_egp_manual?: number } }).regionalPricing;
      if ((!merged.priceUsd || (merged.priceUsd as number) === 0) && regional?.price_usd_manual) {
        (merged as Record<string, unknown>).priceUsd = regional.price_usd_manual;
      }
      // Resolve price (EGP): prefer explicit price > regionalPricing.price_egp_manual
      if (regional?.price_egp_manual && regional.price_egp_manual > 0) {
        (merged as Record<string, unknown>).price = regional.price_egp_manual;
      }
      return merged;
    });

    // DB-added products (admin-added)
    const dbProducts = await prisma.product.findMany({
      where: { source: 'admin' },
      orderBy: { createdAt: 'desc' },
    });

    // Merge all products: static (with overrides) + DB-added
    let allProducts: unknown[] = [...staticWithOverrides, ...dbProducts];

    // Apply filters
    if (category) allProducts = allProducts.filter((p: unknown) => (p as { category: string }).category === category);
    if (featured === 'true') allProducts = allProducts.filter((p: unknown) => (p as { featured?: boolean }).featured);
    if (search) {
      const q = search.toLowerCase();
      allProducts = allProducts.filter((p: unknown) => {
        const prod = p as { name: string; nameEn?: string };
        return prod.name.toLowerCase().includes(q) || (prod.nameEn ?? '').toLowerCase().includes(q);
      });
    }

    const _r = NextResponse.json({ products: allProducts }); _r.headers.set('Cache-Control','no-store,no-cache'); return _r;
  } catch (err) {
    console.error('[products GET]', err);
    // Fallback to static products on DB error
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
      data: {
        ...data,
        source: 'admin',
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('[products POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
