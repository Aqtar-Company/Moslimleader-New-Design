import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { products as staticProducts } from '@/lib/products';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const product = await prisma.product.findUnique({ where: { slug } });
    if (product) return NextResponse.json({ product });

    // Fallback to static
    const staticProduct = staticProducts.find(p => p.slug === slug);
    if (staticProduct) return NextResponse.json({ product: staticProduct, source: 'static' });

    return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 });
  } catch (err) {
    console.error('[product slug GET]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { getAuthUser } = await import('@/lib/jwt');
    const auth = await getAuthUser();
    if (!auth || auth.role !== 'admin') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const { slug } = await params;
    const data = await req.json();
    const product = await prisma.product.update({ where: { slug }, data });
    return NextResponse.json({ product });
  } catch (err) {
    console.error('[product slug PUT]', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
