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
