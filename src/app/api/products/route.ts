export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';
import { getMergedStaticProducts } from '@/lib/product-overrides';
import type { Product } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const search = searchParams.get('q');
    const ageGroup = searchParams.get('ageGroup');

    const [mergedStatic, dbProducts] = await Promise.all([
      getMergedStaticProducts(),
      prisma.product.findMany({ where: { source: 'admin' }, orderBy: { createdAt: 'desc' } }),
    ]);

    let allProducts: Product[] = [...mergedStatic, ...(dbProducts as unknown as Product[])];

    if (category) allProducts = allProducts.filter(p => p.category === category);
    if (featured === 'true') allProducts = allProducts.filter(p => p.featured);
    if (search) {
      const q = search.toLowerCase();
      allProducts = allProducts.filter(p =>
        p.name.toLowerCase().includes(q) || (p.nameEn ?? '').toLowerCase().includes(q),
      );
    }
    if (ageGroup) {
      allProducts = allProducts.filter(p => {
        const min = p.minAge ?? 0;
        const max = p.maxAge ?? 99;
        if (ageGroup === '0-3') return min <= 3;
        if (ageGroup === '3-6') return min <= 6 && max >= 3;
        if (ageGroup === '6-9') return min <= 9 && max >= 6;
        if (ageGroup === '9+') return max >= 9;
        return true;
      });
    }

    const res = NextResponse.json({ products: allProducts });
    res.headers.set('Cache-Control', 'no-store, no-cache');
    return res;
  } catch (err) {
    console.error('[products GET]', err);
    // DB blew up. The helper's warm cache may still let us serve customised
    // statics; if it's cold too, drop to raw statics (best we can do).
    try {
      const fallback = await getMergedStaticProducts();
      return NextResponse.json({ products: fallback, source: 'static-fallback' });
    } catch {
      return NextResponse.json({ products: staticProducts, source: 'static-fallback' });
    }
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

    const body = await req.json();
    // Whitelist allowed fields — never spread untrusted body into Prisma create
    const product = await prisma.product.create({
      data: {
        slug:                   String(body.slug || ''),
        name:                   String(body.name || ''),
        nameEn:                 body.nameEn != null ? String(body.nameEn) : null,
        shortDescription:       String(body.shortDescription || ''),
        shortDescriptionEn:     body.shortDescriptionEn != null ? String(body.shortDescriptionEn) : undefined,
        description:            String(body.description || ''),
        descriptionEn:          body.descriptionEn != null ? String(body.descriptionEn) : undefined,
        price:                  Number(body.price) || 0,
        priceUsd:               body.priceUsd != null ? Number(body.priceUsd) : undefined,
        category:               String(body.category || ''),
        subcategory:            body.subcategory != null ? String(body.subcategory) : undefined,
        variants:               Array.isArray(body.variants) ? body.variants : [],
        tags:                   Array.isArray(body.tags) ? body.tags : [],
        images:                 Array.isArray(body.images) ? body.images : [],
        videos:                 Array.isArray(body.videos) ? body.videos : [],
        inStock:                typeof body.inStock === 'boolean' ? body.inStock : true,
        featured:               typeof body.featured === 'boolean' ? body.featured : false,
        comingSoon:             typeof body.comingSoon === 'boolean' ? body.comingSoon : false,
        weight:                 body.weight != null ? Number(body.weight) : undefined,
        minAge:                 body.minAge != null ? Number(body.minAge) : undefined,
        maxAge:                 body.maxAge != null ? Number(body.maxAge) : undefined,
        source:                 'admin',
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error('[products POST]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
