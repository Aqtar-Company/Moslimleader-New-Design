import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const search = searchParams.get('q');

    const dbProducts = await prisma.product.findMany({
      where: {
        ...(category && { category }),
        ...(featured === 'true' && { featured: true }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { nameEn: { contains: search } },
          ],
        }),
      },
      orderBy: { createdAt: 'desc' },
    });

    // If no products in DB yet, return static products as fallback
    if (dbProducts.length === 0) {
      let filtered = staticProducts;
      if (category) filtered = filtered.filter(p => p.category === category);
      if (featured === 'true') filtered = filtered.filter(p => p.featured);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(q) || (p.nameEn ?? '').toLowerCase().includes(q)
        );
      }
      return NextResponse.json({ products: filtered, source: 'static' });
    }

    return NextResponse.json({ products: dbProducts, source: 'db' });
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
